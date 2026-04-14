import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PageWrapper from '../components/UI/PageWrapper'
import { openMovieModal } from '../components/UI/MovieModal'
import { MovieListSkeleton } from '../components/UI/Skeleton'
import { generateShareCard } from '../lib/shareCard'
import { useStore } from '../store/useStore'
import { MOVIES, PLAYER_COLORS, getAllMovies } from '../lib/movies'
import PosterImage from '../components/UI/PosterImage'

export default function MyMovies() {
  const { player, players, markSeen, markUnseen, dynamicMovies } = useStore()
  const allMovies = getAllMovies(dynamicMovies)
  const [tab, setTab] = useState('rankings') // rankings | seen | unseen
  const [search, setSearch] = useState('')
  const [seasonFilter, setSeasonFilter] = useState('all')

  const pd = player ? players[player] : null
  const ratings = pd?.ratings ?? {}

  // Build season list from dynamic movies (hardcoded movies have no season)
  const availableSeasons = ['all', ...new Set(
    dynamicMovies.filter(m => m.season).map(m => m.season)
  )].filter(Boolean)

  const SEASON_LABELS = {
    'all': 'All Seasons',
    '2025-winter': '2025 Winter', '2025-summer': '2025 Summer', '2025-fall': '2025 Fall',
    '2026-winter': '2026 Winter', '2026-summer': '2026 Summer', '2026-fall': '2026 Fall',
  }

  // Apply season filter — hardcoded movies (no season field) always show in "all"
  const visibleMovies = seasonFilter === 'all'
    ? allMovies
    : allMovies.filter(m => m.season === seasonFilter)

  const seen = [...visibleMovies].filter(m => !ratings[m.id]?.unseen).sort((a,b) => a.title.localeCompare(b.title))
  const unseen = [...visibleMovies].filter(m => ratings[m.id]?.unseen).sort((a,b) => a.title.localeCompare(b.title))
  const ranked = [...seen]
    .filter(m => ratings[m.id]?.matches > 0)
    .sort((a, b) => ratings[b.id].elo - ratings[a.id].elo)

  const filtered = (tab === 'rankings' ? ranked : tab === 'seen' ? seen : unseen)
    .filter(m => m.title.toLowerCase().includes(search.toLowerCase()))

  if (!player) {
    return (
      <PageWrapper className="flex items-center justify-center p-8">
        <div className="text-center space-y-2 animate-fade-up">
          <div className="text-5xl">🎬</div>
          <p className="text-ink-secondary text-sm">Select your profile to see your movies</p>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <div className="p-4 space-y-4">
        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: seasonFilter === 'all' ? 'Seen' : 'Seen (filtered)', value: seen.length },
            { label: 'Voted', value: pd?.matchCount ?? 0 },
            { label: 'Top ELO', value: ranked[0] ? ratings[ranked[0].id].elo : '—' },
          ].map(s => (
            <div key={s.label} className="bg-surface border border-border rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-gold font-mono">{s.value}</div>
              <div className="text-[10px] text-ink-muted mt-0.5 uppercase tracking-widest">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Season filter */}
        {availableSeasons.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-ink-muted flex-shrink-0">Season</span>
            <select
              value={seasonFilter}
              onChange={e => setSeasonFilter(e.target.value)}
              className="flex-1 text-xs font-semibold bg-surface border border-border rounded-xl px-3 py-2 text-ink-primary focus:outline-none focus:border-gold cursor-pointer"
            >
              {availableSeasons.map(s => (
                <option key={s} value={s}>{SEASON_LABELS[s] || s}</option>
              ))}
            </select>
          </div>
        )}

        {/* Taste profile */}
        {ranked.length >= 5 && (() => {
          const globalRanked = [...allMovies].filter(m => (players[Object.keys(players)[0]]?.ratings?.[m.id]?.matches||0) > 0)
          const myRanked = ranked.map(m => m.id)
          const diffs = myRanked.map((id, i) => {
            const gi = globalRanked.findIndex(m => m.id === id)
            return gi >= 0 ? Math.abs(i - gi) : 0
          })
          const avgDiff = diffs.reduce((a,b)=>a+b,0)/diffs.length
          const label = avgDiff <= 3 ? 'Crowd Pleaser 🍿' : avgDiff <= 7 ? 'Independent Thinker 🎭' : 'Full Contrarian 🔥'
          const totalM = Object.values(ratings).reduce((s,r)=>s+(r.matches||0),0)
          const totalW = Object.values(ratings).reduce((s,r)=>s+(r.wins||0),0)
          const wr = totalM > 0 ? Math.round(totalW/totalM*100) : 0
          return (
            <div className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="text-[10px] text-ink-muted uppercase tracking-widest mb-1">Taste profile</p>
                <p className="text-sm font-bold text-ink-primary">{label}</p>
                <p className="text-[10px] text-ink-muted mt-0.5">{wr}% overall win rate</p>
              </div>
              <button
                onClick={() => generateShareCard(player, ratings, {}, MOVIES)}
                className="flex-shrink-0 px-4 py-2.5 bg-gold text-black font-bold rounded-xl text-xs tracking-wide hover:bg-gold-bright active:scale-95 transition-all"
              >
                📤 Share Stats
              </button>
            </div>
          )
        })()}

        {/* Top 3 podium */}
        {ranked.length >= 3 && (
          <div className="bg-surface border border-border rounded-2xl p-4">
            <p className="text-[10px] font-bold text-ink-muted tracking-widest uppercase mb-3">Your Top 3</p>
            <div className="flex gap-3">
              {ranked.slice(0, 3).map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex-1 text-center"
                >
                  <div className="relative mx-auto w-16 h-24 rounded-xl overflow-hidden mb-2 hover:scale-105 transition-transform duration-200 cursor-pointer" onClick={() => openMovieModal(m.id)}>
                    <PosterImage movieId={m.id} fallbackSrc={m.img} alt={m.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div className="absolute top-1 left-1 text-sm">
                      {['🥇','🥈','🥉'][i]}
                    </div>
                  </div>
                  <p className="text-[10px] font-semibold text-ink-secondary leading-tight line-clamp-2">{m.title}</p>
                  <p className="text-[9px] text-gold font-mono mt-0.5">{ratings[m.id].elo}</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex gap-1 bg-surface border border-border rounded-xl p-1">
          {[
            { key: 'rankings', label: `Rankings (${ranked.length})` },
            { key: 'seen',     label: `Seen (${seen.length})` },
            { key: 'unseen',   label: `Unseen (${unseen.length})` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 rounded-lg text-[11px] font-semibold transition-all ${
                tab === t.key
                  ? 'bg-gold text-black'
                  : 'text-ink-muted hover:text-ink-secondary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search movies..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-ink-primary placeholder-ink-muted focus:outline-none focus:border-gold transition-colors"
        />

        {/* Movie list */}
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-8 text-ink-muted text-sm">
              {tab === 'rankings' ? 'Start voting to see your rankings!' : 'Nothing here yet'}
            </div>
          )}
          {filtered.map((movie, i) => {
            const r = ratings[movie.id]
            const isSeen = !r?.unseen
            return (
              <motion.div
                key={movie.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className="flex items-center gap-3 p-3 bg-surface border border-border rounded-xl hover:border-gold/30 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer" onClick={() => openMovieModal(movie.id)}
              >
                {tab === 'rankings' && (
                  <span className="text-xs font-bold text-ink-muted font-mono w-5 text-center flex-shrink-0">
                    {i < 3 ? ['🥇','🥈','🥉'][i] : `#${i+1}`}
                  </span>
                )}
                <PosterImage movieId={movie.id} fallbackSrc={movie.img} alt={movie.title} className="w-9 h-14 object-cover rounded-lg flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-primary truncate">{movie.title}</p>
                  {tab === 'rankings' && r?.matches > 0 && (
                    <p className="text-[10px] text-ink-muted mt-0.5">{r.wins}W · {r.matches} matchups</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {tab === 'rankings' && (
                    <span className="text-gold font-bold font-mono text-sm">{r?.elo ?? 1000}</span>
                  )}
                  <button
                    onClick={() => isSeen ? markUnseen(movie.id) : markSeen(movie.id)}
                    className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${
                      isSeen
                        ? 'border-border text-ink-muted hover:border-lose/50 hover:text-lose'
                        : 'border-win/40 text-win bg-win/10 hover:bg-win/20'
                    }`}
                  >
                    {isSeen ? 'Unsee' : 'Seen ✓'}
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </PageWrapper>
  )
}
