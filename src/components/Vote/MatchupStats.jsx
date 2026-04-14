import React from 'react'

export default function MatchupStats({ ratingA, ratingB, movieA, movieB, played, remaining, pct }) {
  return (
    <div className="px-4 pt-3 pb-2 space-y-3">
      {/* Movie ELOs */}
      <div className="flex items-center justify-between text-xs text-ink-muted font-mono">
        <span className="font-medium text-ink-secondary">{ratingA?.elo ?? 1000} ELO</span>
        <span className="text-ink-muted">vs</span>
        <span className="font-medium text-ink-secondary">{ratingB?.elo ?? 1000} ELO</span>
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
