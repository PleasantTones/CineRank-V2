import React, { useState, useRef, useCallback, useEffect } from 'react'
import { MOVIES } from '../../lib/movies'

const W = 420, H = 560
const LANES = [-1, 0, 1]           // left / center / right offsets
const LANE_SEP = 130               // pixel separation at ground level
const VP_X = W / 2, VP_Y = H * 0.36  // vanishing point
const GROUND_Y = H - 40

function laneXAtZ(lane, z) {
  // z=0 → at player (ground), z=1 → horizon
  const base = VP_X + lane * LANE_SEP
  return VP_X + (base - VP_X) * (1 - z)
}

function drawHallway(ctx, frame, obstacles, playerLane, lives, score, speed) {
  // Sky / ceiling
  const sky = ctx.createLinearGradient(0, 0, 0, VP_Y)
  sky.addColorStop(0, '#08060f')
  sky.addColorStop(1, '#14101f')
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, VP_Y)

  // Floor
  const floor = ctx.createLinearGradient(0, VP_Y, 0, H)
  floor.addColorStop(0, '#12100a')
  floor.addColorStop(1, '#1e1808')
  ctx.fillStyle = floor; ctx.fillRect(0, VP_Y, W, H - VP_Y)

  // Corridor walls — left and right perspective planes
  const wallAlpha = 0.25
  ctx.fillStyle = `rgba(30,24,10,${wallAlpha})`
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(VP_X - LANE_SEP, VP_Y)
  ctx.lineTo(0, GROUND_Y); ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(VP_X + LANE_SEP, VP_Y)
  ctx.lineTo(W, GROUND_Y); ctx.closePath(); ctx.fill()

  // Gold corridor border lines
  ctx.strokeStyle = 'rgba(200,160,64,0.5)'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(VP_X - LANE_SEP, VP_Y); ctx.lineTo(0, GROUND_Y); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(VP_X + LANE_SEP, VP_Y); ctx.lineTo(W, GROUND_Y); ctx.stroke()

  // Scrolling floor grid lines
  const scroll = (frame * speed * 0.04) % 1
  for (let i = 0; i < 10; i++) {
    const t = Math.pow((i / 10 + scroll) % 1, 1.6)
    if (t < 0.05) continue
    const y = VP_Y + (GROUND_Y - VP_Y) * t
    const lx = VP_X - LANE_SEP + (0 - (VP_X - LANE_SEP)) * (1 - t)
    const rx = VP_X + LANE_SEP + (W - (VP_X + LANE_SEP)) * (1 - t)
    ctx.strokeStyle = `rgba(200,160,64,${0.06 + t * 0.12})`; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(rx, y); ctx.stroke()
  }
  // Lane dividers
  LANES.forEach(lane => {
    ctx.strokeStyle = 'rgba(200,160,64,0.10)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(VP_X + lane * 0, VP_Y)
    ctx.lineTo(VP_X + lane * LANE_SEP, GROUND_Y); ctx.stroke()
  })

  // Ceiling gold strip
  ctx.fillStyle = 'rgba(200,160,64,0.15)'; ctx.fillRect(VP_X - LANE_SEP, VP_Y - 2, LANE_SEP * 2, 3)

  // Obstacles — movie posters flying toward camera
  const sorted = [...obstacles].sort((a, b) => b.z - a.z)
  sorted.forEach(ob => {
    const z = ob.z  // 1=far, 0=close
    const scale = Math.pow(1 - z, 1.1) * 1.4 + 0.08
    const cx = laneXAtZ(LANES[ob.lane] * LANE_SEP / LANE_SEP, z)
    const pw = 72 * scale, ph = 108 * scale
    const px = cx - pw / 2
    const py = VP_Y + (GROUND_Y - VP_Y) * (1 - z) - ph + 10 * scale
    const alpha = Math.max(0, Math.min(1, (1 - z) * 3))
    if (alpha < 0.05) return
    ctx.save(); ctx.globalAlpha = alpha
    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.beginPath(); ctx.ellipse(cx, py + ph + 4, pw * 0.4, 6 * scale, 0, 0, Math.PI * 2); ctx.fill()
    // Gold frame
    const frameCol = ob.hit ? '#7f1d1d' : '#B8922A'
    ctx.fillStyle = frameCol; ctx.fillRect(px - 4*scale, py - 4*scale, pw + 8*scale, ph + 8*scale)
    // Dark mat
    ctx.fillStyle = '#1a0e04'; ctx.fillRect(px - 1, py - 1, pw + 2, ph + 2)
    // Poster image or fallback
    if (ob.img?.complete && ob.img.naturalWidth > 0) {
      ctx.drawImage(ob.img, px, py, pw, ph)
    } else {
      const grad = ctx.createLinearGradient(px, py, px, py + ph)
      grad.addColorStop(0, '#2a1a08'); grad.addColorStop(1, '#120a02')
      ctx.fillStyle = grad; ctx.fillRect(px, py, pw, ph)
      if (scale > 0.35) {
        ctx.fillStyle = `rgba(200,160,64,${scale})`
        ctx.font = `bold ${Math.round(9 * scale)}px Inter,sans-serif`
        ctx.textAlign = 'center'
        const title = ob.title || ''
        const words = title.split(' '); let line = '', lines = []
        words.forEach(w => { const t = line ? line + ' ' + w : w; ctx.measureText(t).width > pw - 8 ? (lines.push(line), line = w) : (line = t) }); lines.push(line)
        lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, px + pw/2, py + ph/2 - 6 + i * (10 * scale)))
      }
    }
    if (ob.hit) { ctx.fillStyle = 'rgba(239,68,68,0.4)'; ctx.fillRect(px, py, pw, ph) }
    ctx.restore()
  })

  // Player indicator — gold glow at bottom center
  const px2 = VP_X + LANES[playerLane] * LANE_SEP
  ctx.save()
  const glow = ctx.createRadialGradient(px2, GROUND_Y, 0, px2, GROUND_Y, 40)
  glow.addColorStop(0, 'rgba(200,160,64,0.5)'); glow.addColorStop(1, 'rgba(200,160,64,0)')
  ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(px2, GROUND_Y, 40, 16, 0, 0, Math.PI*2); ctx.fill()
  ctx.fillStyle = 'rgba(200,160,64,0.9)'; ctx.beginPath(); ctx.ellipse(px2, GROUND_Y, 18, 7, 0, 0, Math.PI*2); ctx.fill()
  // Arrow indicator
  ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Inter'; ctx.textAlign = 'center'
  ctx.fillText('▲', px2, GROUND_Y - 16)
  ctx.restore()

  // HUD
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, 44)
  ctx.fillStyle = 'rgba(200,160,64,0.95)'; ctx.font = 'bold 22px Inter,sans-serif'
  ctx.textAlign = 'left'; ctx.fillText(Math.round(score), 14, 30)
  ctx.textAlign = 'right'
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < lives ? '#ef4444' : 'rgba(80,80,80,0.5)'
    ctx.fillText('♥', W - 14 - i * 28, 30)
  }
  // Speed bar
  const pct = Math.min(1, (speed - 1.5) / 5)
  ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(W/2 - 36, 16, 72, 5)
  ctx.fillStyle = `hsl(${Math.round(120 - pct * 120)},80%,55%)`; ctx.fillRect(W/2 - 36, 16, 72 * pct, 5)
}

export default function CinemaRunner({ onEnd }) {
  const [phase, setPhase] = useState('idle')
  const [score, setScore] = useState(0)
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const rafRef = useRef(null)
  const touchRef = useRef(null)

  const start = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    const pool = [...MOVIES].filter(m => m.img).sort(() => Math.random() - 0.5)
    const imgCache = {}
    pool.forEach(m => { const img = new Image(); img.src = m.img; imgCache[m.id] = img })

    stateRef.current = {
      active: true, score: 0, speed: 1.5, frame: 0,
      playerLane: 1, targetLane: 1,
      obstacles: [], lives: 3, spawnTimer: 0,
      pool, poolIdx: 0, imgCache
    }
    setPhase('playing')

    function loop() {
      const s = stateRef.current; if (!s?.active) return
      s.frame++
      s.score += s.speed * 0.06
      s.speed = Math.min(6.5, 1.5 + s.frame * 0.001)

      // Smooth lane transition
      if (s.playerLane !== s.targetLane) s.playerLane = s.targetLane

      // Spawn
      s.spawnTimer++
      const spawnGap = Math.max(32, 75 - s.speed * 7)
      if (s.spawnTimer >= spawnGap) {
        s.spawnTimer = 0
        const lane = Math.floor(Math.random() * 3)
        const m = s.pool[s.poolIdx % s.pool.length]; s.poolIdx++
        s.obstacles.push({ lane, z: 0.98, title: m.title, img: imgCache[m.id], hit: false })
      }

      // Move obstacles toward camera
      s.obstacles.forEach(ob => { ob.z -= 0.016 * s.speed })

      // Collision — when obstacle is close (z < 0.1) and in same lane
      s.obstacles.forEach(ob => {
        if (!ob.hit && ob.z < 0.08 && ob.z > -0.04 && ob.lane === s.targetLane) {
          ob.hit = true
          s.lives--
          if (navigator.vibrate) navigator.vibrate([50, 30, 80])
          if (s.lives <= 0) { s.active = false; setScore(Math.round(s.score)); setPhase('dead') }
        }
      })
      s.obstacles = s.obstacles.filter(ob => ob.z > -0.12)

      drawHallway(ctx, s.frame, s.obstacles, s.playerLane, s.lives, s.score, s.speed)
      if (s.active) rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [])

  const changeLane = useCallback((dir) => {
    const s = stateRef.current; if (!s?.active) return
    s.targetLane = Math.max(0, Math.min(2, s.targetLane + dir))
  }, [])

  useEffect(() => {
    const handler = e => {
      if (e.key === 'ArrowLeft' || e.key === 'a') { e.preventDefault(); changeLane(-1) }
      if (e.key === 'ArrowRight' || e.key === 'd') { e.preventDefault(); changeLane(1) }
    }
    window.addEventListener('keydown', handler)
    return () => { window.removeEventListener('keydown', handler); cancelAnimationFrame(rafRef.current) }
  }, [changeLane])

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    drawHallway(ctx, 0, [], 1, 3, 0, 1.5)
  }, [])

  return (
    <div className="absolute inset-0 flex flex-col bg-black">
      <div className="flex-1 relative flex items-center justify-center overflow-hidden"
        onTouchStart={e => { touchRef.current = e.touches[0].clientX }}
        onTouchEnd={e => {
          if (touchRef.current === null) return
          const dx = e.changedTouches[0].clientX - touchRef.current
          if (Math.abs(dx) > 28) changeLane(dx > 0 ? 1 : -1)
          touchRef.current = null
        }}>
        <canvas ref={canvasRef}
          style={{ touchAction:'none', maxWidth:'100%', maxHeight:'100%', width:'auto', height:'auto', aspectRatio:`${W}/${H}` }} />
        {phase !== 'playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
            {phase === 'dead' ? (
              <>
                <div className="text-5xl mb-3">🎬</div>
                <div className="text-2xl font-black text-white mb-1">Cut!</div>
                <div className="text-4xl font-black text-gold font-mono mb-6">{score}</div>
                <div className="flex gap-3">
                  <button onClick={start} className="px-6 py-3 bg-gold text-black font-bold rounded-xl">Play Again</button>
                  <button onClick={() => onEnd(score)} className="px-5 py-2.5 bg-surface border border-border rounded-xl text-sm font-semibold text-ink-secondary">Done</button>
                </div>
              </>
            ) : (
              <>
                <div className="text-5xl mb-4">🎬</div>
                <div className="text-2xl font-black text-white mb-2">Cinema Runner</div>
                <div className="text-sm text-ink-muted mb-1">Dodge posters flying down the hall.</div>
                <div className="text-xs text-ink-muted mb-6">← → to switch lanes · swipe on mobile</div>
                <button onClick={start} className="px-8 py-3 bg-gold text-black font-black rounded-xl text-lg">Run! →</button>
              </>
            )}
          </div>
        )}
      </div>
      {phase === 'playing' && (
        <div className="flex-shrink-0 grid grid-cols-2 gap-2 p-2">
          <button onPointerDown={() => changeLane(-1)}
            className="py-4 bg-surface border border-border rounded-xl text-2xl font-bold active:scale-95 transition-transform select-none">←</button>
          <button onPointerDown={() => changeLane(1)}
            className="py-4 bg-surface border border-border rounded-xl text-2xl font-bold active:scale-95 transition-transform select-none">→</button>
        </div>
      )}
    </div>
  )
}
