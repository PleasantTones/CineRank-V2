import { IMDB_URLS } from './movies'

const OMDB_KEY = 'a25da7ab'
const CACHE_KEY = 'cinerank_poster_cache'

let cache = {}
try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') } catch {}

const pending = {}

function saveCache() {
  clearTimeout(window._posterSaveTimer)
  window._posterSaveTimer = setTimeout(() => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)) } catch {}
  }, 500)
}

export function getCachedPoster(movieId) {
  return cache[movieId] || null
}

export async function fetchPoster(movieId, imdbIdOverride, tmdbIdOverride) {
  if (cache[movieId]) return cache[movieId]
  if (pending[movieId]) return pending[movieId]

  const imdbUrl = IMDB_URLS[movieId]
  const imdbId = imdbIdOverride || imdbUrl?.match(/tt\d+/)?.[0]
  const tmdbId = tmdbIdOverride || null
  const tmdbKey = localStorage.getItem('tmdb_key')

  // Strategy:
  // Dynamic movies (have tmdbId): try TMDB first — always current for upcoming films
  // Hardcoded movies (have imdbId only): try OMDB — already cached and reliable
  // Fallback chain: TMDB → OMDB → null

  const tryTMDB = async () => {
    if (!tmdbId || !tmdbKey) return null
    try {
      const res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${tmdbKey}`)
      const d = await res.json()
      return d.poster_path ? `https://image.tmdb.org/t/p/w342${d.poster_path}` : null
    } catch { return null }
  }

  const tryOMDB = async () => {
    if (!imdbId) return null
    try {
      const res = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_KEY}&i=${imdbId}&plot=short`)
      const d = await res.json()
      return d.Poster && d.Poster !== 'N/A' ? d.Poster : null
    } catch { return null }
  }

  pending[movieId] = (async () => {
    let url = null

    if (tmdbId) {
      // Dynamic movie — TMDB first, OMDB as backup
      url = await tryTMDB()
      if (!url) url = await tryOMDB()
    } else {
      // Hardcoded movie — OMDB first, TMDB as backup
      url = await tryOMDB()
      if (!url) url = await tryTMDB()
    }

    if (url) {
      cache[movieId] = url
      saveCache()
    }
    delete pending[movieId]
    return url
  })()

  return pending[movieId]
}

export function prefetchPosters(movieIds) {
  movieIds.forEach(id => { if (!cache[id]) fetchPoster(id) })
}
