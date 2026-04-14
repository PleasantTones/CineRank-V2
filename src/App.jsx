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
import Hall from './pages/Hall'
import { useStore } from './store/useStore'
import { useState } from 'react'
import { sbFetch } from './lib/supabase'
import { PLAYERS, MOVIES } from './lib/movies'

export default function App() {
  const location = useLocation()
  const { player, players, loadPlayerFromDB, vote } = useStore()
  const isHall = location.pathname === '/hall'

  const [dbLoaded, setDbLoaded] = useState(false)

  // Load all players from DB on mount
  useEffect(() => {
    async function load() {
      try {
        const rows = await sbFetch('/rest/v1/ratings?select=player,movie_id,elo,wins,losses,matches,unseen')
        PLAYERS.forEach(p => {
          const playerRows = (rows || []).filter(r => r.player === p)
          if (playerRows.length) loadPlayerFromDB(p, playerRows)
        })
      } catch(e) { console.error('Load error:', e) }
      finally { setDbLoaded(true) }
    }
    // Show UI immediately from localStorage, then sync DB
    setDbLoaded(true)
    load()
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
          <Routes location={location} key={location.pathname}>
            <Route path="/"            element={<Navigate to="/vote" replace />} />
            <Route path="/vote"        element={<Vote />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/mymovies"    element={<MyMovies />} />
            <Route path="/friends"     element={<Friends />} />
            <Route path="/arcade"      element={<Arcade />} />
            <Route path="/hall"        element={<Hall />} />
          </Routes>
        </AnimatePresence>
      </main>

      {!isHall && <BottomNav />}
    </div>
    </div>
  )
}
