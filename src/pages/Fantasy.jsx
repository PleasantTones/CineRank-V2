import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PageWrapper from '../components/UI/PageWrapper'
import PosterImage from '../components/UI/PosterImage'
import { openMovieModal } from '../components/UI/MovieModal'
import { useStore } from '../store/useStore'
import { MOVIES, PLAYERS, PLAYER_COLORS, getAllMovies } from '../lib/movies'
import { sbFetch } from '../lib/supabase'
import { fetchBatchFinancials, formatMoney, getTMDBKey } from '../lib/tmdb'

// ── Draft constants ───────────────────────────────────────────────────────────
const ROUNDS = 6
const PICKS_PER_ROUND = PLAYERS.length  // 5
const TOTAL_PICKS = ROUNDS * PICKS_PER_ROUND  // 30
const SEASON_PICKS_PER_PLAYER = 4
const PICK_TYPES = {
  season:    { label: 'Season Pick',   icon: '🎬', color: '#C8A040' },
  bomb:      { label: 'Bomb Pick',     icon: '💣', color: '#ef4444' },
  alternate: { label: 'Alternate',     icon: '🔄', color: '#60a5fa' },
}

// ── Snake draft helpers ───────────────────────────────────────────────────────
function getPickerIndex(pickIndex, numPlayers) {
  const round = Math.floor(pickIndex / numPlayers)
  const pos   = pickIndex % numPlayers
  return round % 2 === 0 ? pos : numPlayers - 1 - pos
}

function getRound(pickIndex, numPlayers) {
  return Math.floor(pickIndex / numPlayers) + 1  // 1-indexed
}

// ── Season selector ───────────────────────────────────────────────────────────
const COMMISSIONER = 'Gabe'  // only the commissioner can start/manage drafts
const CURRENT_SEASON = '2026-winter'
const SEASON_LABELS = {
  '2025-winter': '2025 Winter', '2025-summer': '2025 Summer', '2025-fall': '2025 Fall',
  '2026-winter': '2026 Winter', '2026-summer': '2026 Summer', '2026-fall': '2026 Fall',
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Fantasy() {
  const { player, dynamicMovies } = useStore()
  const allMovies = getAllMovies(dynamicMovies)

  const [view, setView] = useState('home')      // home | setup | draft | slate
  const [session, setSession] = useState(null)  // active draft session
  const [picks, setPicks] = useState([])        // all picks so far
  const [pickingSeason, setPickingSeason] = useState(CURRENT_SEASON)
  const [draftOrder, setDraftOrder] = useState([...PLAYERS])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedMovie, setSelectedMovie] = useState(null)
  const [selectedPickType, setSelectedPickType] = useState(null)
  const [pastDrafts, setPastDrafts] = useState([])
  const [viewingDraft, setViewingDraft] = useState(null)
  const [financials, setFinancials] = useState({})  // movieId -> tmdb data
  const [scoringLoading, setScoringLoading] = useState(false)
  const pollRef = useRef(null)
  const timerRef = useRef(null)
  const autoPickRef = useRef(null)  // holds latest autoPickRandom to avoid TDZ in effects
  const [timeLeft, setTimeLeft] = useState(180)  // 3 min per pick

  // ── Load active session ───────────────────────────────────────────────────
  const loadSession = useCallback(async () => {
    try {
      const sessions = await sbFetch('/rest/v1/draft_sessions?status=eq.active&order=created_at.desc&limit=1')
      const past     = await sbFetch('/rest/v1/draft_sessions?status=eq.complete&order=created_at.desc&limit=10')
      setPastDrafts(past || [])
      if (sessions?.length) {
        const s = sessions[0]
        setSession(s)
        const p = await sbFetch(`/rest/v1/draft_picks?session_id=eq.${s.id}&order=pick_index.asc`)
        setPicks(p || [])
        setView('draft')
      }
    } catch(e) {
      setError('Could not connect. Make sure the draft tables exist in Supabase.')
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadSession() }, [loadSession])

  // Load TMDB financials for all picks in a draft
  const loadScoring = useCallback(async (draftPicks, movies) => {
    if (!getTMDBKey() || !draftPicks.length) return
    setScoringLoading(true)
    const uniqueIds = [...new Set(draftPicks.map(p => p.movie_id))]
    const movieList = uniqueIds.map(id => movies.find(m => m.id === id)).filter(Boolean)
    const data = await fetchBatchFinancials(movieList)
    setFinancials(data)
    setScoringLoading(false)
  }, [])

  // Reset timer whenever the current pick index changes
  useEffect(() => {
    setTimeLeft(180)
    setSelectedMovie(null)
    setSelectedPickType(null)
  }, [session?.current_pick_index])

  // Countdown timer — ticks every second, auto-picks on expiry
  // Uses autoPickRef so we don't need autoPickRandom in deps (avoids TDZ)
  useEffect(() => {
    if (view !== 'draft' || !session) return
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          autoPickRef.current?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [view, session?.current_pick_index])

  // Poll for updates when draft is active
  useEffect(() => {
    if (view !== 'draft' || !session) return
    pollRef.current = setInterval(async () => {
      try {
        const s = await sbFetch(`/rest/v1/draft_sessions?id=eq.${session.id}&limit=1`)
        const p = await sbFetch(`/rest/v1/draft_picks?session_id=eq.${session.id}&order=pick_index.asc`)
        if (s?.[0]) setSession(s[0])
        if (p) setPicks(p)
      } catch {}
    }, 4000)
    return () => clearInterval(pollRef.current)
  }, [view, session?.current_pick_index])

  // ── Draft state derivations ───────────────────────────────────────────────
  // draft_order is JSONB — Supabase returns it as a JS array directly (no JSON.parse needed)
  const rawOrder = session?.draft_order
  const draftPlayers = (Array.isArray(rawOrder) && rawOrder.length > 0) ? rawOrder
    : (typeof rawOrder === 'string' ? (() => { try { return JSON.parse(rawOrder) } catch { return draftOrder } })() : draftOrder)
  const currentPickIndex = session?.current_pick_index ?? 0
  const currentRound = getRound(currentPickIndex, draftPlayers.length)
  const currentPickerIdx = getPickerIndex(currentPickIndex, draftPlayers.length)
  const currentPicker = draftPlayers[currentPickerIdx]
  const isMyTurn = currentPicker === player
  const isDraftComplete = session?.status === 'complete' || currentPickIndex >= TOTAL_PICKS
  const isCommissioner = player === COMMISSIONER

  // Count pick types already used by each player
  function getPlayerPickTypeCounts(playerName) {
    const p = picks.filter(pk => pk.player === playerName)
    return {
      season:    p.filter(pk => pk.pick_type === 'season').length,
      bomb:      p.filter(pk => pk.pick_type === 'bomb').length,
      alternate: p.filter(pk => pk.pick_type === 'alternate').length,
    }
  }
  // Calculate fantasy scores for all players
  function calcScores(draftPicks, players, fin) {
    const scores = {}
    players.forEach(p => { scores[p] = { total: 0, seasonProfit: 0, bombEffect: 0, picks: [] } })

    // Season picks: profit goes to the player
    draftPicks.filter(pk => pk.pick_type === 'season').forEach(pk => {
      const f = fin[pk.movie_id]
      if (f?.profit != null) {
        scores[pk.player].seasonProfit += f.profit
        scores[pk.player].total += f.profit
      }
    })

    // Bomb picks: profit goes to ALL OTHER players
    draftPicks.filter(pk => pk.pick_type === 'bomb').forEach(pk => {
      const f = fin[pk.movie_id]
      if (f?.profit != null) {
        players.filter(p => p !== pk.player).forEach(other => {
          scores[other].bombEffect += f.profit
          scores[other].total += f.profit
        })
      }
    })

    return Object.entries(scores)
      .map(([player, s]) => ({ player, ...s }))
      .sort((a, b) => b.total - a.total)
  }

  const myTypeCounts = getPlayerPickTypeCounts(player)
  const availablePickTypes = [
    { type: 'season',    remaining: 4 - myTypeCounts.season    },
    { type: 'bomb',      remaining: 1 - myTypeCounts.bomb      },
    { type: 'alternate', remaining: 1 - myTypeCounts.alternate },
  ].filter(t => t.remaining > 0)

  const pickedMovieIds = new Set(picks.map(p => p.movie_id))
  const availableMovies = allMovies.filter(m => !pickedMovieIds.has(m.id))
  const myPicks = picks.filter(p => p.player === player)

  function getPlayerPicks(playerName) {
    return picks.filter(p => p.player === playerName)
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  const startDraft = async () => {
    setError('')
    try {
      const id = `draft_${pickingSeason}_${Date.now()}`
      await sbFetch('/rest/v1/draft_sessions', {
        method: 'POST', prefer: 'resolution=merge-duplicates',
        body: JSON.stringify({
          id, season: pickingSeason,
          draft_order: draftOrder,  // JSONB — store as array directly, not double-stringified
          current_pick_index: 0,
          status: 'active',
        }),
      })
      await loadSession()
    } catch(e) {
      setError('Failed to start draft: ' + e.message)
    }
  }

  const makePick = async (movie) => {
    if (!isMyTurn || isDraftComplete || !session || !selectedPickType) return
    try {
      const pickId = `${session.id}_${currentPickIndex}`
      await sbFetch('/rest/v1/draft_picks', {
        method: 'POST', prefer: 'resolution=merge-duplicates',
        body: JSON.stringify({
          id: pickId,
          session_id: session.id,
          pick_index: currentPickIndex,
          player: player,
          movie_id: movie.id,
          pick_type: selectedPickType,
          round: currentRound,
        }),
      })
      // Advance pick index
      const nextIdx = currentPickIndex + 1
      const newStatus = nextIdx >= TOTAL_PICKS ? 'complete' : 'active'
      await sbFetch(`/rest/v1/draft_sessions?id=eq.${session.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ current_pick_index: nextIdx, status: newStatus }),
      })
      setSelectedMovie(null)
      setSelectedPickType(null)
      await loadSession()
    } catch(e) {
      setError('Pick failed: ' + e.message)
    }
  }

  const autoPickRandom = useCallback(async () => {
    if (!session || isDraftComplete) return
    // Guard: re-check that the pick index hasn't already advanced (another client may have picked)
    try {
      const latest = await sbFetch(`/rest/v1/draft_sessions?id=eq.${session.id}&limit=1`)
      if (latest?.[0]?.current_pick_index !== currentPickIndex) return  // already picked
    } catch { return }
    const available = allMovies.filter(m => !pickedMovieIds.has(m.id))
    if (!available.length) return
    const randomMovie = available[Math.floor(Math.random() * available.length)]
    // Pick whatever type has remaining slots — priority: season → bomb → alternate
    const counts = getPlayerPickTypeCounts(currentPicker)
    let autoType = 'season'
    if (counts.season >= 4) autoType = counts.bomb < 1 ? 'bomb' : 'alternate'
    try {
      const pickId = `${session.id}_${currentPickIndex}`
      await sbFetch('/rest/v1/draft_picks', {
        method: 'POST', prefer: 'resolution=merge-duplicates',
        body: JSON.stringify({
          id: pickId, session_id: session.id,
          pick_index: currentPickIndex, player: currentPicker,
          movie_id: randomMovie.id, pick_type: autoType,
          round: currentRound,
        }),
      })
      const nextIdx = currentPickIndex + 1
      const newStatus = nextIdx >= TOTAL_PICKS ? 'complete' : 'active'
      await sbFetch(`/rest/v1/draft_sessions?id=eq.${session.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ current_pick_index: nextIdx, status: newStatus }),
      })
      setSelectedMovie(null); setSelectedPickType(null)
      await loadSession()
    } catch(e) { setError('Auto-pick failed: ' + e.message) }
  }, [session, isDraftComplete, allMovies, pickedMovieIds, currentPicker, currentPickIndex, currentRound])
  // Keep ref in sync with latest autoPickRandom so the timer effect always calls fresh version
  autoPickRef.current = autoPickRandom

  const reorderPlayer = (from, to) => {
    const order = [...draftOrder]
    const [moved] = order.splice(from, 1)
    order.splice(to, 0, moved)
    setDraftOrder(order)
  }

  // ── Views ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <PageWrapper>
      <div className="flex items-center justify-center h-full">
        <div className="text-ink-muted text-sm animate-pulse">Loading draft…</div>
      </div>
    </PageWrapper>
  )

  // ── LOBBY (always the landing page) ─────────────────────────────────────
  const activePicker = session && !isDraftComplete ? currentPicker : null
  const draftProgress = session ? `${Math.min(currentPickIndex, TOTAL_PICKS)}/${TOTAL_PICKS} picks` : null

  if (view === 'home') return (
    <PageWrapper>
      <div className="p-4 space-y-4">
        <div className="pt-1">
          <h1 className="text-xl font-black text-ink-primary">Fantasy Draft</h1>
          <p className="text-xs text-ink-muted">Snake draft · 6 picks per player · Commissioner: {COMMISSIONER}</p>
        </div>

        {error && <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-3 text-xs text-red-300">{error}</div>}

        {/* ── Active Draft Lobby Card ── */}
        {session && !isDraftComplete ? (
          <div className="bg-surface border border-gold/30 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between" style={{ background: 'rgba(200,160,64,0.07)' }}>
              <div>
                <p className="text-[10px] font-bold text-gold uppercase tracking-widest">Draft In Progress</p>
                <p className="text-sm font-black text-ink-primary">{SEASON_LABELS[session.season]}</p>
              </div>
              <span className="text-xs text-ink-muted font-mono">{draftProgress}</span>
            </div>
            {/* Pick order strip */}
            <div className="px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar">
              {draftPlayers.map((p, i) => {
                const isNow = p === activePicker
                return (
                  <div key={p} className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all ${
                    isNow ? 'border-gold/60 bg-gold/10' : 'border-border bg-raised'
                  }`}>
                    <div className="w-2 h-2 rounded-full" style={{ background: PLAYER_COLORS[p] }} />
                    <p className="text-[10px] font-bold" style={{ color: isNow ? PLAYER_COLORS[p] : '#606060' }}>{p}</p>
                    <p className="text-[9px] text-ink-muted">{getPlayerPicks(p).length}/6</p>
                  </div>
                )
              })}
            </div>
            <div className="px-4 pb-3">
              {activePicker && (
                <p className="text-xs text-ink-muted mb-3 text-center">
                  {activePicker === player
                    ? <span className="text-gold font-bold">⚡ It's your turn to pick!</span>
                    : <span>Waiting on <span className="font-bold" style={{ color: PLAYER_COLORS[activePicker] }}>{activePicker}</span>…</span>
                  }
                </p>
              )}
              <button onClick={() => setView('draft')}
                className="w-full py-3 bg-gold text-black font-black rounded-xl text-sm">
                {activePicker === player ? '🎯 Pick Now →' : '👀 Watch Draft →'}
              </button>
            </div>
          </div>
        ) : isDraftComplete ? (
          <div className="bg-surface border border-border rounded-2xl p-4 text-center space-y-3">
            <p className="text-sm font-bold text-ink-primary">✅ Draft Complete — {SEASON_LABELS[session?.season]}</p>
            <button onClick={() => setView('slate')}
              className="w-full py-3 bg-gold text-black font-black rounded-xl text-sm">View Slates →</button>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-2xl p-4 text-center space-y-2">
            <p className="text-2xl">🎬</p>
            <p className="text-sm font-bold text-ink-primary">No active draft</p>
            {isCommissioner
              ? <p className="text-xs text-ink-muted">Start a draft below to get everyone in.</p>
              : <p className="text-xs text-ink-muted">Waiting for <span className="font-bold text-gold">{COMMISSIONER}</span> to start the draft.</p>
            }
          </div>
        )}

        {/* ── Commissioner controls ── */}
        {isCommissioner && !session && (
          <button onClick={() => setView('setup')}
            className="w-full py-4 bg-gold text-black font-black rounded-2xl text-base">
            🎬 Start New Draft
          </button>
        )}

        {/* ── How it works ── */}
        <div className="bg-surface border border-border rounded-2xl p-4 space-y-2">
          <p className="text-xs font-bold text-ink-muted uppercase tracking-widest mb-3">How it works</p>
          <div className="flex items-start gap-2">
            <span className="text-lg">🎬</span>
            <div><p className="text-sm font-semibold text-ink-primary">4 Season Picks</p><p className="text-xs text-ink-muted">Box office earnings count toward your total profit</p></div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-lg">💣</span>
            <div><p className="text-sm font-semibold text-ink-primary">1 Bomb Pick</p><p className="text-xs text-ink-muted">Earns/loses for all other players. Pick a real bomb to hurt them.</p></div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-lg">🔄</span>
            <div><p className="text-sm font-semibold text-ink-primary">1 Alternate Pick</p><p className="text-xs text-ink-muted">Backup if one of your picks is pulled or moved seasons</p></div>
          </div>
          <div className="mt-2 pt-2 border-t border-border">
            <p className="text-xs text-ink-muted">Snake format — order reverses each round. Choose your pick type freely on each turn.</p>
          </div>
        </div>

        {/* ── Past drafts ── */}
        {pastDrafts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-ink-muted uppercase tracking-widest">Past Drafts</p>
            {pastDrafts.map(d => (
              <button key={d.id} onClick={async () => {
                const p = await sbFetch(`/rest/v1/draft_picks?session_id=eq.${d.id}&order=pick_index.asc`)
                setSession(d); setPicks(p||[]); setViewingDraft(d); setView('slate')
              }} className="w-full text-left bg-surface border border-border rounded-2xl p-3 hover:border-gold/30">
                <p className="text-sm font-bold text-ink-primary">{SEASON_LABELS[d.season] || d.season}</p>
                <p className="text-xs text-ink-muted">{new Date(d.created_at).toLocaleDateString()}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  )

  // ── SETUP ─────────────────────────────────────────────────────────────────
  // Guard: only commissioner can access setup
  if (view === 'setup' && !isCommissioner) {
    setView('home')
    return null
  }
  if (view === 'setup') return (
    <PageWrapper>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('home')} className="text-ink-muted text-sm py-2 pr-3">← Lobby</button>
          <h2 className="text-lg font-black">New Draft</h2>
        </div>
        {error && <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-3 text-xs text-red-300">{error}</div>}

        {/* Season */}
        <div className="bg-surface border border-border rounded-2xl p-4">
          <p className="text-xs font-bold text-ink-muted uppercase tracking-widest mb-3">Season</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(SEASON_LABELS).map(([id, label]) => (
              <button key={id} onClick={() => setPickingSeason(id)}
                className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                  pickingSeason === id ? 'bg-gold text-black border-gold' : 'bg-raised border-border text-ink-muted'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Draft order */}
        <div className="bg-surface border border-border rounded-2xl p-4">
          <p className="text-xs font-bold text-ink-muted uppercase tracking-widest mb-1">Draft Order</p>
          <p className="text-[11px] text-ink-muted mb-3">Tap ↑↓ to reorder. Snake format — reverses each round.</p>
          <div className="space-y-2">
            {draftOrder.map((p, i) => (
              <div key={p} className="flex items-center gap-3 bg-raised rounded-xl p-3">
                <span className="w-5 text-center text-xs font-bold text-ink-muted font-mono">{i+1}</span>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PLAYER_COLORS[p] }} />
                <span className="flex-1 text-sm font-semibold text-ink-primary">{p}</span>
                <div className="flex gap-1">
                  <button onClick={() => i > 0 && reorderPlayer(i, i-1)}
                    disabled={i===0}
                    className="w-7 h-7 rounded-lg bg-surface border border-border text-xs disabled:opacity-30">↑</button>
                  <button onClick={() => i < draftOrder.length-1 && reorderPlayer(i, i+1)}
                    disabled={i===draftOrder.length-1}
                    className="w-7 h-7 rounded-lg bg-surface border border-border text-xs disabled:opacity-30">↓</button>
                </div>
              </div>
            ))}
          </div>
          {/* Preview snake order */}
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-[10px] font-bold text-ink-muted mb-1.5">SNAKE PREVIEW (first 2 rounds)</p>
            <div className="flex flex-wrap gap-1">
              {[...draftOrder, ...[...draftOrder].reverse()].map((p, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: PLAYER_COLORS[p] + '22', color: PLAYER_COLORS[p], border: `1px solid ${PLAYER_COLORS[p]}44` }}>
                  {i+1}. {p}
                </span>
              ))}
            </div>
          </div>
        </div>

        <button onClick={startDraft}
          className="w-full py-4 bg-gold text-black font-black rounded-2xl text-base">
          Begin Draft →
        </button>
      </div>
    </PageWrapper>
  )

  // ── DRAFT BOARD ───────────────────────────────────────────────────────────
  if (view === 'draft') {
    const roundLabel = `Round ${currentRound}`
    const pickTypeInfo = selectedPickType ? PICK_TYPES[selectedPickType] : null

    return (
      <PageWrapper>
        <div className="p-3 space-y-3">
          {/* Back to lobby */}
          <button onClick={() => setView('home')}
            className="flex items-center gap-1 text-xs text-ink-muted py-1 hover:text-ink-primary transition-colors">
            ← Lobby
          </button>

          {error && <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-2 text-xs text-red-300">{error}</div>}

          {/* Draft status bar */}
          <div className="bg-surface border border-border rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-bold text-ink-muted uppercase tracking-widest">{SEASON_LABELS[session?.season]} · {roundLabel}</p>
                <p className="text-sm font-black text-ink-primary mt-0.5">
                  Pick {Math.min(currentPickIndex + 1, TOTAL_PICKS)}/{TOTAL_PICKS}
                </p>
              </div>
              <div className="text-right flex flex-col items-end gap-0.5">
                <p className="text-xs text-ink-muted font-mono">R{currentRound}</p>
                {!isDraftComplete && (
                  <div className={`text-base font-black font-mono tabular-nums ${
                    timeLeft <= 30 ? 'text-red-400' : timeLeft <= 60 ? 'text-yellow-400' : 'text-win'
                  }`}>
                    {String(Math.floor(timeLeft/60)).padStart(2,'0')}:{String(timeLeft%60).padStart(2,'0')}
                  </div>
                )}
              </div>
            </div>

            {isDraftComplete ? (
              <div className="text-center py-2">
                <p className="text-sm font-bold text-win">✅ Draft Complete!</p>
                <button onClick={() => setView('slate')} className="mt-2 px-4 py-2 bg-gold text-black font-bold rounded-xl text-sm">View All Slates</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {isMyTurn ? (
                  <div className="flex-1 bg-gold/10 border border-gold/30 rounded-xl px-3 py-2 text-center">
                    <p className="text-xs text-gold font-black">🎯 YOUR TURN{selectedPickType ? ` — ${PICK_TYPES[selectedPickType].icon} ${PICK_TYPES[selectedPickType].label}` : ' — Choose pick type below'}</p>
                  </div>
                ) : (
                  <div className="flex-1 bg-raised rounded-xl px-3 py-2 text-center">
                    <p className="text-xs text-ink-muted">Waiting for <span className="font-bold" style={{ color: PLAYER_COLORS[currentPicker] }}>{currentPicker}</span>…</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Timer progress bar */}
          {!isDraftComplete && (
            <div className="h-1 bg-surface rounded-full overflow-hidden -mt-1">
              <div className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${(timeLeft/180)*100}%`,
                  background: timeLeft <= 30 ? '#ef4444' : timeLeft <= 60 ? '#f59e0b' : '#34d399'
                }} />
            </div>
          )}

          {/* Pick order strip */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {draftPlayers.map((p, i) => {
              const isActive = i === currentPickerIdx && !isDraftComplete
              const playerPicks = getPlayerPicks(p)
              return (
                <div key={p} className={`flex-shrink-0 flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl border transition-all ${
                  isActive ? 'border-gold/60 bg-gold/10' : 'border-border bg-surface'
                }`}>
                  <div className="w-2 h-2 rounded-full" style={{ background: PLAYER_COLORS[p] }} />
                  <p className="text-[10px] font-bold" style={{ color: isActive ? PLAYER_COLORS[p] : '#606060' }}>{p}</p>
                  <div className="flex gap-0.5">
                    {Array.from({length: 6}).map((_, j) => {
                      const pick = playerPicks[j]
                      return (
                        <div key={j} className="w-2 h-2 rounded-sm" style={{
                          background: pick ? PICK_TYPES[pick.pick_type].color : 'rgba(80,80,80,0.3)'
                        }} />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* My slate so far */}
          {myPicks.length > 0 && (
            <div className="bg-surface border border-border rounded-2xl p-3">
              <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2">Your Slate ({myPicks.length}/6)</p>
              <div className="grid grid-cols-3 gap-2">
                {myPicks.map(pick => {
                  const movie = allMovies.find(m => m.id === pick.movie_id)
                  const pt = PICK_TYPES[pick.pick_type]
                  return (
                    <div key={pick.id} className="flex flex-col items-center gap-1">
                      <div className="relative">
                        <PosterImage movieId={pick.movie_id} imdbId={movie?.imdbId} tmdbId={movie?.tmdbId} fallbackSrc={movie?.img}
                          className="w-14 h-20 object-cover rounded-lg" />
                        <span className="absolute -top-1 -right-1 text-sm">{pt.icon}</span>
                      </div>
                      <p className="text-[10px] text-center text-ink-muted leading-tight line-clamp-2">{movie?.title}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Available movies */}
          {!isDraftComplete && isMyTurn && (
            <div className="bg-surface border border-gold/20 rounded-2xl p-3">
              {/* Pick type selector */}
              {!selectedPickType ? (
                <div className="mb-3">
                  <p className="text-[10px] font-bold text-gold uppercase tracking-widest mb-2">What are you picking?</p>
                  <div className="flex gap-2">
                    {availablePickTypes.map(({ type, remaining }) => {
                      const pt = PICK_TYPES[type]
                      return (
                        <button key={type} onClick={() => setSelectedPickType(type)}
                          className="flex-1 py-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all active:scale-95"
                          style={{ borderColor: pt.color + '50', background: pt.color + '10' }}>
                          <span className="text-xl">{pt.icon}</span>
                          <span className="text-[11px] font-bold" style={{ color: pt.color }}>{pt.label}</span>
                          <span className="text-[10px] text-ink-muted">{remaining} left</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: PICK_TYPES[selectedPickType].color }}>
                    {PICK_TYPES[selectedPickType].icon} {PICK_TYPES[selectedPickType].label} — Choose a movie
                  </p>
                  <button onClick={() => { setSelectedPickType(null); setSelectedMovie(null) }}
                    className="text-[10px] text-ink-muted hover:text-ink-primary px-2 py-1 rounded-lg border border-border">
                    Change type
                  </button>
                </div>
              )}
              {selectedPickType && <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                {availableMovies.map(movie => {
                  const isSelected = selectedMovie?.id === movie.id
                  return (
                    <div key={movie.id} className={`flex flex-col items-center gap-1 transition-all ${
                      isSelected ? 'scale-95 opacity-100' : 'opacity-80 hover:opacity-100'
                    }`}>
                      <div className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                        isSelected ? 'border-gold' : 'border-transparent'
                      }`}
                        onClick={() => setSelectedMovie(movie)}
                        style={{ cursor: 'pointer' }}
                      >
                        <PosterImage movieId={movie.id} imdbId={movie?.imdbId} tmdbId={movie?.tmdbId} fallbackSrc={movie?.img} className="w-16 h-24 object-cover" />
                        {/* Info button overlay */}
                        <button
                          onClick={e => { e.stopPropagation(); openMovieModal(movie.id) }}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center text-[9px] text-white font-bold hover:bg-black/90 transition-colors"
                          style={{ lineHeight: 1 }}
                        >ℹ</button>
                      </div>
                      <p className="text-[9px] text-center text-ink-muted leading-tight line-clamp-2 w-16">{movie.title}</p>
                    </div>
                  )
                })}
              </div>

              }
              {selectedMovie && selectedPickType && (
                <div className="mt-3 pt-3 border-t border-border flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-ink-primary truncate">{selectedMovie.title}</p>
                    <p className="text-xs text-ink-muted">{PICK_TYPES[selectedPickType].icon} {PICK_TYPES[selectedPickType].label}</p>
                  </div>
                  <button onClick={() => makePick(selectedMovie)}
                    className="flex-shrink-0 px-5 py-2.5 bg-gold text-black font-black rounded-xl">
                    Draft! →
                  </button>
                </div>
              )}
            </div>
          )}

          {!isDraftComplete && !isMyTurn && (
            <div className="bg-surface border border-border rounded-2xl p-3">
              <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2">All Available ({availableMovies.length})</p>
              <div className="grid grid-cols-5 gap-1.5 max-h-48 overflow-y-auto">
                {availableMovies.slice(0, 25).map(movie => (
                  <div key={movie.id} className="flex flex-col items-center gap-0.5 opacity-60 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => openMovieModal(movie.id)}>
                    <PosterImage movieId={movie.id} imdbId={movie?.imdbId} tmdbId={movie?.tmdbId} fallbackSrc={movie?.img} className="w-12 h-16 object-cover rounded-lg" />
                    <p className="text-[8px] text-center text-ink-muted leading-tight line-clamp-1 w-12">{movie.title}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </PageWrapper>
    )
  }

  // ── SLATE VIEW ────────────────────────────────────────────────────────────
  if (view === 'slate') {
    const slateSession = viewingDraft || session
    const slatePlayers = slateSession ? JSON.parse(slateSession.draft_order) : draftPlayers

    return (
      <PageWrapper>
        <div className="p-3 space-y-3">
          <div className="flex items-center gap-3">
            <button onClick={() => { setViewingDraft(null); setView(session?.status === 'active' ? 'draft' : 'home') }}
              className="text-ink-muted text-sm py-2 pr-3">← Back</button>
            <div className="flex-1">
              <h2 className="text-base font-black">{SEASON_LABELS[slateSession?.season]} Draft</h2>
            </div>
            {getTMDBKey() && (
              <button onClick={() => loadScoring(picks, allMovies)} disabled={scoringLoading}
                className="px-3 py-1.5 bg-gold/10 border border-gold/30 rounded-xl text-xs font-bold text-gold disabled:opacity-50">
                {scoringLoading ? 'Loading…' : '📊 Score'}
              </button>
            )}
          </div>

          {/* Scoring standings */}
          {Object.keys(financials).length > 0 && (() => {
            const ranked = calcScores(picks, slatePlayers, financials)
            return (
              <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border" style={{ background: '#111113' }}>
                  <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">Fantasy Standings</p>
                  <p className="text-[9px] text-ink-muted">Revenue − (2× budget). Bomb picks go to other players.</p>
                </div>
                {ranked.map((row, i) => (
                  <div key={row.player} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0"
                    style={{ background: i === 0 ? 'rgba(200,160,64,0.06)' : undefined }}>
                    <span className="text-sm font-black text-ink-muted w-5 font-mono">{i + 1}</span>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PLAYER_COLORS[row.player] }} />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-ink-primary">{row.player}</p>
                      <p className="text-[10px] text-ink-muted">
                        Picks: {row.seasonProfit !== 0 ? formatMoney(row.seasonProfit) : '—'}
                        {row.bombEffect !== 0 ? ` · Bomb: ${row.bombEffect > 0 ? '+' : ''}${formatMoney(row.bombEffect)}` : ''}
                      </p>
                    </div>
                    <span className={`text-base font-black font-mono ${row.total >= 0 ? 'text-win' : 'text-lose'}`}>
                      {row.total >= 0 ? '+' : ''}{formatMoney(row.total) || '$0'}
                    </span>
                  </div>
                ))}
                {!getTMDBKey() && (
                  <p className="text-xs text-ink-muted text-center py-3">Add TMDB API key in /admin to see scores</p>
                )}
              </div>
            )
          })()}

          {slatePlayers.map(p => {
            const pPicks = picks.filter(pk => pk.player === p)
            const seasonPicks = pPicks.filter(pk => pk.pick_type === 'season')
            const bombPick   = pPicks.find(pk => pk.pick_type === 'bomb')
            const altPick    = pPicks.find(pk => pk.pick_type === 'alternate')

            return (
              <div key={p} className="bg-surface border border-border rounded-2xl p-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: PLAYER_COLORS[p] }} />
                  <p className="font-black text-ink-primary">{p}</p>
                  <span className="text-xs text-ink-muted ml-auto">{pPicks.length}/6 picks</span>
                </div>

                <div className="space-y-2">
                  {/* Season picks */}
                  <div>
                    <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-1.5">🎬 Season Picks</p>
                    <div className="flex gap-2">
                      {[0,1,2,3].map(i => {
                        const pick = seasonPicks[i]
                        const movie = pick ? allMovies.find(m => m.id === pick.movie_id) : null
                        return (
                          <div key={i} className="flex flex-col items-center gap-1 flex-1">
                            {movie ? (
                              <>
                                <PosterImage movieId={pick.movie_id} imdbId={movie?.imdbId} tmdbId={movie?.tmdbId} fallbackSrc={movie?.img}
                                  className="w-full aspect-[2/3] object-cover rounded-lg" />
                                <p className="text-[9px] text-center text-ink-muted leading-tight line-clamp-2">{movie.title}</p>
                              </>
                            ) : (
                              <div className="w-full aspect-[2/3] rounded-lg bg-raised border border-border flex items-center justify-center">
                                <span className="text-ink-muted text-lg">?</span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Bomb + Alternate */}
                  <div className="flex gap-2">
                    {[{ pick: bombPick, type: 'bomb' }, { pick: altPick, type: 'alternate' }].map(({ pick, type }) => {
                      const movie = pick ? allMovies.find(m => m.id === pick.movie_id) : null
                      const pt = PICK_TYPES[type]
                      return (
                        <div key={type} className="flex-1 rounded-xl p-2 border" style={{ borderColor: pt.color + '30', background: pt.color + '08' }}>
                          <p className="text-[10px] font-bold mb-1.5" style={{ color: pt.color }}>{pt.icon} {pt.label}</p>
                          {movie ? (
                            <div className="flex items-center gap-2">
                              <PosterImage movieId={pick.movie_id} imdbId={movie?.imdbId} tmdbId={movie?.tmdbId} fallbackSrc={movie?.img}
                                className="w-10 h-14 object-cover rounded-lg flex-shrink-0 cursor-pointer"
                                onClick={() => openMovieModal(pick.movie_id)} />
                              <p className="text-xs text-ink-primary font-semibold leading-tight">{movie.title}</p>
                            </div>
                          ) : (
                            <div className="h-14 flex items-center justify-center">
                              <span className="text-ink-muted text-xs">Not picked</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </PageWrapper>
    )
  }

  return null
}
