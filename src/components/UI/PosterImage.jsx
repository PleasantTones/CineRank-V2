import React, { useState, useEffect } from 'react'
import { getCachedPoster, fetchPoster } from '../../lib/posters'

// Smart poster component
// Priority for dynamic movies: stored TMDB CDN URL (fallbackSrc) → fresh fetch
// Priority for hardcoded movies: localStorage cache → fresh OMDB/TMDB fetch
export default function PosterImage({ movieId, imdbId, tmdbId, fallbackSrc, alt, className, style, onClick }) {
  const isTMDBUrl = fallbackSrc?.includes('image.tmdb.org')

  const [src, setSrc] = useState(() => {
    if (isTMDBUrl) return fallbackSrc
    return getCachedPoster(movieId, tmdbId) || fallbackSrc
  })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    // If we already have a valid TMDB CDN URL, trust it — don't fetch
    if (isTMDBUrl) { setSrc(fallbackSrc); return }
    // Otherwise fetch fresh
    const cached = getCachedPoster(movieId, tmdbId)
    if (cached) { setSrc(cached); return }
    fetchPoster(movieId, imdbId, tmdbId).then(url => {
      if (!cancelled && url) setSrc(url)
    })
    return () => { cancelled = true }
  }, [movieId, imdbId, tmdbId, fallbackSrc])

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{
        ...style,
        transition: 'opacity 0.25s ease',
        opacity: loaded ? 1 : 0.85,
        imageRendering: 'auto',
      }}
      onClick={onClick}
      onLoad={() => setLoaded(true)}
      onError={() => { if (src !== fallbackSrc) setSrc(fallbackSrc) }}
      draggable={false}
    />
  )
}
