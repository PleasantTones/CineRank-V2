import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'

const TABS = [
  { to: '/vote',        icon: '⚔️',  label: 'Vote'     },
  { to: '/leaderboard', icon: '🏆',  label: 'Rankings' },
  { to: '/mymovies',    icon: '🎬',  label: 'My Films' },
  { to: '/friends',     icon: '👥',  label: 'Friends'  },
  { to: '/arcade',      icon: '🕹️', label: 'Arcade'   },
  { to: '/hall',        icon: '🏛️', label: 'Hall'     },
]

export default function BottomNav() {
  const location = useLocation()
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 bg-base/95 backdrop-blur-md border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex" style={{ minHeight: 56 }}>
        {TABS.map(tab => {
          const active = location.pathname === tab.to
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className="flex-1 flex flex-col items-center justify-center relative"
              style={{ minHeight: 56 }}
            >
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-x-2 top-0 h-[2px] bg-gold rounded-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span
                className="text-[18px] leading-none transition-all duration-200"
                style={{ opacity: active ? 1 : 0.45, transform: active ? 'scale(1.1)' : 'scale(1)' }}
              >
                {tab.icon}
              </span>
              <span
                className="text-[10px] font-semibold mt-0.5 transition-colors duration-200"
                style={{ color: active ? '#C8A040' : '#505050' }}
              >
                {tab.label}
              </span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
