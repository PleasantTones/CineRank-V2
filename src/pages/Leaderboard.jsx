import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PageWrapper from '../components/UI/PageWrapper'
import { LeaderboardSkeleton } from '../components/UI/Skeleton'
import { openMovieModal } from '../components/UI/MovieModal'
import { useStore } from '../store/useStore'
import { MOVIES, PLAYERS, PLAYER_COLORS } from '../lib/movies'

const SORTS = [
  { key: 'elo',     label: 'ELO'      },
  { key: 'wins',    label: 'Wins'     },
  { key: 'matches', label: 'Matchups' },
  { key: 'wr',      label: 'Win Rate' },
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
  const [filter, setFilter] = useState('global')
  const [sort, setSort] = useState('elo')
  const [loading, setLoading] = useState(true)
  
  // Stop skeleton after first meaningful data
  React.useEffect(() => {
    const hasData = Object.values(globalRatings).some(r => r.matches > 0)
    if (hasData) setLoading(false)
    else setTimeout(() => setLoading(false), 1800)
  }, [globalRatings])

  const ratings = filter === 'global' ? globalRatings : (players[filter]?.ratings ?? globalRatings)
  const snapshot = useEloSnapshot(globalRatings)

  const sorted = useMemo(() => {
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
  }, [ratings, sort, snapshot])

  const mostImproved = useMemo(() => {
    return [...MOVIES]
      .filter(m => globalRatings[m.id]?.matches > 0 && snapshot[m.id])
      .map(m => ({ movie: m, gain: (globalRatings[m.id].elo ?? 1000) - (snapshot[m.id] ?? 1000) }))
      .filter(x => x.gain > 0)
      .sort((a, b) => b.gain - a.gain)[0]
  }, [globalRatings, snapshot])

  return (
    <PageWrapper>
      <div className="p-4 space-y-3">
        {/* Most improved */}
        <AnimatePresence>
          {mostImproved && (
            <motion.button
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              onClick={() => openMovieModal(mostImproved.movie.id)}
              className="w-full flex items-center gap-3 p-3 bg-gold/6 border border-gold/20 rounded-2xl hover:bg-gold/10 transition-colors text-left"
            >
              <img src={mostImproved.movie.img} className="w-8 h-12 object-cover rounded-lg flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-gold/60 uppercase tracking-widest">📈 Most improved</p>
                <p className="text-sm font-semibold text-ink-primary truncate">{mostImproved.movie.title}</p>
              </div>
              <span className="text-gold font-bold font-mono text-sm flex-shrink-0">+{mostImproved.gain}</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Player filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5" style={{ touchAction: "pan-x" }}>
          {['global', ...PLAYERS].map(p => (
            <button key={p} onClick={() => setFilter(p)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${
                filter === p ? 'text-black border-transparent' : 'bg-surface border-border text-ink-secondary'
              }`}
              style={filter === p ? {
                background: p === 'global' ? '#C8A040' : PLAYER_COLORS[p],
                borderColor: p === 'global' ? '#C8A040' : PLAYER_COLORS[p],
              } : {}}>
              {p === 'global' ? '🌐 Global' : p}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex gap-1 bg-surface border border-border rounded-xl p-1">
          {SORTS.map(s => (
            <button key={s.key} onClick={() => setSort(s.key)}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                sort === s.key ? 'bg-gold text-black' : 'text-ink-muted hover:text-ink-secondary'
              }`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <LeaderboardSkeleton />
        ) : (
        <div className="space-y-1.5">
          {sorted.length === 0 && (
            <div className="text-center py-10 text-ink-muted text-sm">
              No votes yet — start voting to see rankings!
            </div>
          )}
          {sorted.map(({ movie, r, wr, trend }, i) => (
            <motion.button
              key={movie.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.025, 0.4) }}
              onClick={() => openMovieModal(movie.id)}
              className="w-full flex items-center gap-3 p-3 bg-surface border border-border rounded-xl hover:border-gold/30 transition-colors text-left"
            >
              {/* Rank */}
              <div className="w-7 flex-shrink-0 text-center">
                {i < 3
                  ? <span className="text-base">{['🥇','🥈','🥉'][i]}</span>
                  : <span className="text-xs font-bold text-ink-muted font-mono">#{i+1}</span>}
              </div>

              {/* Poster */}
              <img src={movie.img} alt={movie.title} className="w-9 h-14 object-cover rounded-lg flex-shrink-0" />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-primary truncate">{movie.title}</p>
                <div className="flex gap-2 mt-0.5">
                  <span className="text-[10px] text-ink-muted">{r.wins}W · {r.matches} played</span>
                  <span className="text-[10px] text-ink-muted">{Math.round(wr * 100)}% WR</span>
                </div>
              </div>

              {/* ELO + trend */}
              <div className="text-right flex-shrink-0">
                <p className="text-gold font-bold font-mono text-sm">{r.elo}</p>
                {trend !== 0 && (
                  <p className={`text-[10px] font-semibold font-mono ${trend > 0 ? 'text-win' : 'text-lose'}`}>
                    {trend > 0 ? '▲' : '▼'}{Math.abs(trend)}
                  </p>
                )}
              </div>
            </motion.button>
          ))}
        </div>
        )}
      </div>
    </PageWrapper>
  )
}
