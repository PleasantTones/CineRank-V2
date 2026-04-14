import React from 'react'

// Shimmer skeleton used while data loads
function Skeleton({ className = '' }) {
  return (
    <div
      className={`bg-raised rounded-xl relative overflow-hidden ${className}`}
      style={{
        backgroundImage: 'linear-gradient(90deg, #18181B 0%, #242428 50%, #18181B 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite linear',
      }}
    />
  )
}

// Leaderboard row skeleton
export function LeaderboardSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-surface border border-border rounded-xl"
          style={{ opacity: 1 - i * 0.1 }}>
          <Skeleton className="w-7 h-5" />
          <Skeleton className="w-9 h-14 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
          <Skeleton className="w-10 h-5" />
        </div>
      ))}
    </div>
  )
}

// Movie list row skeleton
export function MovieListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-surface border border-border rounded-xl"
          style={{ opacity: 1 - i * 0.12 }}>
          <Skeleton className="w-9 h-14 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <Skeleton className="w-16 h-7 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

// Card skeleton (friends profiles)
export function CardSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-surface border border-border rounded-2xl p-4 space-y-3"
          style={{ opacity: 1 - i * 0.15 }}>
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-2.5 w-1/4" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[0,1,2].map(j => <Skeleton key={j} className="h-14 rounded-xl" />)}
          </div>
        </div>
      ))}
    </div>
  )
}

export default Skeleton
