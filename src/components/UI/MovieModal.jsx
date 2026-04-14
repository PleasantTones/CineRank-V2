import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { MOVIES } from '../../lib/movies'

const OMDB_KEY = 'd749e3a3'

let openFn = null
export function openMovieModal(movieId) { if (openFn) openFn(movieId) }

export default function MovieModal() {
  const [movieId, setMovieId] = useState(null)
  const [omdb, setOmdb] = useState(null)
  const [loading, setLoading] = useState(false)
  const { player, players } = useStore()

  useEffect(() => {
    openFn = (id) => { setMovieId(id); setOmdb(null) }
    return () => { openFn = null }
  }, [])

  const movie = movieId ? MOVIES.find(m => m.id === movieId) : null
  const pd = player ? players[player] : null
  const rating = movie && pd ? pd.ratings[movie.id] : null

  useEffect(() => {
    if (!movie) return
    setLoading(true)
    fetch(`https://www.omdbapi.com/?apikey=${OMDB_KEY}&t=${encodeURIComponent(movie.title)}&type=movie`)
      .then(r => r.json())
      .then(d => { if (d.Response === 'True') setOmdb(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [movie?.id])

  return (
    <AnimatePresence>
      {movie && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={e => e.target === e.currentTarget && setMovieId(null)}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="w-full sm:max-w-sm bg-surface rounded-t-3xl sm:rounded-2xl overflow-hidden border border-border max-h-[90vh] flex flex-col"
          >
            {/* Poster header */}
            <div className="relative h-56 flex-shrink-0">
              <img src={movie.img} alt={movie.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
              <button
                onClick={() => setMovieId(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white/80 hover:text-white text-sm"
              >✕</button>
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h2 className="text-lg font-bold text-white leading-tight">{movie.title}</h2>
                {omdb?.Year && <p className="text-xs text-white/60 mt-0.5">{omdb.Year} · {omdb.Runtime}</p>}
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto overscroll-contain flex-1 p-4 space-y-4">
              {/* Your stats */}
              {rating && rating.matches > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Your ELO', value: rating.elo },
                    { label: 'Wins', value: rating.wins },
                    { label: 'Matchups', value: rating.matches },
                  ].map(s => (
                    <div key={s.label} className="bg-raised rounded-xl p-3 text-center">
                      <div className="text-sm font-bold text-gold font-mono">{s.value}</div>
                      <div className="text-[10px] text-ink-muted mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* OMDB data */}
              {loading && <p className="text-xs text-ink-muted text-center py-4">Loading details...</p>}
              {omdb && (
                <div className="space-y-3">
                  {omdb.Plot && omdb.Plot !== 'N/A' && (
                    <p className="text-sm text-ink-secondary leading-relaxed">{omdb.Plot}</p>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { label: 'Director', value: omdb.Director },
                      { label: 'Genre', value: omdb.Genre?.split(',')[0] },
                      { label: 'Rating', value: omdb.Rated },
                      { label: 'IMDb', value: omdb.imdbRating !== 'N/A' ? `${omdb.imdbRating}/10` : null },
                    ].filter(x => x.value && x.value !== 'N/A').map(x => (
                      <div key={x.label} className="bg-raised rounded-xl p-3">
                        <div className="text-ink-muted mb-0.5">{x.label}</div>
                        <div className="font-semibold text-ink-primary truncate">{x.value}</div>
                      </div>
                    ))}
                  </div>
                  {omdb.Ratings?.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {omdb.Ratings.map(r => (
                        <div key={r.Source} className="bg-raised rounded-lg px-3 py-1.5 text-xs">
                          <span className="text-ink-muted">{r.Source.replace('Internet Movie Database','IMDb').replace('Rotten Tomatoes','RT')}: </span>
                          <span className="font-bold text-ink-primary">{r.Value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
