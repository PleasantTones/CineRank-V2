import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import PageWrapper from '../components/UI/PageWrapper'
import { openMovieModal } from '../components/UI/MovieModal'
import { CardSkeleton } from '../components/UI/Skeleton'
import { useStore } from '../store/useStore'
import { MOVIES, PLAYERS, PLAYER_COLORS, getAllMovies } from '../lib/movies'
import PosterImage from '../components/UI/PosterImage'

function getCompat(ratA, ratB, movies) {
  const both = movies.filter(m => ratA[m.id]?.matches > 0 && ratB[m.id]?.matches > 0)
  if (both.length < 3) return null
  const rankA = [...both].sort((a,b) => (ratB[b.id]?.elo||1000) - (ratB[a.id]?.elo||1000)).map(m => m.id)
  const rankB = [...both].sort((a,b) => (ratA[b.id]?.elo||1000) - (ratA[a.id]?.elo||1000)).map(m => m.id)
  const diffs = rankA.map((id, i) => Math.abs(i - rankB.indexOf(id)))
  const avg = diffs.reduce((a,b) => a+b, 0) / diffs.length
  return Math.round((1 - avg / (both.length - 1)) * 100)
}

export default function Friends() {
  const { players, globalRatings, dynamicMovies } = useStore()
  const allMovies = getAllMovies(dynamicMovies)

  const compat = useMemo(() => {
    const map = {}
    PLAYERS.forEach(pa => PLAYERS.forEach(pb => {
      if (pa >= pb) return
      map[`${pa}_${pb}`] = getCompat(players[pa]?.ratings ?? {}, players[pb]?.ratings ?? {}, allMovies)
    }))
    return map
  }, [players, allMovies.length])

  const bestPair = useMemo(() => {
    let best = null, bestScore = -1
    Object.entries(compat).forEach(([k, v]) => { if (v !== null && v > bestScore) { bestScore = v; best = k } })
    return best ? { pair: best.split('_'), score: bestScore } : null
  }, [compat])

  // Most controversial: highest ELO spread across players
  const controversialMovie = useMemo(() => {
    let maxSpread = 0, result = null
    allMovies.forEach(m => {
      const elos = PLAYERS.map(p => players[p]?.ratings?.[m.id]).filter(r => r?.matches > 0).map(r => r.elo)
      if (elos.length >= 2) {
        const spread = Math.max(...elos) - Math.min(...elos)
        if (spread > maxSpread) { maxSpread = spread; result = { movie: m, spread } }
      }
    })
    return result
  }, [players])

  // Group agreement: does everyone's #1 match global #1?
  const globalTop = [...allMovies].filter(m => globalRatings[m.id]?.matches > 0)
    .sort((a,b) => globalRatings[b.id].elo - globalRatings[a.id].elo)[0]

  const agreements = PLAYERS.map(p => {
    const r = players[p]?.ratings ?? {}
    const top = [...allMovies].filter(m => r[m.id]?.matches > 0).sort((a,b) => (r[b.id]?.elo||0) - (r[a.id]?.elo||0))[0]
    return { player: p, agrees: top && globalTop && top.id === globalTop.id }
  })

  return (
    <PageWrapper>
      <div className="p-4 space-y-4">

        {/* Best pair insight */}
        {bestPair ? (
          <motion.div initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }}
            className="bg-gold/8 border border-gold/20 rounded-2xl p-5 text-center">
            <p className="text-[9px] font-bold text-gold/50 tracking-[0.2em] uppercase mb-2">Most compatible pair</p>
            <p className="text-base font-bold text-ink-primary">
              <span style={{ color: PLAYER_COLORS[bestPair.pair[0]] }}>{bestPair.pair[0]}</span>
              <span className="text-ink-muted mx-2.5 font-normal">&</span>
              <span style={{ color: PLAYER_COLORS[bestPair.pair[1]] }}>{bestPair.pair[1]}</span>
            </p>
            <p className="text-3xl font-black text-gold mt-1.5">{bestPair.score}%</p>
            <p className="text-[10px] text-ink-muted mt-0.5">taste agreement</p>
          </motion.div>
        ) : (
          <div className="bg-surface border border-border rounded-2xl p-4 text-center text-ink-muted text-sm">
            Vote more to unlock compatibility insights!
          </div>
        )}

        {/* Agreement with group #1 */}
        {globalTop && (
          <div className="bg-surface border border-border rounded-2xl p-4 hover:border-gold/30 hover:-translate-y-0.5 transition-all duration-200">
            <p className="text-[10px] font-bold text-ink-muted tracking-widest uppercase mb-3">
              Who agrees the group #1 is <span className="text-gold">{globalTop.title}</span>?
            </p>
            <div className="flex flex-wrap gap-2">
              {agreements.map(a => (
                <div key={a.player} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                  a.agrees ? 'border-win/30 bg-win/8 text-win' : 'border-border text-ink-muted'
                }`}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PLAYER_COLORS[a.player] }} />
                  {a.player} {a.agrees ? '✓' : '—'}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Most controversial */}
        {controversialMovie && (
          <div className="flex items-center gap-3 bg-surface border border-border rounded-2xl p-4 cursor-pointer hover:border-gold/30 transition-colors" onClick={() => openMovieModal(controversialMovie.movie.id)}>
            <PosterImage movieId={controversialMovie.movie.id} imdbId={controversialMovie.movie?.imdbId} tmdbId={controversialMovie.movie?.tmdbId} fallbackSrc={controversialMovie.movie.img} className="w-9 h-14 object-cover rounded-lg flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-0.5">Most divisive</p>
              <p className="text-sm font-bold text-ink-primary truncate">{controversialMovie.movie.title}</p>
              <p className="text-[10px] text-ink-muted">{controversialMovie.spread} ELO spread between players</p>
            </div>
          </div>
        )}

        {/* Player profiles */}
        <div>
          <p className="text-[10px] font-bold text-ink-muted tracking-widest uppercase mb-3">Player Profiles</p>
          <div className="space-y-3">
            {PLAYERS.map((p, i) => {
              const pd = players[p]; const r = pd?.ratings ?? {}
              const voted = Object.values(r).filter(x => x.matches > 0).length
              const top = [...allMovies].filter(m => r[m.id]?.matches > 0).sort((a,b) => (r[b.id]?.elo||0)-(r[a.id]?.elo||0))[0]
              const totalW = Object.values(r).reduce((s,x) => s+(x.wins||0),0)
              const totalM = Object.values(r).reduce((s,x) => s+(x.matches||0),0)
              const wr = totalM > 0 ? Math.round(totalW/totalM*100) : 0
              return (
                <motion.div key={p} initial={{ opacity:0,x:-8 }} animate={{ opacity:1,x:0 }} transition={{ delay:i*0.06 }}
                  className="bg-surface border border-border rounded-2xl p-4 hover:border-gold/30 hover:-translate-y-0.5 transition-all duration-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-black flex-shrink-0"
                      style={{ background: PLAYER_COLORS[p] }}>{p[0]}</div>
                    <div className="flex-1">
                      <p className="font-bold text-sm text-ink-primary">{p}</p>
                      <p className="text-[10px] text-ink-muted">{voted} movies rated</p>
                    </div>
                    {top && <PosterImage movieId={top.id} imdbId={top?.imdbId} tmdbId={top?.tmdbId} fallbackSrc={top.img} className="w-8 h-12 object-cover rounded-lg flex-shrink-0 opacity-80" />}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label:'Matchups', value:pd?.matchCount??0 },
                      { label:'Win rate', value:totalM>0?`${wr}%`:'—' },
                      { label:'Top ELO', value:top?(r[top.id]?.elo??1000):'—' },
                    ].map(s => (
                      <div key={s.label} className="bg-raised rounded-xl p-2 text-center">
                        <div className="text-sm font-bold text-ink-primary font-mono">{s.value}</div>
                        <div className="text-[9px] text-ink-muted mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Compatibility matrix */}
        <div>
          <p className="text-[10px] font-bold text-ink-muted tracking-widest uppercase mb-3">Taste Compatibility</p>
          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto no-scrollbar"><table className="w-full text-xs min-w-[280px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-3 text-ink-muted font-semibold text-left">vs</th>
                  {PLAYERS.map(p => <th key={p} className="p-3 font-bold text-center" style={{ color:PLAYER_COLORS[p] }}>{p[0]}</th>)}
                </tr>
              </thead>
              <tbody>
                {PLAYERS.map((pa, ri) => (
                  <tr key={pa} className={ri < PLAYERS.length-1 ? 'border-b border-border/40' : ''}>
                    <td className="p-3 font-bold" style={{ color:PLAYER_COLORS[pa] }}>{pa[0]}</td>
                    {PLAYERS.map(pb => {
                      if (pa===pb) return <td key={pb} className="p-3 text-center text-ink-muted/30">—</td>
                      const v = compat[[pa,pb].sort().join('_')]
                      return <td key={pb} className={`p-3 text-center font-bold font-mono ${v===null?'text-ink-muted':v>=75?'text-win':v>=50?'text-gold':'text-lose'}`}>
                        {v===null?'?':`${v}%`}
                      </td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
