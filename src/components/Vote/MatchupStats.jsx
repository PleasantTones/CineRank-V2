import React from 'react'

export default function MatchupStats({ ratingA, ratingB, played, remaining, pct }) {
  return (
    <div className="flex-shrink-0 px-4 pt-3 pb-3 border-b border-border/30">
      {/* ELO row */}
      <div className="flex items-center justify-between text-xs font-mono mb-2.5">
        <span className="text-ink-secondary font-semibold">{ratingA?.elo ?? 1000} ELO</span>
        <span className="text-ink-muted text-[10px] tracking-widest">VS</span>
        <span className="text-ink-secondary font-semibold">{ratingB?.elo ?? 1000} ELO</span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-[10px] text-ink-muted mb-1.5">
          <span>{played} voted</span>
          <span>{remaining} remaining</span>
        </div>
        <div className="h-1 bg-raised rounded-full overflow-hidden">
          <div
            className="h-full bg-gold rounded-full transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
