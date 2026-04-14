import React, { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { MOVIES } from '../../lib/movies'

const W = 600, H = 400
const LANES = [150, 300, 450]

function drawHallway(ctx, frame, obstacles, lane, lives, score) {
  // Sky/ceiling
  ctx.fillStyle = '#0e0c14'
  ctx.fillRect(0, 0, W, H)
  // Floor perspective
  const vx = W/2, vy = H*0.42
  ctx.fillStyle = '#1a1008'
  ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W, H); ctx.lineTo(vx+180, vy); ctx.lineTo(vx-180, vy); ctx.closePath(); ctx.fill()
  // Walls
  const wallGrad = ctx.createLinearGradient(0, 0, 0, H)
  wallGrad.addColorStop(0, '#14101a'); wallGrad.addColorStop(1, '#0e0c12')
  ctx.fillStyle = wallGrad; ctx.fillRect(0, 0, vx-180, H); ctx.fillRect(vx+180, 0, W-(vx+180), H)
  // Corridor lines
  ctx.strokeStyle = 'rgba(200,160,64,0.08)'; ctx.lineWidth = 1
  for (let x = -3; x <= 3; x++) {
    ctx.beginPath(); ctx.moveTo(vx + x * 180, vy); ctx.lineTo(vx + x * 600, H); ctx.stroke()
  }
  // Floor lines
  for (let i = 0; i < 6; i++) {
    const t = i / 6; const y = vy + (H - vy) * Math.pow(t, 1.5)
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }
  // Obstacles (poster slabs)
  obstacles.forEach(ob => {
    const z = ob.z; const scale = 1 - z * 0.7
    const x = LANES[ob.lane] + (LANES[ob.lane] - vx) * z * 0.3
    const w = 80 * scale, h = 120 * scale
    const alpha = Math.max(0, 1 - z * 0.3)
    ctx.save(); ctx.globalAlpha = alpha
    if (ob.img?.complete) {
      ctx.drawImage(ob.img, x - w/2, vy + (H - vy) * (1 - z) - h, w, h)
    } else {
      ctx.fillStyle = '#2a1a08'; ctx.fillRect(x - w/2, vy + (H - vy) * (1 - z) - h, w, h)
    }
    ctx.strokeStyle = ob.hit ? '#f87171' : '#c8a040'; ctx.lineWidth = 2 * scale
    ctx.strokeRect(x - w/2, vy + (H - vy) * (1 - z) - h, w, h)
    ctx.restore()
  })
  // Player
  const px = LANES[lane], py = H - 60
  ctx.save()
  ctx.fillStyle = '#c8a040'
  ctx.beginPath(); ctx.ellipse(px, py, 18, 10, 0, 0, Math.PI*2); ctx.fill()
  ctx.fillStyle = '#f5e6c0'
  ctx.beginPath(); ctx.arc(px, py - 20, 14, 0, Math.PI*2); ctx.fill()
  ctx.restore()
  // HUD
  ctx.fillStyle = 'rgba(200,160,64,0.9)'; ctx.font = 'bold 18px Inter,sans-serif'
  ctx.textAlign = 'right'; ctx.fillText(score, W - 16, 30)
  ctx.textAlign = 'left'; ctx.fillText('❤️'.repeat(lives), 12, 30)
}

export default function CinemaRunner({ onEnd }) {
  const [phase, setPhase] = useState('idle') // idle | playing | dead
  const [score, setScore] = useState(0)
  const stateRef = useRef(null)
  const rafRef = useRef(null)
  const canvasRef = useRef(null)

  const start = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')
    const pool = [...MOVIES].filter(m => m.img).sort(() => Math.random() - 0.5)
    const imgCache = {}
    pool.forEach(m => { const img = new Image(); img.src = m.img; imgCache[m.id] = img })

    stateRef.current = {
      active: true, score: 0, speed: 1.2, frame: 0,
      lane: 1, targetLane: 1,
      obstacles: [], lives: 3, lastSpawn: 0, pool, poolIdx: 0, imgCache
    }
    setPhase('playing')

    function loop() {
      const s = stateRef.current; if (!s?.active) return
      s.frame++; s.score += 0.1; s.speed = 1.2 + s.frame * 0.0008
      // Smooth lane
      if (s.lane !== s.targetLane) s.lane = s.targetLane
      // Spawn
      if (s.frame - s.lastSpawn > Math.max(40, 90 - s.speed * 10)) {
        const lane = Math.floor(Math.random() * 3)
        const m = s.pool[s.poolIdx % s.pool.length]; s.poolIdx++
        s.obstacles.push({ lane, z: 0.98, movieId: m.id, img: s.imgCache[m.id], hit: false })
        s.lastSpawn = s.frame
      }
      // Move obstacles
      s.obstacles.forEach(ob => { ob.z -= 0.018 * s.speed })
      // Collision
      s.obstacles.forEach(ob => {
        if (!ob.hit && ob.z < 0.12 && ob.z > -0.05 && ob.lane === s.lane) {
          ob.hit = true; s.lives--
          if (s.lives <= 0) { s.active = false; setScore(Math.round(s.score)); setPhase('dead') }
        }
      })
      s.obstacles = s.obstacles.filter(ob => ob.z > -0.1)
      drawHallway(ctx, s.frame, s.obstacles, s.lane, s.lives, Math.round(s.score))
      if (s.active) rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [])

  const changeLane = useCallback((dir) => {
    if (!stateRef.current?.active) return
    stateRef.current.targetLane = Math.max(0, Math.min(2, stateRef.current.targetLane + dir))
  }, [])

  // Keyboard
  React.useEffect(() => {
    const handler = e => {
      if (e.key === 'ArrowLeft') changeLane(-1)
      if (e.key === 'ArrowRight') changeLane(1)
    }
    window.addEventListener('keydown', handler)
    return () => { window.removeEventListener('keydown', handler); cancelAnimationFrame(rafRef.current) }
  }, [changeLane])

  React.useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    drawHallway(ctx, 0, [], 1, 3, 0)
  }, [])

  return (
    <div className="space-y-3">
      <div className="relative">
        <canvas ref={canvasRef} className="block w-full rounded-2xl bg-raised" style={{ touchAction: "none" }}
          style={{ aspectRatio: `${W}/${H}` }} />
        {phase !== 'playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 rounded-2xl">
            {phase === 'dead' ? (
              <>
                <div className="text-4xl mb-3">💀</div>
                <div className="text-lg font-black text-white mb-1">Game Over</div>
                <div className="text-3xl font-black text-gold font-mono mb-4">{score}</div>
                <div className="flex gap-3">
                  <button onClick={start} className="px-5 py-2.5 bg-gold text-black font-bold rounded-xl text-sm">Play Again</button>
                  <button onClick={() => onEnd(score)} className="px-5 py-2.5 bg-surface border border-border rounded-xl text-sm font-semibold text-ink-secondary">Done</button>
                </div>
              </>
            ) : (
              <>
                <div className="text-4xl mb-3">🎬</div>
                <div className="text-lg font-black text-white mb-1">Cinema Runner</div>
                <div className="text-xs text-ink-muted mb-4 text-center max-w-xs">Dodge movie posters flying at you.<br/>Switch lanes to avoid them.</div>
                <button onClick={start} className="px-6 py-3 bg-gold text-black font-bold rounded-xl">Start Running →</button>
              </>
            )}
          </div>
        )}
      </div>
      {phase === 'playing' && (
        <div className="grid grid-cols-2 gap-2">
          <button onPointerDown={() => changeLane(-1)} className="py-4 bg-surface border border-border rounded-xl text-2xl font-bold active:scale-95 transition-transform">←</button>
          <button onPointerDown={() => changeLane(1)} className="py-4 bg-surface border border-border rounded-xl text-2xl font-bold active:scale-95 transition-transform">→</button>
        </div>
      )}
    </div>
  )
}
