import React, { useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PageWrapper from '../components/UI/PageWrapper'
import MatchupStats from '../components/Vote/MatchupStats'
import { openMovieModal } from '../components/UI/MovieModal'
import PosterImage from '../components/UI/PosterImage'
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

function MovieCard({ movie, rating, onPick, onUnseen, flash }) {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      layout
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      animate={{
        y: hovered ? -4 : 0,
        boxShadow: hovered
          ? '0 16px 48px rgba(0,0,0,0.7), 0 0 60px rgba(200,160,64,0.08)'
          : '0 4px 16px rgba(0,0,0,0.5)',
      }}
      transition={{ duration: 0.2 }}
      className="relative flex-1 rounded-2xl overflow-hidden flex flex-col"
      style={{
        minWidth: 0,
        minHeight: 0,
        background: '#141416',
        border: flash ? '2px solid #4ADE80' : hovered ? '1px solid #6a5a20' : '1px solid #3a3010',
        alignSelf: 'stretch',
      }}
    >
      {/* Win flash overlay */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-win/10 z-10 pointer-events-none rounded-2xl"
          />
        )}
      </AnimatePresence>

      {/* Poster — zooms on hover, tap opens modal */}
      <div
        className="flex-1 overflow-hidden cursor-pointer flex items-center justify-center p-4 pb-3"
        onClick={() => openMovieModal(movie.id)}
        style={{ minHeight: 0 }}
      >
        <motion.div
          animate={{ scale: hovered ? 1.04 : 1 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ maxWidth: 200, width: '100%', aspectRatio: '2/3', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', flexShrink: 0 }}
        >
          <PosterImage
            movieId={movie.id}
            fallbackSrc={movie.img}
            alt={movie.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </motion.div>
      </div>

      {/* Info + buttons — always below poster, never overlapping */}
      <div className="flex flex-col gap-2 px-3 pb-3 flex-shrink-0">
        <div className="text-center">
          <p className="text-ink-primary font-semibold text-sm leading-snug line-clamp-2">
            {movie.title}
          </p>
          <p className="text-ink-muted text-[10px] font-mono mt-1">
            {rating?.elo ?? 1000} ELO
          </p>
        </div>

        {/* Pick button */}
        <button
          onClick={onPick}
          className="w-full py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95"
          style={{
            background: hovered
              ? 'linear-gradient(135deg, rgba(200,160,64,0.3), rgba(200,160,64,0.18))'
              : 'linear-gradient(135deg, rgba(200,160,64,0.18), rgba(200,160,64,0.08))',
            border: '1px solid rgba(200,160,64,0.45)',
            color: '#F0C048',
          }}
        >
          ✓ Pick this movie
        </button>

        {/* Haven't seen */}
        <button
          onClick={onUnseen}
          className="w-full py-2 rounded-xl text-[11px] font-medium transition-all active:scale-95 text-ink-muted hover:text-ink-secondary"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          Haven't seen this
        </button>
      </div>
    </motion.div>
  )
}

export default function Vote() {
  const { player, players, vote, undoVote, markUnseen, muted } = useStore()
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

    // Snapshot BEFORE vote for real undo
    const snapshot = {
      ratings: JSON.parse(JSON.stringify(pd.ratings)),
      playedPairs: [...(pd.playedPairs || [])],
      matchCount: pd.matchCount,
    }

    playPop(muted)
    if (navigator.vibrate) navigator.vibrate(25)

    setTimeout(() => {
      setFlash(null)
      vote(winnerId, loserId)
      lastVoteRef.current = snapshot
      const newStreak = streak + 1
      setStreak(newStreak)
      setVoteCount(c => c + 1)

      const newPct = Math.min(100, Math.round((playedCount + 1) / totalPairs * 100))
      const hit = MILESTONES.find(m => newPct >= m && prevPctRef.current < m)
      if (hit) {
        showToast(MILESTONE_MSGS[hit], 'gold')
        if (hit === 100) spawnConfetti()
      }
      prevPctRef.current = newPct
      if (newStreak === 5)  showToast('🔥 5 vote streak!', 'gold')
      if (newStreak === 10) showToast('⚡ 10 in a row!', 'gold')

      const updated = players[player]?.ratings ?? {}
      Promise.all([
        sbFetch('/rest/v1/matchups', {
          method: 'POST', prefer: 'resolution=merge-duplicates',
          body: JSON.stringify({ id: `${player}_${pairKey(winnerId, loserId)}`, player, winner_id: winnerId, loser_id: loserId })
        }),
        sbFetch('/rest/v1/ratings', {
          method: 'POST', prefer: 'resolution=merge-duplicates',
          body: JSON.stringify([winnerId, loserId].map(id => ({
            id: `${player}_${id}`, player, movie_id: id,
            elo: updated[id]?.elo ?? 1000, wins: updated[id]?.wins ?? 0,
            losses: updated[id]?.losses ?? 0, matches: updated[id]?.matches ?? 0, unseen: false,
          })))
        }),
      ]).catch(() => {})
    }, 220)
  }, [pair, player, vote, streak, muted, playedCount, totalPairs, pd])

  const handleUnseen = useCallback((movieId) => {
    markUnseen(movieId)
    setVoteCount(c => c + 1)
    showToast('Marked as unseen — skipping matchup')
  }, [markUnseen])

  const handleSkip = useCallback(() => {
    setStreak(0)
    setVoteCount(c => c + 1)
    lastVoteRef.current = null
  }, [])

  const handleUndo = useCallback(() => {
    const snap = lastVoteRef.current
    if (!snap || !player) return
    undoVote(player, snap.ratings, snap.playedPairs, snap.matchCount)
    lastVoteRef.current = null
    setStreak(s => Math.max(0, s - 1))
    setVoteCount(c => Math.max(0, c - 1))
    showToast('↩ Vote undone — ELO restored')
  }, [player, undoVote])

  if (!player) return (
    <PageWrapper scroll className="flex items-center justify-center p-8">
      <div className="text-center space-y-3 animate-fade-up">
        <div className="text-5xl">⚔️</div>
        <p className="text-ink-secondary text-sm">Select your profile above to start voting</p>
      </div>
    </PageWrapper>
  )

  if (!pair) return (
    <PageWrapper scroll className="flex items-center justify-center p-8">
      <div className="text-center space-y-4 animate-fade-up">
        <div className="text-5xl">🎉</div>
        <h2 className="text-lg font-bold text-ink-primary">All caught up!</h2>
        <p className="text-sm text-ink-secondary max-w-xs">
          Voted on all {totalPairs} pairs. Mark more films as seen in My Movies to unlock new matchups.
        </p>
      </div>
    </PageWrapper>
  )

  const [movieA, movieB] = pair
  const h2hKey = pairKey(movieA.id, movieB.id)
  const h2hWinnerId = pd?.h2hHistory?.[h2hKey]
  const h2hWinner = h2hWinnerId ? MOVIES.find(m => m.id === h2hWinnerId)?.title : null

  return (
    <PageWrapper scroll={false} className="flex flex-col">
      <MatchupStats played={playedCount} remaining={remaining} pct={pct}
        ratingA={pd.ratings[movieA.id]} ratingB={pd.ratings[movieB.id]} />

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

      {h2hWinner && (
        <div className="mx-4 mb-2 py-1.5 px-3 bg-raised border border-border/50 rounded-xl">
          <p className="text-[10px] text-ink-muted text-center">
            Last time: <span className="text-ink-secondary font-semibold">{h2hWinner}</span> won
          </p>
        </div>
      )}

      {/* H2H card row */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${movieA.id}-${movieB.id}`}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.18 }}
          className="flex-1 flex gap-3 px-3 pb-2 overflow-hidden"
          style={{ minHeight: 0 }}
        >
          <MovieCard movie={movieA} rating={pd.ratings[movieA.id]}
            onPick={() => handlePick(movieA.id)}
            onUnseen={() => handleUnseen(movieA.id)}
            flash={flash === 'a'} />

          <div className="flex-shrink-0 self-center flex items-center justify-center w-8 h-8 rounded-full"
            style={{ background: '#18181B', border: '1px solid #2A2A2E' }}>
            <span className="text-[9px] font-black text-gold tracking-widest">VS</span>
          </div>

          <MovieCard movie={movieB} rating={pd.ratings[movieB.id]}
            onPick={() => handlePick(movieB.id)}
            onUnseen={() => handleUnseen(movieB.id)}
            flash={flash === 'b'} />
        </motion.div>
      </AnimatePresence>

      {/* Controls */}
      <div className="flex items-center justify-between px-4 pb-3 pt-1">
        <button onClick={handleUndo} disabled={!lastVoteRef.current}
          className="text-[11px] text-ink-muted border border-border rounded-lg px-3 py-2 hover:border-gold/30 hover:text-gold transition-all disabled:opacity-25">
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
