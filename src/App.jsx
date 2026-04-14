import React, { useEffect } from 'react'
import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import BottomNav from './components/Layout/BottomNav'
import Header from './components/Layout/Header'
import PlayerSelect from './components/Layout/PlayerSelect'
import ToastContainer from './components/UI/Toast'
import Confetti from './components/UI/Confetti'
import MovieModal from './components/UI/MovieModal'
import FloatChat from './components/UI/FloatChat'
import Onboarding from './components/UI/Onboarding'
import Vote from './pages/Vote'
import Leaderboard from './pages/Leaderboard'
import MyMovies from './pages/MyMovies'
import Friends from './pages/Friends'
import Arcade from './pages/Arcade'
const Hall = React.lazy(() => import('./pages/Hall'))
import { useStore } from './store/useStore'
import { useState } from 'react'
import { sbFetch } from './lib/supabase'
import { PLAYERS, MOVIES } from './lib/movies'
import { prefetchPosters } from './lib/posters'


class HallErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: false } }
  static getDerivedStateFromError() { return { error: true } }
  componentDidCatch(e) { console.error('Hall error:', e) }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-base p-8 text-center gap-4">
          <div className="text-4xl">🏛️</div>
          <p className="text-ink-secondary text-sm">The Hall couldn't load on this device.</p>
          <button onClick={() => this.setState({ error: false })} className="px-4 py-2 bg-gold text-black font-bold rounded-xl text-sm">Try again</button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const location = useLocation()
  const { player, players, loadAllFromDB } = useStore()
  const isHall = location.pathname === '/hall'

  const [dbLoaded, setDbLoaded] = useState(false)

  // Safety: ensure localStorage data is valid on first load
  useEffect(() => {
    try {
      const stored = localStorage.getItem('cinerank-store')
      if (stored) {
        const parsed = JSON.parse(stored)
        // If store version is old or data looks wrong, clear it
        if (!parsed?.state || parsed?.version < 2) {
          localStorage.removeItem('cinerank-store')
        }
      }
    } catch(e) {
      // Corrupt localStorage — clear it
      try { localStorage.removeItem('cinerank-store') } catch {}
    }
  }, [])

  // Load all players from DB on mount
  useEffect(() => {
    async function load() {
      try {
        // Only query columns that exist in v1 Supabase schema
        // movie_a + movie_b are the v1 pair columns
        const [ratings, matchups] = await Promise.all([
          sbFetch('/rest/v1/ratings?select=player,movie_id,elo,wins,losses,matches,unseen'),
          sbFetch('/rest/v1/matchups?select=player,movie_a,movie_b&limit=10000'),
        ])

        console.log('[CineRank] Loaded ratings:', (ratings||[]).length, 'rows')
        console.log('[CineRank] Loaded matchups:', (matchups||[]).length, 'rows')

        // Build per-player played pairs from matchups
        const playerMatchups = {}
        PLAYERS.forEach(p => { playerMatchups[p] = { playedPairs: [], h2hHistory: {} } })
        ;(matchups || []).forEach(m => {
          if (!playerMatchups[m.player] || !m.movie_a || !m.movie_b) return
          const key = [m.movie_a, m.movie_b].sort().join('__')
          if (!playerMatchups[m.player].playedPairs.includes(key)) {
            playerMatchups[m.player].playedPairs.push(key)
          }
        })

        PLAYERS.forEach(p => {
          const pairs = playerMatchups[p]?.playedPairs || []
          console.log(`[CineRank] ${p}: ${(ratings||[]).filter(r=>r.player===p).length} ratings, ${pairs.length} matchups`)
        })

        // Single atomic state update
        const allData = {}
        PLAYERS.forEach(p => {
          allData[p] = {
            rows: (ratings || []).filter(r => r.player === p),
            playedPairs: playerMatchups[p].playedPairs,
            h2hHistory: {},
          }
        })
        loadAllFromDB(allData)
      } catch(e) {
        console.error('[CineRank] Load error:', e)
      } finally {
        setDbLoaded(true)
      }
    }
    // Show UI immediately from localStorage, then sync DB
    setDbLoaded(true)
    load()
    // Background-fetch sharp OMDB poster URLs (first 20 most-used movies first)
    prefetchPosters(MOVIES.slice(0, 20).map(m => m.id))
    setTimeout(() => prefetchPosters(MOVIES.slice(20).map(m => m.id)), 3000)
  }, [])

  return (
    <div className="flex justify-center bg-black" style={{ height: "100dvh", overflow: "hidden" }}>
    <div className="flex flex-col bg-base w-full" style={{ maxWidth: 520, height: "100dvh", overflow: "hidden", position: "relative" }}>
      {/* Global overlays — always mounted */}
      <ToastContainer />
      <Confetti />
      <MovieModal />
      <Onboarding />
      {!isHall && <FloatChat />}

      {!isHall && <Header />}
      {!isHall && !player && <PlayerSelect />}

      <main className={`flex-1 min-h-0 overflow-hidden ${isHall ? '' : 'pb-24'}`}>
        <AnimatePresence mode="wait">
          <React.Suspense fallback={<div className="flex-1 flex items-center justify-center"><span className="text-ink-muted text-sm">Loading Hall...</span></div>}>
          <Routes location={location} key={location.pathname}>
            <Route path="/"            element={<Navigate to="/vote" replace />} />
            <Route path="/vote"        element={<Vote />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/mymovies"    element={<MyMovies />} />
            <Route path="/friends"     element={<Friends />} />
            <Route path="/arcade"      element={<Arcade />} />
            <Route path="/hall"        element={<HallErrorBoundary><Hall /></HallErrorBoundary>} />
          </Routes>
          </React.Suspense>
        </AnimatePresence>
      </main>

      {!isHall && <BottomNav />}
    </div>
    </div>
  )
}
