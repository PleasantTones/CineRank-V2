import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MOVIES } from '../../lib/movies'
import { getCachedPoster, fetchPoster } from '../../lib/posters'

const GRID = 3  // 3x3 = 8 tiles + 1 blank
const TILE_COUNT = GRID * GRID

function shuffle(tiles) {
  // Generate random solvable state via random valid moves
  let t = [...tiles]
  let blank = t.indexOf(TILE_COUNT - 1)
  for (let i = 0; i < 500; i++) {
    const neighbors = getNeighbors(blank)
    const n = neighbors[Math.floor(Math.random() * neighbors.length)]
    ;[t[blank], t[n]] = [t[n], t[blank]]
    blank = n
  }
  return t
}

function getNeighbors(idx) {
  const row = Math.floor(idx / GRID), col = idx % GRID
  const n = []
  if (row > 0) n.push(idx - GRID)
  if (row < GRID - 1) n.push(idx + GRID)
  if (col > 0) n.push(idx - 1)
  if (col < GRID - 1) n.push(idx + 1)
  return n
}

function isSolved(tiles) {
  return tiles.every((t, i) => t === i)
}

export default function PosterFlip({ onEnd }) {
  const [phase, setPhase] = useState('idle')
  const [movie, setMovie] = useState(null)
  const [posterUrl, setPosterUrl] = useState(null)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [tiles, setTiles] = useState(() => Array.from({ length: TILE_COUNT }, (_, i) => i))
  const [moves, setMoves] = useState(0)
  const [elapsed, setElapsed] = useState(0)   // seconds elapsed
  const [score, setScore] = useState(0)
  const [sliding, setSliding] = useState(null)  // tile index being slid
  const imgRef = useRef(null)

  const pickMovie = useCallback(() => {
    const pool = MOVIES.filter(m => m.img)
    const m = pool[Math.floor(Math.random() * pool.length)]
    setMovie(m)
    setImgLoaded(false)
    setPosterUrl(m.img)  // start with thumbnail
    const cached = getCachedPoster(m.id)
    if (cached) setPosterUrl(cached)
    else fetchPoster(m.id).then(url => { if (url) setPosterUrl(url) })
  }, [])

  const start = useCallback(() => {
    pickMovie()
    const solved = Array.from({ length: TILE_COUNT }, (_, i) => i)
    const shuffled = shuffle(solved)
    setTiles(shuffled)
    setMoves(0)
    setTimeLeft(90)
    setScore(0)
    setPhase('playing')
  }, [pickMovie])

  // Timer
  useEffect(() => {
    if (phase !== 'playing') return
    const t = setInterval(() => {
      setTimeLeft(tt => {
        if (tt <= 1) { clearInterval(t); setPhase('timeout'); return 0 }
        return tt - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [phase])

  // Check solved
  useEffect(() => {
    if (phase !== 'playing') return
    if (isSolved(tiles)) {
      const pts = Math.max(50, Math.round(8000 / Math.max(1, moves) / Math.max(1, elapsed) * 60))
      setScore(pts)
      setPhase('solved')
    }
  }, [tiles])

  const tap = useCallback((idx) => {
    if (phase !== 'playing') return
    const blank = tiles.indexOf(TILE_COUNT - 1)
    if (!getNeighbors(blank).includes(idx)) return
    setSliding(idx)
    setTimeout(() => {
      setTiles(prev => {
        const next = [...prev]
        ;[next[blank], next[idx]] = [next[idx], next[blank]]
        return next
      })
      setMoves(m => m + 1)
      setSliding(null)
    }, 80)
  }, [tiles, phase])

  const tileSize = 96  // px per tile
  const gap = 3
  const boardSize = tileSize * GRID + gap * (GRID - 1)


  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-base p-4 gap-4">
      {phase === 'idle' && (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="text-5xl">🧩</div>
          <h2 className="text-2xl font-black text-ink-primary">Poster Flip</h2>
          <p className="text-sm text-ink-muted max-w-xs">Slide the tiles to reconstruct the movie poster. Fewer moves = more points.</p>
          <button onClick={start} className="px-8 py-3 bg-gold text-black font-black rounded-xl text-lg">Play</button>
        </div>
      )}

      {(phase === 'playing' || phase === 'solved' || phase === 'timeout') && (
        <>
          {/* HUD */}
          <div className="w-full flex items-center justify-between px-2" style={{ maxWidth: boardSize }}>
            <div className="text-xs font-bold text-ink-muted">MOVES <span className="text-ink-primary font-mono text-base ml-1">{moves}</span></div>
            <div className="font-black font-mono text-lg text-ink-muted">{elapsed}s</div>
            <div className="text-xs font-bold text-ink-muted">TILES <span className="text-gold font-mono text-base ml-1">
              {tiles.filter((t, i) => t === i && t !== TILE_COUNT - 1).length}/{TILE_COUNT - 1}
            </span></div>
          </div>

          {/* Board */}
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{ width: boardSize, height: boardSize, background: '#0a0a0c', flexShrink: 0 }}
          >
            {tiles.map((tileVal, idx) => {
              if (tileVal === TILE_COUNT - 1) return null  // blank
              const row = Math.floor(idx / GRID)
              const col = idx % GRID
              const srcRow = Math.floor(tileVal / GRID)
              const srcCol = tileVal % GRID
              const isCorrect = tileVal === idx
              return (
                <div
                  key={tileVal}
                  onClick={() => tap(idx)}
                  style={{
                    position: 'absolute',
                    left: col * (tileSize + gap),
                    top: row * (tileSize + gap),
                    width: tileSize,
                    height: tileSize,
                    transition: sliding === idx ? 'none' : 'left 0.08s ease, top 0.08s ease',
                    cursor: getNeighbors(tiles.indexOf(TILE_COUNT - 1)).includes(idx) ? 'pointer' : 'default',
                    borderRadius: 6,
                    overflow: 'hidden',
                    outline: isCorrect ? '2px solid rgba(52,211,153,0.7)' : '1px solid rgba(200,160,64,0.15)',
                    boxShadow: isCorrect ? '0 0 8px rgba(52,211,153,0.3)' : 'none',
                    userSelect: 'none',
                  }}
                >
                  {posterUrl ? (
                    <div style={{
                      width: tileSize * GRID + gap * (GRID - 1),
                      height: tileSize * GRID + gap * (GRID - 1),
                      backgroundImage: `url(${posterUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      transform: `translate(-${srcCol * (tileSize + gap)}px, -${srcRow * (tileSize + gap)}px)`,
                    }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: '#1a1208', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: 'rgba(200,160,64,0.4)', fontSize: 24 }}>🎬</span>
                    </div>
                  )}
                  {/* Tile number hint (subtle) */}
                  <div style={{
                    position: 'absolute', bottom: 2, right: 4,
                    fontSize: 9, color: 'rgba(255,255,255,0.2)', fontWeight: 'bold', fontFamily: 'monospace'
                  }}>{tileVal + 1}</div>
                </div>
              )
            })}
          </div>

          {/* Movie name (hidden until solved) */}
          {phase === 'solved' || phase === 'timeout' ? (
            <div className="text-center">
              <p className="text-xs text-ink-muted mb-1">
                {phase === 'solved' ? '✅ Solved!' : '⏱️ Time\'s up —'}
              </p>
              <p className="font-bold text-ink-primary">{movie?.title}</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-[11px] text-ink-muted">Tap a tile next to the gap to slide it</p>
            </div>
          )}

          {/* End state */}
          {(phase === 'solved' || phase === 'timeout') && (
            <div className="flex flex-col items-center gap-3">
              {phase === 'solved' && (
                <div className="text-center">
                  <div className="text-3xl font-black text-gold font-mono">{score} pts</div>
                  <div className="text-xs text-ink-muted mt-1">{moves} moves · {elapsed}s</div>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={start} className="px-5 py-2.5 bg-gold text-black font-bold rounded-xl text-sm">Next Poster</button>
                <button onClick={() => onEnd(score)} className="px-5 py-2.5 bg-surface border border-border rounded-xl text-sm font-semibold text-ink-secondary">Done</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
