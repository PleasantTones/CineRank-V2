import React, { useState, useEffect } from 'react'
import { getCachedPoster, fetchPoster } from '../../lib/posters'

// Smart poster component: shows base64 immediately, upgrades to sharp OMDB image
export default function PosterImage({ movieId, imdbId, tmdbId, fallbackSrc, alt, className, style, onClick }) {
  const [src, setSrc] = useState(() => getCachedPoster(movieId) || fallbackSrc)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const cached = getCachedPoster(movieId)
    if (cached) {
      setSrc(cached)
      return
    }
    fetchPoster(movieId, imdbId, tmdbId).then(url => {
      if (!cancelled && url) setSrc(url)
    })
    return () => { cancelled = true }
  }, [movieId])

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
      onError={() => setSrc(fallbackSrc)}
      draggable={false}
    />
  )
}
