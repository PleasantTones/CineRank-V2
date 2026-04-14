import React from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { PLAYERS, PLAYER_COLORS } from '../../lib/movies'

export default function PlayerSelect() {
  const { setPlayer } = useStore()

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mt-4 p-5 bg-surface border border-border rounded-2xl"
    >
      <p className="text-xs font-semibold text-ink-muted tracking-widest uppercase mb-3">Select your profile</p>
      <div className="flex flex-wrap gap-2">
        {PLAYERS.map((p, i) => (
          <motion.button
            key={p}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => setPlayer(p)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-raised hover:border-gold/50 transition-all font-medium text-sm text-ink-primary"
          >
            <span className="w-2 h-2 rounded-full" style={{ background: PLAYER_COLORS[p] }} />
            {p}
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}
