import React, { useState, useRef, useCallback, useEffect } from 'react'
import { MOVIES } from '../../lib/movies'

const W = 390, H = 600
const GROUND_Y = H - 80
const PLAYER_W = 44, PLAYER_H = 60
const LANE_COUNT = 5
const LANE_W = W / LANE_COUNT

function getLaneX(lane) { return LANE_W * lane + LANE_W / 2 }

function drawScene(ctx, state) {
  const { frame, playerX, playerLane, obstacles, score, lives, speed } = state

  // Background — dark cinematic
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#0a0810')
  bg.addColorStop(1, '#120e1a')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

  // Scrolling lane lines
  ctx.strokeStyle = 'rgba(200,160,64,0.12)'; ctx.lineWidth = 1
  for (let i = 1; i < LANE_COUNT; i++) {
    ctx.beginPath(); ctx.setLineDash([24, 20])
    ctx.lineDashOffset = -(frame * speed * 3) % 44
    ctx.moveTo(LANE_W * i, 0); ctx.lineTo(LANE_W * i, GROUND_Y)
    ctx.stroke()
  }
  ctx.setLineDash([])

  // Ground
  const grd = ctx.createLinearGradient(0, GROUND_Y, 0, H)
  grd.addColorStop(0, '#1a1208'); grd.addColorStop(1, '#0d0905')
  ctx.fillStyle = grd; ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y)
  ctx.strokeStyle = 'rgba(200,160,64,0.4)'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(W, GROUND_Y); ctx.stroke()

  // Gold ground accent
  ctx.strokeStyle = 'rgba(200,160,64,0.15)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, GROUND_Y + 8); ctx.lineTo(W, GROUND_Y + 8); ctx.stroke()

  // Obstacles (falling posters)
  obstacles.forEach(ob => {
    const x = getLaneX(ob.lane) - ob.w/2
    const alpha = Math.min(1, (GROUND_Y - ob.y) / 120)
    ctx.save(); ctx.globalAlpha = Math.max(0.1, alpha)
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.fillRect(x + 3, ob.y + ob.h + 2, ob.w, 6)
    // Frame
    ctx.fillStyle = ob.hit ? '#7f1d1d' : '#8B6914'
    ctx.fillRect(x - 3, ob.y - 3, ob.w + 6, ob.h + 6)
    // Poster
    if (ob.img?.complete && ob.img.naturalWidth > 0) {
      ctx.drawImage(ob.img, x, ob.y, ob.w, ob.h)
    } else {
      const pg = ctx.createLinearGradient(x, ob.y, x, ob.y + ob.h)
      pg.addColorStop(0, '#2a1a08'); pg.addColorStop(1, '#1a0e04')
      ctx.fillStyle = pg; ctx.fillRect(x, ob.y, ob.w, ob.h)
      ctx.fillStyle = 'rgba(200,160,64,0.6)'; ctx.font = 'bold 10px Inter,sans-serif'
      ctx.textAlign = 'center'
      const words = (ob.title || '').split(' ')
      let line = '', lines = [], maxW = ob.w - 8
      words.forEach(w => {
        const t = line ? line + ' ' + w : w
        if (ctx.measureText(t).width > maxW) { lines.push(line); line = w } else line = t
      }); lines.push(line)
      lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, x + ob.w/2, ob.y + ob.h/2 - 8 + i * 13))
    }
    // Hit flash
    if (ob.hit) { ctx.fillStyle = 'rgba(239,68,68,0.35)'; ctx.fillRect(x, ob.y, ob.w, ob.h) }
    ctx.restore()
  })

  // Player — cinematic figure
  const px = playerX - PLAYER_W/2
  const py = GROUND_Y - PLAYER_H
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.beginPath(); ctx.ellipse(playerX, GROUND_Y, PLAYER_W/2, 8, 0, 0, Math.PI*2); ctx.fill()
  // Body
  const playerGrad = ctx.createLinearGradient(px, py, px + PLAYER_W, py + PLAYER_H)
  playerGrad.addColorStop(0, '#e8d5a0'); playerGrad.addColorStop(1, '#c4a050')
  ctx.fillStyle = playerGrad; ctx.fillRect(px + 8, py + 20, PLAYER_W - 16, PLAYER_H - 20)
  // Head
  ctx.fillStyle = '#f5e6c0'; ctx.beginPath()
  ctx.arc(playerX, py + 13, 13, 0, Math.PI * 2); ctx.fill()
  // Star / gold shimmer on player
  ctx.fillStyle = 'rgba(200,160,64,0.8)'
  ctx.beginPath(); ctx.arc(playerX, py + 13, 5, 0, Math.PI * 2); ctx.fill()

  // HUD
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, 48)
  ctx.fillStyle = 'rgba(200,160,64,0.9)'; ctx.font = 'bold 22px Inter,sans-serif'
  ctx.textAlign = 'left'; ctx.fillText(Math.round(score), 14, 32)
  // Hearts
  ctx.font = '18px serif'; ctx.textAlign = 'right'
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < lives ? '#ef4444' : 'rgba(100,100,100,0.4)'
    ctx.fillText('♥', W - 14 - i * 26, 32)
  }
  // Speed indicator
  const pct = Math.min(1, (speed - 2) / 6)
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(W/2 - 40, 10, 80, 6)
  ctx.fillStyle = `hsl(${Math.round(120 - pct*120)},80%,55%)`
  ctx.fillRect(W/2 - 40, 10, 80 * pct, 6)
}

export default function CinemaRunner({ onEnd }) {
  const [phase, setPhase] = useState('idle')
  const [score, setScore] = useState(0)
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const rafRef = useRef(null)

  const start = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')

    const pool = [...MOVIES].filter(m => m.img).sort(() => Math.random() - 0.5)
    const imgCache = {}
    pool.forEach(m => { const img = new Image(); img.src = m.img; imgCache[m.id] = img })

    const initLane = 2
    stateRef.current = {
      active: true, score: 0, speed: 2, frame: 0,
      playerLane: initLane, playerX: getLaneX(initLane), targetLane: initLane,
      obstacles: [], lives: 3, spawnTimer: 0,
      pool, poolIdx: 0, imgCache, ctx
    }
    setPhase('playing')

    function loop() {
      const s = stateRef.current; if (!s?.active) return
      s.frame++
      s.score += s.speed * 0.08
      s.speed = Math.min(8, 2 + s.frame * 0.0015)

      // Smooth player movement
      const targetX = getLaneX(s.targetLane)
      s.playerX += (targetX - s.playerX) * 0.22

      // Spawn obstacles
      s.spawnTimer++
      const spawnInterval = Math.max(28, 65 - s.speed * 5)
      if (s.spawnTimer >= spawnInterval) {
        s.spawnTimer = 0
        const lane = Math.floor(Math.random() * LANE_COUNT)
        const m = s.pool[s.poolIdx % s.pool.length]; s.poolIdx++
        const w = 54, h = 78
        s.obstacles.push({ lane, y: -h - 10, w, h, movieId: m.id, title: m.title, img: imgCache[m.id], hit: false, hitTimer: 0 })
      }

      // Move obstacles down
      s.obstacles.forEach(ob => { ob.y += s.speed * 2.2 })

      // Collision
      const px = s.playerX, py = GROUND_Y - PLAYER_H
      s.obstacles.forEach(ob => {
        if (ob.hit) return
        const ox = getLaneX(ob.lane)
        const dx = Math.abs(px - ox), dy = Math.abs((py + PLAYER_H/2) - (ob.y + ob.h/2))
        if (dx < (PLAYER_W/2 + ob.w/2) * 0.7 && dy < (PLAYER_H/2 + ob.h/2) * 0.65) {
          ob.hit = true; ob.hitTimer = 12
          s.lives--
          if (navigator.vibrate) navigator.vibrate([60, 30, 60])
          if (s.lives <= 0) { s.active = false; setScore(Math.round(s.score)); setPhase('dead') }
        }
      })
      s.obstacles = s.obstacles.filter(ob => ob.y < H + 20)

      drawScene(ctx, s)
      if (s.active) rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [])

  const changeLane = useCallback((dir) => {
    const s = stateRef.current; if (!s?.active) return
    s.targetLane = Math.max(0, Math.min(LANE_COUNT - 1, s.targetLane + dir))
    s.playerLane = s.targetLane
  }, [])

  // Keyboard
  useEffect(() => {
    const handler = e => {
      if (e.key === 'ArrowLeft' || e.key === 'a') { e.preventDefault(); changeLane(-1) }
      if (e.key === 'ArrowRight' || e.key === 'd') { e.preventDefault(); changeLane(1) }
    }
    window.addEventListener('keydown', handler)
    return () => { window.removeEventListener('keydown', handler); cancelAnimationFrame(rafRef.current) }
  }, [changeLane])

  // Draw idle screen
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    drawScene(ctx, { frame: 0, playerX: getLaneX(2), playerLane: 2, obstacles: [], score: 0, lives: 3, speed: 2 })
  }, [])

  // Touch swipe
  const touchRef = useRef(null)
  const onTouchStart = e => { touchRef.current = e.touches[0].clientX }
  const onTouchEnd = e => {
    if (touchRef.current === null) return
    const dx = e.changedTouches[0].clientX - touchRef.current
    if (Math.abs(dx) > 30) changeLane(dx > 0 ? 1 : -1)
    touchRef.current = null
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black"
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <canvas ref={canvasRef}
          style={{ touchAction:'none', maxWidth:'100%', maxHeight:'100%', width:'auto', height:'auto', aspectRatio:`${W}/${H}` }} />
        {phase !== 'playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm">
            {phase === 'dead' ? (
              <>
                <div className="text-5xl mb-3">🎬</div>
                <div className="text-xl font-black text-white mb-1">Cut!</div>
                <div className="text-4xl font-black text-gold font-mono mb-6">{score}</div>
                <div className="flex gap-3">
                  <button onClick={start} className="px-6 py-3 bg-gold text-black font-bold rounded-xl">Play Again</button>
                  <button onClick={() => onEnd(score)} className="px-6 py-3 bg-surface border border-border rounded-xl text-sm font-semibold text-ink-secondary">Done</button>
                </div>
              </>
            ) : (
              <>
                <div className="text-5xl mb-4">🎬</div>
                <div className="text-2xl font-black text-white mb-2">Cinema Runner</div>
                <div className="text-sm text-ink-muted mb-1 text-center px-8">Dodge falling movie posters.</div>
                <div className="text-xs text-ink-muted mb-6 text-center px-8">← → keys, A/D, or swipe to move</div>
                <button onClick={start} className="px-8 py-3 bg-gold text-black font-black rounded-xl text-lg">Start →</button>
              </>
            )}
          </div>
        )}
      </div>
      {phase === 'playing' && (
        <div className="flex-shrink-0 grid grid-cols-2 gap-2 p-2 bg-black">
          <button onPointerDown={() => changeLane(-1)}
            className="py-4 bg-surface border border-border rounded-xl text-2xl font-bold active:scale-95 transition-transform select-none">←</button>
          <button onPointerDown={() => changeLane(1)}
            className="py-4 bg-surface border border-border rounded-xl text-2xl font-bold active:scale-95 transition-transform select-none">→</button>
        </div>
      )}
    </div>
  )
}
