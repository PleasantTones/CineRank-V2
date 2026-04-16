import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { MOVIES, IMDB_URLS, getAllMovies, getImdbUrl } from '../../lib/movies'
import { fetchTMDBFinancials, formatMoney, calcProfit, getTMDBKey } from '../../lib/tmdb'
import PosterImage from './PosterImage'

const OMDB_KEY = 'd749e3a3'
const cache = {}  // keyed by imdbId or tmdbId — never by movieId (gets reused on clear/reload)

let openFn = null
export function openMovieModal(movieId) { if (openFn) openFn(movieId) }

export default function MovieModal() {
  const [movieId, setMovieId] = useState(null)
  const [omdb, setOmdb] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tmdb, setTmdb] = useState(null)
  const [tmdbLoading, setTmdbLoading] = useState(false)

  useEffect(() => {
    openFn = (id) => { setMovieId(id); setOmdb(null); setTmdb(null) }
    return () => { openFn = null }
  }, [])

  const { player, players, dynamicMovies } = useStore()
  const allMovies = getAllMovies(dynamicMovies)
  const movie = movieId ? allMovies.find(m => m.id === movieId) : null
  const pd = player ? players[player] : null
  const rating = movie && pd ? pd.ratings[movie.id] : null
  const imdbDirectUrl = movie ? (IMDB_URLS[movie.id] || (movie.imdbId ? 'https://www.imdb.com/title/' + movie.imdbId + '/' : null)) : null
  const imdbSearchUrl = movie ? 'https://www.imdb.com/find/?q=' + encodeURIComponent(movie.title) + '&s=tt&ttype=ft' : null
  const imdbUrl = imdbDirectUrl || imdbSearchUrl

  useEffect(() => {
    if (!movie) return
    const omdbCacheKey = movie.imdbId || movie.tmdbId || movie.id
    if (cache[omdbCacheKey]) { setOmdb(cache[omdbCacheKey]); return }
    const imdbId = imdbUrl?.match(/tt\d+/)?.[0]
    // Only fetch OMDB if we have an exact IMDB ID — never title search (returns wrong movies)
    if (!imdbId) { setLoading(false); return }
    setLoading(true)
    fetch(`https://www.omdbapi.com/?apikey=${OMDB_KEY}&i=${imdbId}&plot=short`)
      .then(r => r.json())
      .then(d => { if (d.Response === 'True') { cache[omdbCacheKey] = d; setOmdb(d) } })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [movie?.id])

  // Fetch TMDB financials
  useEffect(() => {
    if (!movie) { setTmdb(null); return }
    setTmdbLoading(true)
    if (!getTMDBKey()) { setTmdbLoading(false); return }
    fetchTMDBFinancials(movie)
      .then(d => setTmdb(d))
      .catch(() => {})
      .finally(() => setTmdbLoading(false))
  }, [movie?.id])

  const imdbRating = omdb?.imdbRating && omdb.imdbRating !== 'N/A' ? omdb.imdbRating : null
  const rtRating = omdb?.Ratings?.find(r => r.Source === 'Rotten Tomatoes')?.Value
  // Dynamic movies have poster_path stored in Supabase → always use TMDB CDN URL
  // Hardcoded movies use OMDB poster as it's more reliable for them
  const poster = movie?.dynamic
    ? (movie.img || null)  // TMDB CDN URL from Supabase — never let OMDB override this
    : (omdb?.Poster && omdb.Poster !== 'N/A' ? omdb.Poster : movie?.img)

  return (
    <AnimatePresence>
      {movie && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.88)' }}
          onClick={e => e.target === e.currentTarget && setMovieId(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="w-full max-w-sm bg-surface rounded-2xl overflow-hidden border border-border relative"
            style={{ maxHeight: '90dvh', maxWidth: '480px', width: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}
          >
            {/* Close button */}
            <button
              onClick={() => setMovieId(null)}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center text-ink-muted hover:text-ink-primary transition-colors"
              style={{ background: 'rgba(0,0,0,0.5)' }}
            >✕</button>

            {/* Header — poster centered like v1 */}
            <div className="flex gap-4 p-5 pb-4 border-b border-border flex-shrink-0" style={{ background: '#0e0e10' }}>
              <PosterImage
                movieId={movie.id}
                imdbId={movie?.imdbId}
                tmdbId={movie?.tmdbId}
                fallbackSrc={poster || movie.img}
                alt={movie.title}
                className="rounded-xl flex-shrink-0 object-cover"
                style={{ width: 90, height: 135, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}
              />
              <div className="flex flex-col justify-center gap-1.5 min-w-0">
                <h2 className="text-base font-bold text-ink-primary leading-tight">
                  {omdb?.Title || movie.title}
                </h2>
                {omdb && (
                  <p className="text-[11px] text-ink-muted">
                    {[omdb.Year, omdb.Rated, omdb.Runtime].filter(x => x && x !== 'N/A').join(' · ')}
                  </p>
                )}
                {loading && <p className="text-[11px] text-ink-muted">Loading...</p>}

                {/* IMDb + RT badges */}
                {(imdbRating || rtRating) && (
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {imdbRating && (
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black" style={{ background: '#f5c518', color: '#000' }}>IMDb</span>
                        <span className="text-sm font-bold" style={{ color: '#f5c518' }}>{imdbRating}</span>
                        <span className="text-[10px] text-ink-muted">/10</span>
                      </div>
                    )}
                    {rtRating && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)' }}>
                        <span className="text-xs">🍅</span>
                        <span className="text-xs font-bold text-lose">{rtRating}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto overscroll-contain no-scrollbar flex-1 min-h-0 p-5 pb-6 space-y-4">
              {/* ELO stats */}
              {rating && rating.matches > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Your ELO', value: rating.elo },
                    { label: 'Wins', value: rating.wins },
                    { label: 'Matchups', value: rating.matches },
                  ].map(s => (
                    <div key={s.label} className="bg-raised rounded-xl p-3 text-center">
                      <div className="text-base font-bold text-gold font-mono">{s.value}</div>
                      <div className="text-[10px] text-ink-muted mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Plot */}
              {omdb?.Plot && omdb.Plot !== 'N/A' && (
                <p className="text-sm text-ink-secondary leading-relaxed">{omdb.Plot}</p>
              )}

              {/* Details grid */}
              {omdb && (
                <div className="space-y-0 rounded-xl overflow-hidden border border-border">
                  {[
                    { label: 'Director', value: omdb.Director },
                    { label: 'Cast', value: omdb.Actors },
                    { label: 'Genre', value: omdb.Genre },
                    { label: 'Release', value: omdb.Released },
                  ].filter(x => x.value && x.value !== 'N/A').map((x, i, arr) => (
                    <div key={x.label} className={`flex gap-3 px-4 py-3 ${i < arr.length - 1 ? 'border-b border-border' : ''}`}
                      style={{ background: i % 2 === 0 ? '#111113' : '#0e0e10' }}>
                      <span className="text-[10px] font-bold text-ink-muted uppercase tracking-widest w-14 flex-shrink-0 pt-0.5">{x.label}</span>
                      <span className="text-xs text-ink-primary flex-1">{x.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Box Office / Financials */}
            {/* Always show box office — loading state while fetching */}
            {(
              <div className="rounded-xl overflow-hidden border border-border">
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: '#111113' }}>
                  <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">Box Office</p>
                  {tmdbLoading && <span className="text-[10px] text-ink-muted animate-pulse">Loading…</span>}
                </div>
                {tmdb && tmdb.budget === 0 && tmdb.revenue === 0 && !tmdbLoading && (
                  <div className="px-4 py-3 border-t border-border text-center">
                    <p className="text-[11px] text-ink-muted">Budget data not yet available on TMDB</p>
                  </div>
                )}
                {tmdb && (tmdb.budget > 0 || tmdb.revenue > 0) && (
                  <>
                    {[
                      { label: 'Production Budget', value: formatMoney(tmdb.budget), note: null },
                      { label: 'Break-even (2× budget)', value: formatMoney(tmdb.budget * 2), note: 'incl. marketing' },
                      { label: 'Worldwide Gross', value: formatMoney(tmdb.revenue), note: null },
                    ].filter(x => x.value).map((x, i) => (
                      <div key={x.label} className="flex items-center justify-between px-4 py-3 border-t border-border"
                        style={{ background: i % 2 === 0 ? '#0e0e10' : '#111113' }}>
                        <div>
                          <p className="text-[11px] text-ink-muted">{x.label}</p>
                          {x.note && <p className="text-[9px] text-ink-muted/60">{x.note}</p>}
                        </div>
                        <span className="text-sm font-bold font-mono text-ink-primary">{x.value}</span>
                      </div>
                    ))}
                    {tmdb.budget > 0 && tmdb.revenue > 0 && (() => {
                      const profit = tmdb.profit
                      const isProfit = profit >= 0
                      return (
                        <div className="px-4 py-3 border-t border-border flex items-center justify-between"
                          style={{ background: isProfit ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.08)' }}>
                          <p className="text-[11px] font-bold" style={{ color: isProfit ? '#34d399' : '#ef4444' }}>
                            {isProfit ? '✅ Profit' : '❌ Loss'}
                          </p>
                          <span className="text-base font-black font-mono" style={{ color: isProfit ? '#34d399' : '#ef4444' }}>
                            {isProfit ? '+' : ''}{formatMoney(profit)}
                          </span>
                        </div>
                      )
                    })()}
                    {tmdb.status && tmdb.status !== 'Released' && (
                      <div className="px-4 py-2 border-t border-border text-center">
                        <span className="text-[10px] text-gold font-bold uppercase tracking-widest">{tmdb.status}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* IMDb button — intentional gap from box office */}

            {imdbUrl && (
              <div className="flex-shrink-0 p-4 pt-3">
                <a
                  href={imdbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-98"
                  style={{ background: '#f5c518', color: '#000' }}
                >
                  {imdbDirectUrl ? 'View on IMDb ↗' : 'Search on IMDb ↗'}
                </a>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
