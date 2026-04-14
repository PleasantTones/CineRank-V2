import React, { useState, useRef, useCallback, useEffect } from 'react'
import { MOVIES } from '../../lib/movies'

const W = 360, H = 480
const CATEGORIES = [
  { label: 'Action movies',  filter: m => /action|fight|war|battle|mission|running|runner|ninja|matrix|gladiator/i.test(m.title) },
  { label: 'Drama films',    filter: m => /drama|story|love|life|family|father|mother|son|daughter|journey/i.test(m.title) },
  { label: 'Animated films', filter: m => /zootopia|shrek|moana|avatar|lego|minion|toy|pixar|cartoon/i.test(m.title) },
  { label: 'Any movie',      filter: () => true },
]

export default function PosterCatch({ onEnd }) {
  const [phase, setPhase] = useState('idle')
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const rafRef = useRef(null)

  const start = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')
    const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]
    const targets = MOVIES.filter(cat.filter)
    const others = MOVIES.filter(m => !cat.filter(m))
    const imgCache = {}
    MOVIES.forEach(m => { const img = new Image(); img.src = m.img; imgCache[m.id] = img })

    stateRef.current = {
      active: true, score: 0, lives: 3, frame: 0,
      basketX: W/2, basketW: 80,
      falling: [], spawnTimer: 0,
      targets, others, imgCache, cat,
      dragging: false, touchX: null
    }
    setPhase('playing')
    setLives(3)

    function loop() {
      const s = stateRef.current; if (!s?.active) return
      s.frame++; s.spawnTimer++
      if (s.spawnTimer > 55) {
        s.spawnTimer = 0
        const isTarget = Math.random() > 0.45
        const pool = isTarget ? s.targets : s.others
        const m = pool[Math.floor(Math.random() * pool.length)]
        if (m) s.falling.push({ m, x: 20 + Math.random() * (W-40), y: -80, vy: 2.2 + Math.random(), img: s.imgCache[m.id], isTarget })
      }
      s.falling.forEach(f => { f.y += f.vy; f.vy += 0.04 })
      // Catch check
      s.falling = s.falling.filter(f => {
        const bx = s.basketX, by = H - 50, bw = s.basketW
        if (f.y + 60 >= by && f.x > bx - bw/2 && f.x < bx + bw/2) {
          if (f.isTarget) { s.score += 100 }
          else { s.lives--; if (s.lives <= 0) { s.active = false; setScore(s.score); setPhase('dead'); return false } }
          setScore(s.score); setLives(s.lives)
          return false
        }
        return f.y < H + 80
      })
      // Draw
      ctx.fillStyle = '#09080A'; ctx.fillRect(0, 0, W, H)
      // Category label
      ctx.fillStyle = 'rgba(200,160,64,0.9)'; ctx.font = 'bold 13px Inter,sans-serif'; ctx.textAlign = 'center'
      ctx.fillText(`Catch: ${s.cat.label}`, W/2, 28)
      ctx.fillStyle = 'rgba(200,160,64,0.6)'; ctx.font = '11px Inter,sans-serif'
      ctx.fillText(`${s.score} pts`, W/2, 46)
      // Lives
      ctx.textAlign = 'right'; ctx.font = '16px serif'
      ctx.fillText('❤️'.repeat(s.lives), W - 12, 30)
      // Falling posters
      s.falling.forEach(f => {
        if (f.img?.complete) ctx.drawImage(f.img, f.x - 30, f.y - 45, 60, 90)
        else { ctx.fillStyle = '#2a1a08'; ctx.fillRect(f.x-30, f.y-45, 60, 90) }
        if (f.isTarget) {
          ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 2
          ctx.strokeRect(f.x-30, f.y-45, 60, 90)
        }
      })
      // Basket
      ctx.fillStyle = '#c8a040'
      ctx.beginPath(); ctx.moveTo(s.basketX - s.basketW/2, H-40)
        .lineTo(s.basketX + s.basketW/2, H-40)
        .lineTo(s.basketX + s.basketW/2 - 8, H-20)
        .lineTo(s.basketX - s.basketW/2 + 8, H-20)
      ctx.closePath(); ctx.fill()
      if (s.active) rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    // Touch controls
    const move = e => {
      const rect = canvas.getBoundingClientRect()
      const touch = e.touches ? e.touches[0] : e
      const scaleX = W / rect.width
      if (stateRef.current) stateRef.current.basketX = Math.max(40, Math.min(W-40, (touch.clientX - rect.left) * scaleX))
    }
    canvas.addEventListener('mousemove', move)
    canvas.addEventListener('touchmove', move, { passive: true })
    return () => { canvas.removeEventListener('mousemove', move); canvas.removeEventListener('touchmove', move) }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#09080A'; ctx.fillRect(0, 0, W, H)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <canvas ref={canvasRef} className="rounded-2xl" style={{ touchAction:"none", width:"100%", height:"100%", objectFit:"contain", display:"block" }} />
        {phase !== 'playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 rounded-2xl">
            {phase === 'dead' ? (
              <>
                <div className="text-4xl mb-3">🎪</div>
                <div className="text-lg font-black text-white mb-1">Game Over</div>
                <div className="text-3xl font-black text-gold font-mono mb-4">{score}</div>
                <div className="flex gap-3">
                  <button onClick={start} className="px-5 py-2.5 bg-gold text-black font-bold rounded-xl text-sm">Play Again</button>
                  <button onClick={() => onEnd(score)} className="px-5 py-2.5 bg-surface border border-border rounded-xl text-sm font-semibold text-ink-secondary">Done</button>
                </div>
              </>
            ) : (
              <>
                <div className="text-4xl mb-3">🎪</div>
                <div className="text-lg font-black text-white mb-1">Poster Catch</div>
                <div className="text-xs text-ink-muted mb-4 text-center max-w-xs">Move your basket to catch matching posters.<br/>Green border = target. Miss 3 = game over.</div>
                <button onClick={start} className="px-6 py-3 bg-gold text-black font-bold rounded-xl">Start Catching →</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
