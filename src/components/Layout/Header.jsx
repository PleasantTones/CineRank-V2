import React from 'react'
import { useStore } from '../../store/useStore'
import { PLAYER_COLORS, PLAYERS } from '../../lib/movies'
import ThemeToggle from '../UI/ThemeToggle'

export default function Header() {
  const { player, setPlayer, toggleMuted, muted } = useStore()

  return (
    <header className="relative z-20 flex items-center gap-2 px-4 pt-3 pb-2.5 border-b border-border bg-base/95 backdrop-blur-sm">
      {/* Logo */}
      <div className="flex-shrink-0">
        <p className="text-[10px] tracking-[0.25em] uppercase text-gold/50 font-light leading-none mb-0.5">
          Fantasy Box Office
        </p>
        <h1 className="text-[18px] font-black tracking-[-0.03em] text-ink-primary leading-none">
          Cine<span className="text-gradient-gold">Rank</span>
        </h1>
      </div>

      <div className="flex-1" />

      {/* Controls */}
      <button onClick={toggleMuted} className="w-8 h-8 flex items-center justify-center text-ink-muted hover:text-ink-secondary transition-colors text-base flex-shrink-0">
        {muted ? '🔇' : '🔊'}
      </button>

      <ThemeToggle />

      {/* Player selector */}
      <div className="relative flex-shrink-0">
        <select
          value={player || ''}
          onChange={e => setPlayer(e.target.value || null)}
          className="appearance-none bg-surface border border-border rounded-xl pl-3 pr-7 py-1.5 text-xs font-semibold text-ink-primary cursor-pointer focus:outline-none focus:border-gold transition-colors"
          style={{ color: player ? PLAYER_COLORS[player] : undefined }}
        >
          <option value="" style={{ color: '#A0A0A0' }}>Who's voting?</option>
          {PLAYERS.map(p => (
            <option key={p} value={p} style={{ color: PLAYER_COLORS[p] }}>{p}</option>
          ))}
        </select>
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none text-[10px]">▾</span>
      </div>
    </header>
  )
}
