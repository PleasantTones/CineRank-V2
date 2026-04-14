import { create } from 'zustand'
import { MOVIES, PLAYERS, initRatings } from '../lib/movies'
import { applyElo, pairKey } from '../lib/elo'

function defaultPlayer() {
  return { ratings: initRatings(), matchCount: 0, playedPairs: [], h2hHistory: {} }
}

function defaultGlobal() {
  return Object.fromEntries(MOVIES.map(m => [m.id, { elo: 1000, wins: 0, losses: 0, matches: 0 }]))
}

// Simple store — no persist middleware (was causing silent crashes in Zustand v5)
// player name saved/loaded manually via localStorage
export const useStore = create((set, get) => ({
  player: localStorage.getItem('cinerank-player') || null,
  setPlayer: (p) => {
    localStorage.setItem('cinerank-player', p || '')
    set({ player: p })
  },

  players: Object.fromEntries(PLAYERS.map(p => [p, defaultPlayer()])),
  globalRatings: defaultGlobal(),
  dynamicMovies: [],   // movies loaded from Supabase season_movies table
  collected: [],
  muted: localStorage.getItem('cinerank-muted') === 'true',
  toggleMuted: () => set(s => {
    const next = !s.muted
    localStorage.setItem('cinerank-muted', next)
    return { muted: next }
  }),

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
    const newPlayers = { ...s.players, [p]: newPd }
    const global = buildGlobal(newPlayers)
    return { players: newPlayers, globalRatings: global }
  }),

  undoVote: (playerName, prevRatings, prevPlayedPairs, prevMatchCount) => set(s => {
    if (!playerName) return {}
    const pd = s.players[playerName]
    const newPd = { ...pd, ratings: prevRatings, playedPairs: prevPlayedPairs, matchCount: prevMatchCount }
    const newPlayers = { ...s.players, [playerName]: newPd }
    return { players: newPlayers, globalRatings: buildGlobal(newPlayers) }
  }),

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

  // Merge Supabase season movies into the store
  loadDynamicMovies: (rows) => set((state) => {
    const dynamic = (rows || []).map(r => ({
      id: r.id,
      title: r.title,
      img: null,    // no thumbnail — OMDB poster loads from imdb_id
      imdbId: r.imdb_id,
      tmdbId: r.tmdb_id,
      releaseDate: r.release_date,
      season: r.season,
      dynamic: true,
    }))

    // For each player, add any new dynamic movies as unseen:true
    // (preserves existing ratings if player already voted on this movie)
    const updatedPlayers = {}
    Object.entries(state.players).forEach(([playerName, pd]) => {
      const ratings = { ...pd.ratings }
      dynamic.forEach(m => {
        if (!ratings[m.id]) {
          ratings[m.id] = { elo: 1000, wins: 0, losses: 0, matches: 0, unseen: true }
        }
      })
      updatedPlayers[playerName] = { ...pd, ratings }
    })

    return { dynamicMovies: dynamic, players: updatedPlayers }
  }),

  collectPoster: (id) => set(s => ({
    collected: s.collected.includes(id) ? s.collected : [...s.collected, id]
  })),

  loadAllFromDB: (allData) => set(() => {
    const newPlayers = {}
    Object.entries(allData).forEach(([playerName, { rows, playedPairs }]) => {
      const ratings = {}
      MOVIES.forEach(m => { ratings[m.id] = { elo: 1000, wins: 0, losses: 0, matches: 0, unseen: false } })
      ;(rows || []).forEach(r => {
        if (r.movie_id) {  // include dynamic movies even if not pre-initialized
          ratings[r.movie_id] = {
            elo: r.elo || 1000,
            wins: r.wins || 0,
            losses: r.losses || 0,
            matches: r.matches || 0,
            unseen: r.unseen ?? false,
          }
        }
      })
      const mergedPairs = [...new Set(playedPairs || [])]
      newPlayers[playerName] = {
        ratings,
        playedPairs: mergedPairs,
        matchCount: mergedPairs.length,
        h2hHistory: {},
      }
    })
    // Fill in any missing players with defaults
    PLAYERS.forEach(p => { if (!newPlayers[p]) newPlayers[p] = defaultPlayer() })
    return { players: newPlayers, globalRatings: buildGlobal(newPlayers) }
  }),
}))

function buildGlobal(players) {
  const global = {}
  MOVIES.forEach(m => {
    let eloSum = 0, eloCount = 0, wins = 0, losses = 0, matches = 0
    PLAYERS.forEach(pl => {
      const r = players[pl]?.ratings?.[m.id]
      if (r && r.matches > 0) { eloSum += r.elo; eloCount++; wins += r.wins; losses += r.losses; matches += r.matches }
    })
    global[m.id] = { elo: eloCount > 0 ? Math.round(eloSum / eloCount) : 1000, wins, losses, matches }
  })
  return global
}
