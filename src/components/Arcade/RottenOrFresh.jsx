import React, { useState, useRef, useEffect, useCallback } from 'react'
import { MOVIES } from '../../lib/movies'

const W = 400, H = 420

export default function RottenOrFresh({ onEnd }) {
  const [phase, setPhase] = useState('idle')
  const [score, setScore] = useState(0)
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const rafRef = useRef(null)

  const start = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')
    const imgCache = {}
    MOVIES.forEach(m => { const img = new Image(); img.src = m.img; imgCache[m.id] = img })

    stateRef.current = {
      active: true, score: 0, lives: 3, frame: 0,
      basketX: W/2, basketW: 70,
      items: [], spawnTimer: 0, imgCache,
    }
    setPhase('playing')

    function loop() {
      const s = stateRef.current; if (!s?.active) return
      s.frame++; s.spawnTimer++
      if (s.spawnTimer > 45) {
        s.spawnTimer = 0
        const isPopcorn = Math.random() > 0.4
        const m = MOVIES[Math.floor(Math.random() * MOVIES.length)]
        const angle = Math.random() * Math.PI * 2
        const speed = 3 + Math.random() * 2
        s.items.push({
          x: Math.random() < 0.5 ? -30 : W + 30,
          y: H * 0.3 + Math.random() * H * 0.4,
          vx: Math.cos(angle) * speed * (Math.random() < 0.5 ? 1 : -1),
          vy: Math.sin(angle) * speed * 0.5 - 1,
          isPopcorn, m, img: s.imgCache[m.id],
          size: 36,
        })
      }
      s.items.forEach(it => { it.x += it.vx; it.y += it.vy; it.vy += 0.08 })
      // Basket catch
      s.items = s.items.filter(it => {
        const bx = s.basketX, by = H - 50, bw = s.basketW
        if (it.y + it.size/2 >= by && it.x > bx - bw/2 - it.size/2 && it.x < bx + bw/2 + it.size/2) {
          if (it.isPopcorn) s.score += 50
          else { s.lives--; if (s.lives <= 0) { s.active = false; setScore(s.score); setPhase('dead'); return false } }
          setScore(s.score)
          return false
        }
        return it.y < H + 60 && it.x > -60 && it.x < W + 60
      })
      // Draw
      ctx.fillStyle = '#09080A'; ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = 'rgba(200,160,64,0.8)'; ctx.font = 'bold 18px Inter,sans-serif'; ctx.textAlign = 'center'
      ctx.fillText(s.score, W/2, 32)
      ctx.textAlign = 'right'; ctx.font = '16px serif'
      ctx.fillText('❤️'.repeat(s.lives), W-12, 32)
      s.items.forEach(it => {
        ctx.save(); ctx.translate(it.x, it.y)
        if (it.isPopcorn) {
          ctx.font = `${it.size}px serif`; ctx.textAlign = 'center'; ctx.fillText('🍿', 0, it.size/3)
        } else {
          ctx.font = `${it.size}px serif`; ctx.textAlign = 'center'; ctx.fillText('🍅', 0, it.size/3)
        }
        ctx.restore()
      })
      // Basket
      ctx.fillStyle = '#c8a040'
      ctx.beginPath()
      ctx.moveTo(s.basketX - s.basketW/2, H-40)
      ctx.lineTo(s.basketX + s.basketW/2, H-40)
      ctx.lineTo(s.basketX + s.basketW/2 - 8, H-20)
      ctx.lineTo(s.basketX - s.basketW/2 + 8, H-20)
      ctx.closePath(); ctx.fill()
      if (s.active) rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    const move = e => {
      if (!stateRef.current) return
      const rect = canvas.getBoundingClientRect()
      const touch = e.touches ? e.touches[0] : e
      stateRef.current.basketX = Math.max(40, Math.min(W-40, (touch.clientX - rect.left) * (W/rect.width)))
    }
    canvas.addEventListener('mousemove', move)
    canvas.addEventListener('touchmove', move, { passive: true })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#09080A'; ctx.fillRect(0, 0, W, H)
    ctx.font = '48px serif'; ctx.textAlign = 'center'; ctx.fillText('🍿🍅', W/2, H/2)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      <div className="relative flex-1 min-h-0">
        <canvas ref={canvasRef} className="block w-full rounded-2xl bg-base"
          style={{ aspectRatio: `${W}/${H}`, touchAction: 'none' }} />
        {phase !== 'playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 rounded-2xl">
            {phase === 'dead' ? (
              <>
                <div className="text-4xl mb-2">🍅</div>
                <div className="text-lg font-black text-white mb-1">Splat!</div>
                <div className="text-3xl font-black text-gold font-mono mb-4">{score}</div>
                <div className="flex gap-3">
                  <button onClick={start} className="px-5 py-2.5 bg-gold text-black font-bold rounded-xl text-sm">Play Again</button>
                  <button onClick={() => onEnd(score)} className="px-5 py-2.5 bg-surface border border-border rounded-xl text-sm font-semibold text-ink-secondary">Done</button>
                </div>
              </>
            ) : (
              <>
                <div className="text-4xl mb-3">🍿🍅</div>
                <div className="text-lg font-black text-white mb-1">Rotten or Fresh?</div>
                <div className="text-xs text-ink-muted mb-4 text-center max-w-xs">Catch the 🍿 popcorn — dodge the 🍅 tomatoes.<br/>Move your basket left/right.</div>
                <button onClick={start} className="px-6 py-3 bg-gold text-black font-bold rounded-xl">Start →</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
