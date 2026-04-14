import React, { useState, useRef, useEffect, useCallback } from 'react'
import { MOVIES } from '../../lib/movies'

const COLS = 20, ROWS = 18, CELL = 22
const W = COLS * CELL, H = ROWS * CELL

// Rough box office order (lowest to highest) - use ELO rank as proxy
const RANKED_MOVIES = [...MOVIES].filter(m => m.img)

export default function BoxOfficeSnake({ onEnd }) {
  const [phase, setPhase] = useState('idle')
  const [score, setScore] = useState(0)
  const [nextTarget, setNextTarget] = useState(null)
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const rafRef = useRef(null)
  const dirRef = useRef({ x: 1, y: 0 })

  const start = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')
    const order = [...RANKED_MOVIES].sort(() => Math.random() - 0.5)
    const imgCache = {}
    order.forEach(m => { const img = new Image(); img.src = m.img; imgCache[m.id] = img })
    dirRef.current = { x: 1, y: 0 }

    // Place first food
    const food = order[0]
    const fx = Math.floor(Math.random() * (COLS - 2)) + 1
    const fy = Math.floor(Math.random() * (ROWS - 2)) + 1

    stateRef.current = {
      active: true, score: 0, frame: 0, tickRate: 8,
      snake: [{ x: 10, y: 9 }, { x: 9, y: 9 }, { x: 8, y: 9 }],
      food: { x: fx, y: fy, movie: food, img: imgCache[food.id] },
      order, orderIdx: 0, imgCache,
    }
    setPhase('playing')
    setNextTarget(food.title)

    function draw() {
      const s = stateRef.current; if (!s) return
      ctx.fillStyle = '#09080A'; ctx.fillRect(0, 0, W, H)
      // Grid
      ctx.strokeStyle = 'rgba(42,42,46,0.5)'; ctx.lineWidth = 0.5
      for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x*CELL,0); ctx.lineTo(x*CELL,H); ctx.stroke() }
      for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0,y*CELL); ctx.lineTo(W,y*CELL); ctx.stroke() }
      // Food
      const f = s.food
      if (f.img?.complete) ctx.drawImage(f.img, f.x*CELL+1, f.y*CELL+1, CELL-2, CELL-2)
      else { ctx.fillStyle = '#c8a040'; ctx.fillRect(f.x*CELL+2, f.y*CELL+2, CELL-4, CELL-4) }
      ctx.strokeStyle = '#c8a040'; ctx.lineWidth = 2
      ctx.strokeRect(f.x*CELL+1, f.y*CELL+1, CELL-2, CELL-2)
      // Snake
      s.snake.forEach((seg, i) => {
        const t = 1 - i / s.snake.length
        ctx.fillStyle = `rgba(200,160,64,${0.3 + t * 0.7})`
        ctx.fillRect(seg.x*CELL+1, seg.y*CELL+1, CELL-2, CELL-2)
      })
      // Head
      ctx.fillStyle = '#f0c048'
      ctx.fillRect(s.snake[0].x*CELL+1, s.snake[0].y*CELL+1, CELL-2, CELL-2)
    }

    function tick() {
      const s = stateRef.current; if (!s?.active) return
      s.frame++
      if (s.frame % s.tickRate !== 0) { draw(); rafRef.current = requestAnimationFrame(tick); return }

      const dir = dirRef.current
      const head = s.snake[0]
      const nx = head.x + dir.x, ny = head.y + dir.y
      // Wall collision
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
        s.active = false; setScore(s.score); setPhase('dead'); draw(); return
      }
      // Self collision
      if (s.snake.some(seg => seg.x === nx && seg.y === ny)) {
        s.active = false; setScore(s.score); setPhase('dead'); draw(); return
      }
      s.snake.unshift({ x: nx, y: ny })
      // Eat food
      if (nx === s.food.x && ny === s.food.y) {
        s.score += 100 + s.snake.length * 10
        s.orderIdx++
        s.tickRate = Math.max(4, Math.floor(s.tickRate - 0.5))
        if (s.orderIdx >= s.order.length) { s.active = false; setScore(s.score); setPhase('win'); draw(); return }
        const next = s.order[s.orderIdx]
        let fx, fy
        do { fx = Math.floor(Math.random()*(COLS-2))+1; fy = Math.floor(Math.random()*(ROWS-2))+1 }
        while (s.snake.some(seg => seg.x === fx && seg.y === fy))
        s.food = { x: fx, y: fy, movie: next, img: s.imgCache[next.id] }
        setScore(s.score); setNextTarget(next.title)
      } else {
        s.snake.pop()
      }
      draw()
      if (s.active) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    const handler = e => {
      const map = { ArrowUp:{x:0,y:-1}, ArrowDown:{x:0,y:1}, ArrowLeft:{x:-1,y:0}, ArrowRight:{x:1,y:0} }
      const d = map[e.key]; if (!d) return
      e.preventDefault()
      const cur = dirRef.current
      if (d.x !== -cur.x || d.y !== -cur.y) dirRef.current = d
    }
    window.addEventListener('keydown', handler)
    return () => { window.removeEventListener('keydown', handler); cancelAnimationFrame(rafRef.current) }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#09080A'; ctx.fillRect(0, 0, W, H)
  }, [])

  const swipeRef = useRef(null)

  return (
    <div className="absolute inset-0 flex flex-col gap-2 p-2">
      {phase === 'playing' && nextTarget && (
        <div className="px-3 py-2 bg-gold/10 border border-gold/20 rounded-xl text-center">
          <span className="text-[10px] text-gold/60 font-semibold uppercase tracking-widest">Next target: </span>
          <span className="text-xs font-bold text-gold truncate">{nextTarget}</span>
        </div>
      )}
      <div className="relative flex-1 flex items-center justify-center">
        <canvas ref={canvasRef} className="block rounded-2xl bg-base"
          style={{ touchAction:"none", maxWidth:"100%", maxHeight:"100%", width:"auto", height:"auto", aspectRatio:`${W}/${H}` }}
          onTouchStart={e => { swipeRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
          onTouchEnd={e => {
            if (!swipeRef.current) return
            const dx = e.changedTouches[0].clientX - swipeRef.current.x
            const dy = e.changedTouches[0].clientY - swipeRef.current.y
            const cur = dirRef.current
            if (Math.abs(dx) > Math.abs(dy)) {
              const d = dx > 0 ? {x:1,y:0} : {x:-1,y:0}
              if (d.x !== -cur.x) dirRef.current = d
            } else {
              const d = dy > 0 ? {x:0,y:1} : {x:0,y:-1}
              if (d.y !== -cur.y) dirRef.current = d
            }
            swipeRef.current = null
          }}
        />
        {phase !== 'playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 rounded-2xl">
            {(phase === 'dead' || phase === 'win') ? (
              <>
                <div className="text-4xl mb-2">{phase === 'win' ? '🏆' : '💀'}</div>
                <div className="text-lg font-black text-white mb-1">{phase === 'win' ? 'You won!' : 'Game Over'}</div>
                <div className="text-3xl font-black text-gold font-mono mb-4">{score}</div>
                <div className="flex gap-3">
                  <button onClick={start} className="px-5 py-2.5 bg-gold text-black font-bold rounded-xl text-sm">Play Again</button>
                  <button onClick={() => onEnd(score)} className="px-5 py-2.5 bg-surface border border-border rounded-xl text-sm font-semibold text-ink-secondary">Done</button>
                </div>
              </>
            ) : (
              <>
                <div className="text-4xl mb-3">🐍🎬</div>
                <div className="text-lg font-black text-white mb-1">Box Office Snake</div>
                <div className="text-xs text-ink-muted mb-4 text-center max-w-xs">Eat the movie posters in order.<br/>Arrow keys or swipe to move.</div>
                <button onClick={start} className="px-6 py-3 bg-gold text-black font-bold rounded-xl">Start →</button>
              </>
            )}
          </div>
        )}
      </div>
      {phase === 'playing' && (
        <div className="flex-shrink-0 grid grid-cols-3 gap-2">
          <div />
          <button onPointerDown={() => { const c=dirRef.current; if(c.y!==1) dirRef.current={x:0,y:-1} }} className="py-3 bg-surface border border-border rounded-xl text-lg active:scale-95 transition-transform">↑</button>
          <div />
          <button onPointerDown={() => { const c=dirRef.current; if(c.x!==1) dirRef.current={x:-1,y:0} }} className="py-3 bg-surface border border-border rounded-xl text-lg active:scale-95 transition-transform">←</button>
          <button onPointerDown={() => { const c=dirRef.current; if(c.y!==-1) dirRef.current={x:0,y:1} }} className="py-3 bg-surface border border-border rounded-xl text-lg active:scale-95 transition-transform">↓</button>
          <button onPointerDown={() => { const c=dirRef.current; if(c.x!==-1) dirRef.current={x:1,y:0} }} className="py-3 bg-surface border border-border rounded-xl text-lg active:scale-95 transition-transform">→</button>
        </div>
      )}
    </div>
  )
}
