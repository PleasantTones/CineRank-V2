import { IMDB_URLS } from './movies'

const OMDB_KEY = 'a25da7ab'
const CACHE_KEY = 'cinerank_poster_cache_v4'  // v4: tmdbId as cache key

let cache = {}
try {
  const stored = localStorage.getItem(CACHE_KEY)
  if (stored) {
    const parsed = JSON.parse(stored)
    // Only keep entries that are real TMDB CDN URLs or valid OMDB URLs
    Object.entries(parsed).forEach(([k, v]) => {
      if (v && (v.includes('image.tmdb.org') || v.includes('media-amazon') || v.includes('omdbapi'))) {
        cache[k] = v
      }
    })
  }
} catch {}

const pending = {}

function saveCache() {
  clearTimeout(window._posterSaveTimer)
  window._posterSaveTimer = setTimeout(() => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)) } catch {}
  }, 500)
}

export function getCachedPoster(movieId, tmdbId) {
  const cacheKey = tmdbId ? `tmdb_${tmdbId}` : movieId
  return cache[cacheKey] || null
}

export async function fetchPoster(movieId, imdbIdOverride, tmdbIdOverride) {
  // Use tmdbId as cache key for dynamic movies — movieId (M0057 etc) gets reused on clear/reload
  const cacheKey = tmdbIdOverride ? `tmdb_${tmdbIdOverride}` : movieId
  if (cache[cacheKey]) return cache[cacheKey]
  if (pending[cacheKey]) return pending[cacheKey]

  const imdbUrl = IMDB_URLS[movieId]
  const imdbId = imdbIdOverride || imdbUrl?.match(/tt\d+/)?.[0]
  const tmdbId = tmdbIdOverride || null
  const tmdbKey = localStorage.getItem('tmdb_key')

  // Try TMDB by direct movie ID — fastest, most reliable for dynamic movies
  const tryTMDB = async () => {
    if (!tmdbId || !tmdbKey) return null
    try {
      const res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${tmdbKey}`)
      const d = await res.json()
      return d.poster_path ? `https://image.tmdb.org/t/p/w342${d.poster_path}` : null
    } catch { return null }
  }

  // Try OMDB by exact IMDB ID only — NEVER by title
  const tryOMDB = async () => {
    if (!imdbId) return null
    try {
      const res = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_KEY}&i=${imdbId}`)
      const d = await res.json()
      return d.Poster && d.Poster !== 'N/A' ? d.Poster : null
    } catch { return null }
  }

  // TMDB /find by IMDB ID — cross-reference lookup
  const tryTMDBviaIMDB = async () => {
    if (!imdbId || !tmdbKey) return null
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/find/${imdbId}?api_key=${tmdbKey}&external_source=imdb_id`
      )
      const d = await res.json()
      const movie = d.movie_results?.[0]
      return movie?.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : null
    } catch { return null }
  }

  pending[cacheKey] = (async () => {
    let url = null

    if (tmdbId) {
      // Dynamic movie — TMDB direct is authoritative, never guess by title
      url = await tryTMDB()
      if (!url && imdbId) url = await tryOMDB()
      if (!url && imdbId) url = await tryTMDBviaIMDB()
    } else {
      // Hardcoded movie — OMDB first (has IMDB ID), TMDB via IMDB as fallback
      url = await tryOMDB()
      if (!url) url = await tryTMDBviaIMDB()
    }

    if (url) {
      cache[cacheKey] = url
      saveCache()
    }
    delete pending[cacheKey]
    return url
  })()

  return pending[cacheKey]
}

export function prefetchPosters(movieIds) {
  movieIds.forEach(id => { if (!cache[id]) fetchPoster(id) })
}
