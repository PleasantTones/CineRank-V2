import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { MOVIES, PLAYERS, initRatings } from '../lib/movies'
import { applyElo, pairKey } from '../lib/elo'

function defaultPlayer() {
  return { ratings: initRatings(), matchCount: 0, playedPairs: [], h2hHistory: {} }
}

export const useStore = create(
  persist(
    (set, get) => ({
      // Active player
      player: null,
      setPlayer: (p) => set({ player: p }),

      // Per-player data
      players: Object.fromEntries(PLAYERS.map(p => [p, defaultPlayer()])),

      // Global ratings (averaged across players)
      globalRatings: Object.fromEntries(MOVIES.map(m => [m.id, { elo: 1000, wins: 0, losses: 0, matches: 0 }])),

      // Collected posters in Hall
      collected: [],

      // Sound muted
      muted: false,
      toggleMuted: () => set(s => ({ muted: !s.muted })),

      // Vote action
      vote: (winnerId, loserId) => set(s => {
        const p = s.player
        if (!p) return {}
        const pd = s.players[p]
        const newRatings = applyElo(pd.ratings, winnerId, loserId)
        const newPd = {
          ...pd,
          ratings: { ...pd.ratings, ...newRatings },
          matchCount: pd.matchCount + 1,
          playedPairs: [...pd.playedPairs, pairKey(winnerId, loserId)],
          h2hHistory: { ...pd.h2hHistory, [pairKey(winnerId, loserId)]: winnerId },
        }
        // Rebuild global
        const global = { ...s.globalRatings }
        MOVIES.forEach(m => {
          let eloSum = 0, eloCount = 0, wins = 0, losses = 0, matches = 0
          PLAYERS.forEach(pl => {
            const r = pl === p ? newRatings[m.id] || newPd.ratings[m.id] : s.players[pl].ratings[m.id]
            if (r && r.matches > 0) { eloSum += r.elo; eloCount++; wins += r.wins; losses += r.losses; matches += r.matches }
          })
          global[m.id] = { elo: eloCount > 0 ? Math.round(eloSum / eloCount) : 1000, wins, losses, matches }
        })
        return { players: { ...s.players, [p]: newPd }, globalRatings: global }
      }),

      // Mark unseen
      markUnseen: (movieId) => set(s => {
        const p = s.player; if (!p) return {}
        const pd = s.players[p]
        return { players: { ...s.players, [p]: { ...pd, ratings: { ...pd.ratings, [movieId]: { ...pd.ratings[movieId], unseen: true } } } } }
      }),

      markSeen: (movieId) => set(s => {
        const p = s.player; if (!p) return {}
        const pd = s.players[p]
        return { players: { ...s.players, [p]: { ...pd, ratings: { ...pd.ratings, [movieId]: { ...pd.ratings[movieId], unseen: false } } } } }
      }),

      collectPoster: (id) => set(s => ({ collected: s.collected.includes(id) ? s.collected : [...s.collected, id] })),

      // Load from DB (merge)
      loadPlayerFromDB: (playerName, rows) => set(s => {
        const ratings = initRatings()
        rows.forEach(r => {
          if (ratings[r.movie_id]) {
            ratings[r.movie_id] = { elo: r.elo, wins: r.wins, losses: r.losses, matches: r.matches, unseen: r.unseen || false }
          }
        })
        const existing = s.players[playerName] || defaultPlayer()
        return {
          players: { ...s.players, [playerName]: { ...existing, ratings } }
        }
      }),
    }),
    {
      name: 'cinerank-store',
      partialize: (s) => ({ player: s.player, players: s.players, collected: s.collected, muted: s.muted }),
    }
  )
)

// ── Supabase write-back helper (call after vote) ──────────────────────────────
export async function saveRatingsToDB(playerName, ratings, sbFetch) {
  try {
    const rows = Object.entries(ratings).map(([movieId, r]) => ({
      id: `${playerName}_${movieId}`,
      player: playerName,
      movie_id: movieId,
      elo: r.elo,
      wins: r.wins,
      losses: r.losses,
      matches: r.matches,
      unseen: r.unseen || false,
    }))
    // Batch upsert in chunks of 50
    for (let i = 0; i < rows.length; i += 50) {
      await sbFetch('/rest/v1/ratings', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        body: JSON.stringify(rows.slice(i, i + 50)),
      })
    }
  } catch(e) { console.error('Rating save error:', e) }
}
