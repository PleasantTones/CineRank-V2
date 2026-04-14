import React, { useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PageWrapper from '../components/UI/PageWrapper'
import MatchupStats from '../components/Vote/MatchupStats'
import { openMovieModal } from '../components/UI/MovieModal'
import { showToast } from '../components/UI/Toast'
import { spawnConfetti } from '../components/UI/Confetti'
import { playPop } from '../lib/sounds'
import { useStore } from '../store/useStore'
import { MOVIES } from '../lib/movies'
import { pairKey } from '../lib/elo'
import { sbFetch } from '../lib/supabase'

const MILESTONES = [25, 50, 75, 100]
const MILESTONE_MSGS = {
  25:  '🎬 25% voted — keep rolling!',
  50:  '⚡ Halfway there! You\'re on fire.',
  75:  '🏆 75% done — almost legendary.',
  100: '👑 All pairs voted! You\'re a CineRank god.',
}

function pickPair(ratings, playedPairs) {
  const seen = MOVIES.filter(m => !ratings[m.id]?.unseen)
  if (seen.length < 2) return null
  const played = new Set(playedPairs || [])
  const unplayed = []
  for (let i = 0; i < seen.length; i++)
    for (let j = i + 1; j < seen.length; j++)
      if (!played.has(pairKey(seen[i].id, seen[j].id)))
        unplayed.push([seen[i], seen[j]])
  if (!unplayed.length) return null
  unplayed.sort(() => Math.random() - 0.5)
  return unplayed[0]
}

function MovieCard({ movie, rating, onPick, flash, h2h }) {
  return (
    <motion.div layout className="relative flex-1 rounded-2xl overflow-hidden" style={{ minHeight: 'calc(50dvh - 120px)', minWidth: 0 }}>
      {/* Poster — long press opens modal */}
      <img
        src={movie.img}
        alt={movie.title}
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
        onClick={() => openMovieModal(movie.id)}
      />

      {/* Gradient */}
      <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none" />

      {/* Win flash */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-win/12 border-2 border-win rounded-2xl pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Info overlay */}
      <div className="absolute inset-x-0 bottom-0 p-3 pointer-events-none">
        {h2h && (
          <div className="mb-1.5 inline-flex items-center gap-1 bg-black/60 rounded-lg px-2 py-1">
            <span className="text-[9px] text-gold/70">Last time:</span>
            <span className="text-[9px] font-semibold text-gold/90 truncate max-w-[80px]">{h2h} won</span>
          </div>
        )}
        <p className="text-white font-bold text-sm leading-snug line-clamp-2 drop-shadow-lg">{movie.title}</p>
        <p className="text-gold/80 text-[10px] font-semibold font-mono mt-0.5">{rating?.elo ?? 1000} ELO</p>
      </div>

      {/* Pick button — separate from poster tap */}
      <button
        onClick={onPick}
        className="absolute inset-x-3 bottom-3 py-3 bg-gold/15 hover:bg-gold/30 active:scale-95 border border-gold/35 rounded-xl text-gold text-xs font-bold tracking-wide transition-all"
        style={{ marginTop: 'auto' }}
      >
        Pick ✓
      </button>
    </motion.div>
  )
}

export default function Vote() {
  const { player, players, vote, muted } = useStore()
  const [streak, setStreak] = useState(0)
  const [flash, setFlash] = useState(null)
  const [voteCount, setVoteCount] = useState(0)
  const lastVoteRef = useRef(null)
  const prevPctRef = useRef(0)

  const pd = player ? players[player] : null
  const pair = useMemo(
    () => pd ? pickPair(pd.ratings, pd.playedPairs) : null,
    [pd?.playedPairs?.length, voteCount]
  )

  const seenCount = pd ? MOVIES.filter(m => !pd.ratings[m.id]?.unseen).length : 0
  const totalPairs = seenCount * (seenCount - 1) / 2
  const playedCount = pd?.playedPairs?.length ?? 0
  const remaining = Math.max(0, totalPairs - playedCount)
  const pct = totalPairs > 0 ? Math.min(100, Math.round(playedCount / totalPairs * 100)) : 0

  const handlePick = useCallback(async (winnerId) => {
    if (!pair || !player) return
    const loserId = pair.find(m => m.id !== winnerId).id
    const side = pair[0].id === winnerId ? 'a' : 'b'
    setFlash(side)
    lastVoteRef.current = { winnerId, loserId, pair: [...pair] }
    playPop(muted)
    if (navigator.vibrate) navigator.vibrate(25)

    setTimeout(() => {
      setFlash(null)
      vote(winnerId, loserId)
      const newStreak = streak + 1
      setStreak(newStreak)
      setVoteCount(c => c + 1)

      // Milestone check
      const newPct = Math.min(100, Math.round((playedCount + 1) / totalPairs * 100))
      const hit = MILESTONES.find(m => newPct >= m && prevPctRef.current < m)
      if (hit) {
        showToast(MILESTONE_MSGS[hit], 'gold')
        if (hit === 100) spawnConfetti()
      }
      prevPctRef.current = newPct

      // Streak toast
      if (newStreak === 5)  showToast('🔥 5 vote streak!', 'gold')
      if (newStreak === 10) showToast('⚡ 10 in a row!', 'gold')

      // Save matchup + updated ratings to DB
      const updatedRatings = players[player]?.ratings ?? {}
      Promise.all([
        sbFetch('/rest/v1/matchups', {
          method: 'POST', prefer: 'resolution=merge-duplicates',
          body: JSON.stringify({ id: `${player}_${pairKey(winnerId, loserId)}`, player, winner_id: winnerId, loser_id: loserId })
        }),
        sbFetch('/rest/v1/ratings', {
          method: 'POST', prefer: 'resolution=merge-duplicates',
          body: JSON.stringify([winnerId, loserId].map(id => ({
            id: `${player}_${id}`,
            player,
            movie_id: id,
            elo: updatedRatings[id]?.elo ?? 1000,
            wins: updatedRatings[id]?.wins ?? 0,
            losses: updatedRatings[id]?.losses ?? 0,
            matches: updatedRatings[id]?.matches ?? 0,
            unseen: false,
          })))
        }),
      ]).catch(() => {})
    }, 220)
  }, [pair, player, vote, streak, muted, playedCount, totalPairs])

  const handleSkip = useCallback(() => {
    setStreak(0)
    setVoteCount(c => c + 1)
    lastVoteRef.current = null
  }, [])

  const handleUndo = useCallback(() => {
    if (!lastVoteRef.current) return
    lastVoteRef.current = null
    setStreak(s => Math.max(0, s - 1))
    setVoteCount(c => Math.max(0, c - 1))
    showToast('↩ Vote undone')
  }, [])

  if (!player) return (
    <PageWrapper className="flex items-center justify-center p-8">
      <div className="text-center space-y-3 animate-fade-up">
        <div className="text-5xl">⚔️</div>
        <p className="text-ink-secondary text-sm">Select your profile above to start voting</p>
      </div>
    </PageWrapper>
  )

  if (!pair) return (
    <PageWrapper className="flex items-center justify-center p-8">
      <div className="text-center space-y-4 animate-fade-up">
        <div className="text-5xl">🎉</div>
        <h2 className="text-lg font-bold text-ink-primary">All caught up!</h2>
        <p className="text-sm text-ink-secondary max-w-xs">Voted on all {totalPairs} pairs. Mark more films as seen in My Movies to unlock new matchups.</p>
      </div>
    </PageWrapper>
  )

  const [movieA, movieB] = pair
  const h2hKey = pairKey(movieA.id, movieB.id)
  const h2hWinnerId = pd?.h2hHistory?.[h2hKey]
  const h2hWinner = h2hWinnerId ? MOVIES.find(m => m.id === h2hWinnerId)?.title : null

  return (
    <PageWrapper className="flex flex-col">
      <MatchupStats played={playedCount} remaining={remaining} pct={pct}
        ratingA={pd.ratings[movieA.id]} ratingB={pd.ratings[movieB.id]} />

      {/* Streak */}
      <AnimatePresence>
        {streak >= 3 && (
          <motion.div key="streak"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mx-4 mb-2 overflow-hidden">
            <div className="py-2 px-4 bg-gold/8 border border-gold/20 rounded-xl text-center">
              <span className="text-[11px] font-bold text-gold">🔥 {streak} vote streak</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* H2H badge */}
      {h2hWinner && (
        <div className="mx-4 mb-2 py-1.5 px-3 bg-raised border border-border/50 rounded-xl">
          <p className="text-[10px] text-ink-muted text-center">
            Last matchup: <span className="text-ink-secondary font-semibold">{h2hWinner}</span> won
          </p>
        </div>
      )}

      {/* Cards */}
      <AnimatePresence mode="wait">
        <motion.div key={`${movieA.id}-${movieB.id}`}
          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.16 }}
          className="flex-1 flex gap-2.5 px-3 pb-2 min-h-0">
          <MovieCard movie={movieA} rating={pd.ratings[movieA.id]} onPick={() => handlePick(movieA.id)}
            flash={flash === 'a'} h2h={h2hWinnerId === movieA.id ? null : null} />
          <div className="flex-shrink-0 self-center flex items-center justify-center w-7 h-7 rounded-full bg-base border border-border">
            <span className="text-[9px] font-black text-gold tracking-widest">VS</span>
          </div>
          <MovieCard movie={movieB} rating={pd.ratings[movieB.id]} onPick={() => handlePick(movieB.id)}
            flash={flash === 'b'} h2h={null} />
        </motion.div>
      </AnimatePresence>

      {/* Controls */}
      <div className="flex items-center justify-between px-4 pb-4 pt-1">
        <button onClick={handleUndo} disabled={!lastVoteRef.current}
          className="text-[11px] text-ink-muted border border-border rounded-lg px-3 py-2 hover:border-gold/30 hover:text-gold transition-all disabled:opacity-30">
          ↩ Undo
        </button>
        <p className="text-[9px] text-ink-muted">Tap poster for details</p>
        <button onClick={handleSkip}
          className="text-[11px] text-ink-muted hover:text-ink-secondary transition-colors px-3 py-2">
          Skip →
        </button>
      </div>
    </PageWrapper>
  )
}
