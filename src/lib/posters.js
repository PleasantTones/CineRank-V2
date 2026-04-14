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

  // Try TMDB by direct movie ID
  const tryTMDB = async () => {
    if (!tmdbId || !tmdbKey) return null
    try {
      const res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${tmdbKey}`)
      const d = await res.json()
      return d.poster_path ? `https://image.tmdb.org/t/p/w342${d.poster_path}` : null
    } catch { return null }
  }

  // Try OMDB by IMDB ID (OMDB sources its posters from IMDB)
  const tryOMDB = async () => {
    if (!imdbId) return null
    try {
      const res = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_KEY}&i=${imdbId}&plot=short`)
      const d = await res.json()
      return d.Poster && d.Poster !== 'N/A' ? d.Poster : null
    } catch { return null }
  }

  // Final fallback: TMDB /find by IMDB ID — TMDB can look up any movie via its
  // IMDB ID and return the TMDB poster (sourced from IMDB's image library).
  // This catches cases where OMDB is rate-limited or missing data.
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

  pending[movieId] = (async () => {
    let url = null

    if (tmdbId) {
      // Dynamic movie: TMDB direct → OMDB → TMDB via IMDB
      url = await tryTMDB()
      if (!url) url = await tryOMDB()
      if (!url) url = await tryTMDBviaIMDB()
    } else {
      // Hardcoded movie: OMDB → TMDB via IMDB (uses imdbId to find on TMDB)
      url = await tryOMDB()
      if (!url) url = await tryTMDBviaIMDB()
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
