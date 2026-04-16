// TMDB financial data fetcher
// Uses API key stored in localStorage by the admin page

const TMDB_BASE = 'https://api.themoviedb.org/3'
const SESSION_CACHE_KEY = 'cinerank_tmdb_financials'

// In-memory cache for this session
let memCache = {}
try {
  const stored = sessionStorage.getItem(SESSION_CACHE_KEY)
  if (stored) {
    const parsed = JSON.parse(stored)
    // Filter out cached entries with no real data so they re-fetch
    Object.entries(parsed).forEach(([k, v]) => {
      if (v && (v.budget > 0 || v.revenue > 0 || v.status)) memCache[k] = v
    })
  }
} catch {}

function persistCache() {
  try { sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(memCache)) } catch {}
}

export function getTMDBKey() {
  return localStorage.getItem('tmdb_key') || ''
}

// Format currency
export function formatMoney(n) {
  if (!n || n === 0) return null
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`
  return `$${n.toLocaleString()}`
}

// Calculate profit using 2x budget rule (accounts for marketing/distribution)
export function calcProfit(budget, revenue) {
  if (!budget || !revenue) return null
  return revenue - budget * 2
}

// Fetch full movie details from TMDB including financials
// Accepts a movie object with optional tmdbId or imdbId
export async function fetchTMDBFinancials(movie) {
  const key = getTMDBKey()
  if (!key) return null

  const cacheKey = movie.tmdbId || movie.imdbId || movie.id  // prefer stable TMDB/IMDB IDs over internal M00XX
  if (memCache[cacheKey]) return memCache[cacheKey]

  try {
    let tmdbId = movie.tmdbId

    // Fallback: find by IMDB ID if no tmdbId
    if (!tmdbId && movie.imdbId) {
      const res = await fetch(`${TMDB_BASE}/find/${movie.imdbId}?api_key=${key}&external_source=imdb_id`)
      const data = await res.json()
      tmdbId = data.movie_results?.[0]?.id
    }

    // Last fallback: search by title
    if (!tmdbId && movie.title) {
      const res = await fetch(`${TMDB_BASE}/search/movie?api_key=${key}&query=${encodeURIComponent(movie.title)}&language=en-US`)
      const data = await res.json()
      tmdbId = data.results?.[0]?.id
    }

    if (!tmdbId) return null

    const res = await fetch(`${TMDB_BASE}/movie/${tmdbId}?api_key=${key}`)
    const d = await res.json()
    if (d.status_message) return null  // API error

    // TMDB budget/revenue: 0 = unknown, values < $100k are community data errors
    let budget  = (d.budget  && d.budget  >= 100_000) ? d.budget  : 0
    let revenue = (d.revenue && d.revenue >= 100_000) ? d.revenue : 0

    // If TMDB has no data and we have an IMDB ID, try OMDB for BoxOffice field
    if (revenue === 0 && d.imdb_id) {
      try {
        const omdbKey = localStorage.getItem('omdb_key') || 'a25da7ab'
        const omdbRes = await fetch(`https://www.omdbapi.com/?apikey=${omdbKey}&i=${d.imdb_id}&plot=short`)
        const omdb = await omdbRes.json()
        if (omdb.Response === 'True') {
          // OMDB BoxOffice is domestic US gross e.g. "$142,123,456"
          if (omdb.BoxOffice && omdb.BoxOffice !== 'N/A') {
            const domestic = parseInt(omdb.BoxOffice.replace(/[$,]/g, ''))
            if (domestic > 100_000) revenue = domestic
          }
          // OMDB doesn't have budget — only use for revenue
        }
      } catch {}
    }

    const profit  = calcProfit(budget, revenue)

    const result = {
      tmdbId:       d.id,
      title:        d.title,
      budget,
      revenue,
      profit,           // null if either is 0/unknown
      releaseDate:  d.release_date,
      status:       d.status,       // "Released", "In Production", etc.
      tagline:      d.tagline,
      overview:     d.overview,
      runtime:      d.runtime,
      voteAverage:  d.vote_average,
      voteCount:    d.vote_count,
      genres:       d.genres?.map(g => g.name) || [],
      posterPath:   d.poster_path,
    }

    // Only cache if we got real data — don't cache empty results so they retry
    if (result && (result.budget > 0 || result.revenue > 0 || result.status)) {
      memCache[cacheKey] = result
      persistCache()
    }
    return result
  } catch {
    return null
  }
}

// Fetch financials for a list of movies (used for scoring)
export async function fetchBatchFinancials(movies) {
  const results = {}
  await Promise.all(movies.map(async m => {
    const data = await fetchTMDBFinancials(m)
    if (data) results[m.id] = data
  }))
  return results
}
