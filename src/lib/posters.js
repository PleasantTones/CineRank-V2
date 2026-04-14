import { IMDB_URLS } from './movies'

const OMDB_KEY = 'd749e3a3'
const CACHE_KEY = 'cinerank_poster_cache'

// Load from localStorage
let cache = {}
try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') } catch {}

const pending = {} // in-flight requests — prevents duplicate fetches

export function getCachedPoster(movieId) {
  return cache[movieId] || null
}

export async function fetchPoster(movieId) {
  if (cache[movieId]) return cache[movieId]
  if (pending[movieId]) return pending[movieId]

  const imdbUrl = IMDB_URLS[movieId]
  const imdbId = imdbUrl?.match(/tt\d+/)?.[0]
  if (!imdbId) return null

  pending[movieId] = fetch(
    `https://www.omdbapi.com/?apikey=${OMDB_KEY}&i=${imdbId}&plot=short`
  )
    .then(r => r.json())
    .then(d => {
      const url = d.Poster && d.Poster !== 'N/A' ? d.Poster : null
      if (url) {
        cache[movieId] = url
        // Persist cache to localStorage (batched to avoid thrashing)
        clearTimeout(window._posterSaveTimer)
        window._posterSaveTimer = setTimeout(() => {
          try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)) } catch {}
        }, 500)
      }
      delete pending[movieId]
      return url
    })
    .catch(() => { delete pending[movieId]; return null })

  return pending[movieId]
}

// Pre-fetch a batch of posters in the background
export function prefetchPosters(movieIds) {
  movieIds.forEach(id => {
    if (!cache[id]) fetchPoster(id)
  })
}
