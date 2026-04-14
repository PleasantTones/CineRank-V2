import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PageWrapper from '../components/UI/PageWrapper'
import { openMovieModal } from '../components/UI/MovieModal'
import { useStore } from '../store/useStore'
import { MOVIES, PLAYERS, PLAYER_COLORS } from '../lib/movies'
import PosterImage from '../components/UI/PosterImage'

const SORTS = [
  { key: 'elo',     label: 'ELO score' },
  { key: 'wins',    label: 'Wins'      },
  { key: 'matches', label: 'Matchups'  },
  { key: 'wr',      label: 'Win %'     },
]

function useEloSnapshot(ratings) {
  const [snapshot] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cinerank_lb_snapshot') || '{}') } catch { return {} }
  })
  useMemo(() => {
    const snap = {}
    MOVIES.forEach(m => { snap[m.id] = ratings[m.id]?.elo ?? 1000 })
    localStorage.setItem('cinerank_lb_snapshot', JSON.stringify(snap))
  }, [])
  return snapshot
}

export default function Leaderboard() {
  const { players, globalRatings } = useStore()
  const [filter, setFilter] = useState('global') // 'global' or player name
  const [sort, setSort] = useState('elo')
  const snapshot = useEloSnapshot(globalRatings)

  // Compute global ratings directly from players if store hasn't populated it yet
  const computedGlobal = React.useMemo(() => {
    const global = {}
    MOVIES.forEach(m => {
      let eloSum = 0, eloCount = 0, wins = 0, losses = 0, matches = 0
      PLAYERS.forEach(p => {
        const r = players[p]?.ratings?.[m.id]
        if (r && r.matches > 0) { eloSum += r.elo; eloCount++; wins += r.wins; losses += r.losses; matches += r.matches }
      })
      global[m.id] = { elo: eloCount > 0 ? Math.round(eloSum / eloCount) : 1000, wins, losses, matches }
    })
    return global
  }, [players])

  const effectiveGlobal = Object.values(globalRatings).some(r => r.matches > 0) ? globalRatings : computedGlobal
  const ratings = filter === 'global' ? effectiveGlobal : (players[filter]?.ratings ?? effectiveGlobal)

  const rows = useMemo(() => {
    return [...MOVIES]
      .filter(m => ratings[m.id]?.matches > 0)
      .map(m => {
        const r = ratings[m.id]
        const wr = r.matches > 0 ? r.wins / r.matches : 0
        const trend = (r.elo ?? 1000) - (snapshot[m.id] ?? 1000)
        return { movie: m, r, wr, trend }
      })
      .sort((a, b) => {
        if (sort === 'elo')     return b.r.elo - a.r.elo
        if (sort === 'wins')    return b.r.wins - a.r.wins
        if (sort === 'matches') return b.r.matches - a.r.matches
        return b.wr - a.wr
      })
  }, [ratings, sort])

  const mostImproved = useMemo(() => {
    return [...MOVIES]
      .filter(m => globalRatings[m.id]?.matches > 0 && snapshot[m.id])
      .map(m => ({ movie: m, gain: (globalRatings[m.id].elo ?? 1000) - (snapshot[m.id] ?? 1000) }))
      .filter(x => x.gain > 0)
      .sort((a, b) => b.gain - a.gain)[0]
  }, [globalRatings, snapshot])

  const medals = ['🥇', '🥈', '🥉']

  return (
    <PageWrapper>
      <div className="p-4 space-y-3">

        {/* Most improved callout */}
        <AnimatePresence>
          {mostImproved && (
            <motion.button
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              onClick={() => openMovieModal(mostImproved.movie.id)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-gold/20 text-left hover:-translate-y-0.5 transition-all duration-200"
              style={{ background: 'rgba(200,160,64,0.06)' }}
            >
              <span className="text-base">📈</span>
              <PosterImage movieId={mostImproved.movie.id} fallbackSrc={mostImproved.movie.img} className="w-7 h-10 object-cover rounded-md flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-gold/60 uppercase tracking-widest">Most improved</p>
                <p className="text-xs font-semibold text-ink-primary truncate">{mostImproved.movie.title}</p>
              </div>
              <span className="text-gold font-bold font-mono text-sm flex-shrink-0">+{mostImproved.gain}</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Player filter — combined by default, click a name to see that player's rankings */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setFilter('global')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
              filter === 'global'
                ? 'bg-gold text-black border-gold'
                : 'border-border text-ink-muted hover:text-ink-secondary'
            }`}
          >
            Everyone
          </button>
          {PLAYERS.map(p => (
            <button
              key={p}
              onClick={() => setFilter(filter === p ? 'global' : p)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all"
              style={{
                borderColor: filter === p ? PLAYER_COLORS[p] : '#2A2A2E',
                background: filter === p ? PLAYER_COLORS[p] + '22' : 'transparent',
                color: filter === p ? PLAYER_COLORS[p] : '#A0A0A0',
              }}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PLAYER_COLORS[p] }} />
              {p}
            </button>
          ))}
        </div>

        {/* Sort + row count */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-ink-muted">Sort by</span>
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="text-xs font-semibold bg-surface border border-border rounded-lg px-2.5 py-2 text-ink-primary focus:outline-none focus:border-gold cursor-pointer"
            >
              {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <span className="text-[11px] text-ink-muted">{rows.length} movies ranked</span>
        </div>

        {/* Table */}
        {rows.length === 0 ? (
          <div className="text-center py-12 text-ink-muted text-sm">
            No votes yet — start voting to see rankings!
          </div>
        ) : (
          <div className="rounded-2xl border border-border overflow-hidden">
            {/* Table header */}
            <div className="grid text-[10px] font-bold text-ink-muted uppercase tracking-widest px-3 py-2.5 border-b border-border"
              style={{ gridTemplateColumns: '32px 36px 1fr 52px 52px 44px 52px', background: '#0e0e10' }}>
              <span>#</span>
              <span />
              <span>Movie</span>
              <span className="text-right">Matchups</span>
              <span className="text-right">W / L</span>
              <span className="text-right">Win %</span>
              <span className="text-right">ELO</span>
            </div>

            {/* Rows */}
            {rows.map(({ movie, r, wr, trend }, i) => (
              <motion.button
                key={movie.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.4) }}
                onClick={() => openMovieModal(movie.id)}
                className="w-full grid items-center px-3 py-2.5 border-b border-border/50 last:border-b-0 hover:bg-raised transition-colors text-left"
                style={{ gridTemplateColumns: '32px 36px 1fr 52px 52px 44px 52px' }}
              >
                {/* Rank */}
                <span className="text-sm text-center">
                  {i < 3
                    ? medals[i]
                    : <span className="text-[11px] font-bold text-ink-muted font-mono">#{i + 1}</span>
                  }
                </span>

                {/* Poster */}
                <PosterImage movieId={movie.id} fallbackSrc={movie.img} alt={movie.title}
                  className="w-7 h-10 object-cover rounded-md" />

                {/* Title + trend */}
                <div className="flex items-center gap-1.5 min-w-0 pl-2 overflow-hidden">
                  <span className="text-sm font-medium text-ink-primary truncate">{movie.title}</span>
                  {trend !== 0 && (
                    <span className={`text-[10px] font-bold flex-shrink-0 ${trend > 0 ? 'text-win' : 'text-lose'}`}>
                      {trend > 0 ? '▲' : '▼'}
                    </span>
                  )}
                </div>

                {/* Matchups */}
                <span className="text-xs text-ink-muted text-right font-mono">{r.matches}</span>

                {/* W/L */}
                <span className="text-xs text-ink-muted text-right font-mono">{r.wins} / {r.losses}</span>

                {/* Win % */}
                <span className="text-xs text-ink-secondary text-right font-mono">{Math.round(wr * 100)}%</span>

                {/* ELO */}
                <span className="text-sm font-bold text-gold text-right font-mono">{r.elo}</span>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  )
}
