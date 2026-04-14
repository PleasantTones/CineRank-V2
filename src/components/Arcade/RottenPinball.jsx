import React, { useState, useRef, useEffect, useCallback } from 'react'
import { MOVIES } from '../../lib/movies'
import { getCachedPoster } from '../../lib/posters'

const W = 390, H = 640
const BALL_R = 11
const GRAVITY = 0.25
const LANE_X = 360  // right launch lane center
const LANE_TOP = 55
const FLIPPER_LEN = 82

// Bumper layout
const BUMPERS = [
  { x: W/2, y: 115, r: 30, pts: 100, poolIdx: 0 },
  { x: 125,  y: 190, r: 24, pts: 75,  poolIdx: 1 },
  { x: W-125,y: 190, r: 24, pts: 75,  poolIdx: 2 },
  { x: W/2,  y: 260, r: 26, pts: 100, poolIdx: 3 },
  { x: 95,   y: 330, r: 20, pts: 50,  poolIdx: 4 },
  { x: W-95, y: 330, r: 20, pts: 50,  poolIdx: 5 },
]

const LEFT_PIVOT  = { x: 88,   y: 545 }
const RIGHT_PIVOT = { x: W-88, y: 545 }
const FLIPPER_REST   =  0.44   // radians down
const FLIPPER_ACTIVE = -0.50   // radians up

function ballSegCollide(ball, x1, y1, x2, y2, isActive) {
  const dx = x2-x1, dy = y2-y1, len2 = dx*dx+dy*dy
  const t = Math.max(0, Math.min(1, ((ball.x-x1)*dx+(ball.y-y1)*dy)/len2))
  const cx = x1+t*dx, cy = y1+t*dy
  const ex = ball.x-cx, ey = ball.y-cy
  const dist = Math.hypot(ex, ey)
  if (dist < BALL_R+5 && dist > 0) {
    const nx = ex/dist, ny = ey/dist
    const dot = ball.vx*nx + ball.vy*ny
    if (dot < 0) {
      ball.vx -= 2*dot*nx; ball.vy -= 2*dot*ny
      if (isActive) { ball.vy -= 8; ball.vx += nx*3 }
      ball.x = cx + nx*(BALL_R+6)
      ball.y = cy + ny*(BALL_R+6)
    }
  }
}

// Left flipper: pivot on left, extends RIGHT, tilts up when active
function getLeftFlipper(angle) {
  return {
    x1: LEFT_PIVOT.x, y1: LEFT_PIVOT.y,
    x2: LEFT_PIVOT.x + Math.cos(angle) * FLIPPER_LEN,
    y2: LEFT_PIVOT.y + Math.sin(angle) * FLIPPER_LEN,
  }
}
// Right flipper: pivot on right, extends LEFT, tilts up when active
function getRightFlipper(angle) {
  return {
    x1: RIGHT_PIVOT.x, y1: RIGHT_PIVOT.y,
    x2: RIGHT_PIVOT.x - Math.cos(angle) * FLIPPER_LEN,
    y2: RIGHT_PIVOT.y + Math.sin(angle) * FLIPPER_LEN,
  }
}

export default function RottenPinball({ onEnd }) {
  const [phase, setPhase] = useState('idle')
  const [score, setScore] = useState(0)
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const rafRef = useRef(null)

  const start = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    canvas.width = W; canvas.height = H
    const pool = [...MOVIES].filter(m => m.img).sort(() => Math.random()-0.5)
    const imgCache = {}
    pool.forEach(m => { const img = new Image(); img.src = getCachedPoster(m.id)||m.img; imgCache[m.id] = img })

    stateRef.current = {
      active: true, score: 0, balls: 3, frame: 0,
      launchState: 'ready',   // 'ready' | 'charging' | 'inplay'
      chargeLevel: 0,          // 0-1
      ball: { x: LANE_X, y: 510, vx: 0, vy: 0 },
      lAngle: FLIPPER_REST, rAngle: FLIPPER_REST,
      lActive: false, rActive: false,
      bumperFlash: BUMPERS.map(() => 0),
      pool, imgCache,
    }
    setPhase('playing')

    function loop() {
      const s = stateRef.current; if (!s?.active) return
      const ctx = canvas.getContext('2d')
      s.frame++

      // Animate flippers
      s.lAngle += (( s.lActive ? FLIPPER_ACTIVE : FLIPPER_REST) - s.lAngle) * 0.22
      s.rAngle += (( s.rActive ? FLIPPER_ACTIVE : FLIPPER_REST) - s.rAngle) * 0.22

      const b = s.ball

      if (s.launchState === 'charging') {
        // Ball held at plunger, charge rising
        s.chargeLevel = Math.min(1, s.chargeLevel + 0.018)
        b.x = LANE_X; b.y = 510 + s.chargeLevel * 18
      } else if (s.launchState === 'inplay') {
        // Physics
        b.vy = Math.min(b.vy + GRAVITY, 18)
        b.x += b.vx; b.y += b.vy

        // Wall collisions
        if (b.x < BALL_R + 8)          { b.x = BALL_R+8; b.vx = Math.abs(b.vx)*0.78 }
        if (b.x > W - BALL_R - 8)      { b.x = W-BALL_R-8; b.vx = -Math.abs(b.vx)*0.78 }
        if (b.y < BALL_R + 8)          { b.y = BALL_R+8; b.vy = Math.abs(b.vy)*0.7 }

        // Right lane wall (keep ball out of lane while in play)
        if (b.x > W-40 && b.y > LANE_TOP) { b.x = W-40; b.vx = -Math.abs(b.vx)*0.8 }

        // Bumpers
        BUMPERS.forEach((bum, i) => {
          const dx = b.x-bum.x, dy = b.y-bum.y, dist = Math.hypot(dx,dy)
          if (dist < BALL_R+bum.r && dist > 0) {
            const nx = dx/dist, ny = dy/dist
            const dot = b.vx*nx + b.vy*ny
            b.vx = (b.vx - 2*dot*nx) * 1.08
            b.vy = (b.vy - 2*dot*ny) * 1.08
            b.vx = Math.max(-14, Math.min(14, b.vx))
            b.vy = Math.max(-14, Math.min(14, b.vy))
            b.x = bum.x + nx*(BALL_R+bum.r+1)
            b.y = bum.y + ny*(BALL_R+bum.r+1)
            s.score += bum.pts; s.bumperFlash[i] = 20
          }
        })
        s.bumperFlash = s.bumperFlash.map(f => Math.max(0, f-1))

        // Flippers
        const lf = getLeftFlipper(s.lAngle)
        const rf = getRightFlipper(s.rAngle)
        ballSegCollide(b, lf.x1, lf.y1, lf.x2, lf.y2, s.lActive)
        ballSegCollide(b, rf.x1, rf.y1, rf.x2, rf.y2, s.rActive)

        // Guide walls (funnel toward flippers)
        // Left guide
        ballSegCollide(b, 8, 450, LEFT_PIVOT.x-4, LEFT_PIVOT.y, false)
        // Right guide
        ballSegCollide(b, W-8, 450, RIGHT_PIVOT.x+4, RIGHT_PIVOT.y, false)

        // Drain
        if (b.y > H + 20) {
          s.balls--
          if (s.balls <= 0) { s.active = false; setScore(s.score); setPhase('dead'); return }
          s.launchState = 'ready'; s.chargeLevel = 0
          b.x = LANE_X; b.y = 510; b.vx = 0; b.vy = 0
        }
      }

      // ── DRAW ──────────────────────────────────────────────────────────────
      // Background — green felt
      ctx.fillStyle = '#071a07'
      ctx.fillRect(0, 0, W, H)

      // Table border / walls
      ctx.strokeStyle = '#8b7340'
      ctx.lineWidth = 8
      ctx.strokeRect(4, 4, W-8, H-8)

      // Inner play area border
      ctx.strokeStyle = '#4a3a20'
      ctx.lineWidth = 2
      ctx.strokeRect(12, 12, W-24, H-24)

      // Subtle felt texture lines
      for (let i = 0; i < H; i += 18) {
        ctx.strokeStyle = 'rgba(255,255,255,0.018)'
        ctx.lineWidth = 1; ctx.beginPath()
        ctx.moveTo(12, i); ctx.lineTo(W-12, i); ctx.stroke()
      }

      // Launch lane
      ctx.fillStyle = '#050e05'
      ctx.fillRect(W-45, LANE_TOP, 33, H-LANE_TOP-12)
      ctx.strokeStyle = '#8b7340'; ctx.lineWidth = 1.5
      ctx.strokeRect(W-45, LANE_TOP, 33, H-LANE_TOP-12)

      // Lane label
      ctx.save(); ctx.translate(W-28, 300); ctx.rotate(-Math.PI/2)
      ctx.fillStyle = '#4a3a20'; ctx.font = 'bold 9px Inter'; ctx.textAlign = 'center'
      ctx.fillText('LAUNCH LANE', 0, 0); ctx.restore()

      // Bumpers
      BUMPERS.forEach((bum, i) => {
        const flash = s.bumperFlash[i] > 0
        const m = s.pool[bum.poolIdx % s.pool.length]
        // Outer ring / glow
        if (flash) {
          ctx.shadowBlur = 18; ctx.shadowColor = '#C8A040'
          ctx.beginPath(); ctx.arc(bum.x, bum.y, bum.r+4, 0, Math.PI*2)
          ctx.fillStyle = 'rgba(200,160,64,0.3)'; ctx.fill()
          ctx.shadowBlur = 0
        }
        // Chrome ring
        const grad = ctx.createRadialGradient(bum.x-bum.r*0.3, bum.y-bum.r*0.3, 2, bum.x, bum.y, bum.r+4)
        grad.addColorStop(0, flash ? '#FFE080' : '#d0a830')
        grad.addColorStop(1, '#5a4010')
        ctx.beginPath(); ctx.arc(bum.x, bum.y, bum.r+4, 0, Math.PI*2)
        ctx.fillStyle = grad; ctx.fill()
        // Poster clip
        ctx.save(); ctx.beginPath(); ctx.arc(bum.x, bum.y, bum.r, 0, Math.PI*2); ctx.clip()
        if (s.imgCache[m.id]?.complete && s.imgCache[m.id].naturalWidth > 0) {
          ctx.drawImage(s.imgCache[m.id], bum.x-bum.r, bum.y-bum.r, bum.r*2, bum.r*2)
        } else {
          ctx.fillStyle = '#1a1208'; ctx.fill()
        }
        if (flash) { ctx.fillStyle = 'rgba(255,220,80,0.35)'; ctx.fill() }
        ctx.restore()
        // Inner ring
        ctx.beginPath(); ctx.arc(bum.x, bum.y, bum.r, 0, Math.PI*2)
        ctx.strokeStyle = flash ? '#FFD700' : '#8b7340'; ctx.lineWidth = 2; ctx.stroke()
        // Points label
        if (flash) {
          ctx.fillStyle = '#FFD700'; ctx.font = 'bold 10px Inter'; ctx.textAlign = 'center'
          ctx.fillText(`+${bum.pts}`, bum.x, bum.y - bum.r - 6)
        }
      })

      // Guide walls
      const drawGuide = (x1,y1,x2,y2) => {
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2)
        ctx.strokeStyle = '#8b7340'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke()
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2)
        ctx.strokeStyle = '#c8a040'; ctx.lineWidth = 2; ctx.stroke()
      }
      drawGuide(12, 460, LEFT_PIVOT.x-2, LEFT_PIVOT.y)
      drawGuide(W-12, 460, RIGHT_PIVOT.x+2, RIGHT_PIVOT.y)

      // Flippers
      const drawFlipper = (f, active) => {
        ctx.lineCap = 'round'; ctx.lineWidth = 14
        ctx.strokeStyle = active ? '#FFD700' : '#8b7340'; ctx.stroke()
        ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2)
        ctx.strokeStyle = active ? '#FFD700' : '#8b7340'; ctx.stroke()
        // Shine
        ctx.lineWidth = 4
        ctx.strokeStyle = active ? 'rgba(255,255,200,0.6)' : 'rgba(200,180,100,0.4)'
        ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke()
        // Pivot dot
        ctx.beginPath(); ctx.arc(f.x1, f.y1, 7, 0, Math.PI*2)
        ctx.fillStyle = active ? '#FFD700' : '#a08030'; ctx.fill()
      }
      const lf = getLeftFlipper(s.lAngle)
      const rf = getRightFlipper(s.rAngle)
      drawFlipper(lf, s.lActive)
      drawFlipper(rf, s.rActive)

      // Plunger
      if (s.launchState !== 'inplay') {
        const py = b.y + 12
        const pullY = py + s.chargeLevel * 20
        // Spring coils
        for (let i = 0; i < 6; i++) {
          const sy = py + i * 8
          ctx.strokeStyle = i%2===0 ? '#888' : '#555'
          ctx.lineWidth = 2; ctx.beginPath()
          ctx.ellipse(LANE_X, sy, 6, 3, 0, 0, Math.PI*2); ctx.stroke()
        }
        // Plunger rod
        ctx.fillStyle = '#aaa'
        ctx.fillRect(LANE_X-3, py+48, 6, H-py-48)
        // Power indicator
        if (s.chargeLevel > 0) {
          const barH = s.chargeLevel * 60
          ctx.fillStyle = `hsl(${120-s.chargeLevel*120}, 90%, 50%)`
          ctx.fillRect(W-42, H-20-barH, 8, barH)
          ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(W-42, H-80, 8, 60)
        }
      }

      // Ball
      if (s.launchState === 'inplay' || s.launchState === 'ready' || s.launchState === 'charging') {
        const ballGrad = ctx.createRadialGradient(b.x-4, b.y-4, 2, b.x, b.y, BALL_R)
        ballGrad.addColorStop(0, '#ffffff')
        ballGrad.addColorStop(0.5, '#d0d8e0')
        ballGrad.addColorStop(1, '#808898')
        ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI*2)
        ctx.fillStyle = ballGrad; ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.stroke()
        // Specular
        ctx.beginPath(); ctx.arc(b.x-4, b.y-4, 4, 0, Math.PI*2)
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill()
      }

      // HUD
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, 48)
      ctx.fillStyle = '#C8A040'; ctx.font = 'bold 22px Inter'; ctx.textAlign = 'left'
      ctx.fillText(s.score, 16, 33)
      ctx.font = '11px Inter'; ctx.textAlign = 'right'
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(W-20-i*22, 24, 7, 0, Math.PI*2)
        ctx.fillStyle = i < s.balls ? '#C8A040' : 'rgba(80,80,80,0.5)'; ctx.fill()
      }

      // Launch prompt
      if (s.launchState === 'ready') {
        ctx.fillStyle = 'rgba(200,160,64,0.85)'; ctx.font = 'bold 11px Inter'; ctx.textAlign = 'center'
        ctx.fillText('Hold LAUNCH to charge · Release to fire', W/2, H-6)
      } else if (s.launchState === 'charging') {
        ctx.fillStyle = `hsl(${120-s.chargeLevel*120}, 90%, 60%)`
        ctx.font = 'bold 12px Inter'; ctx.textAlign = 'center'
        ctx.fillText(`${Math.round(s.chargeLevel*100)}% power — release!`, W/2, H-6)
      }

      if (s.active) rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [])

  // Key controls
  useEffect(() => {
    const down = e => {
      const s = stateRef.current; if (!s?.active) return
      if (e.code==='ArrowLeft'||e.code==='KeyZ') {
        s.lActive = true
        if (s.launchState==='inplay') return
      }
      if (e.code==='ArrowRight'||e.code==='KeyX') {
        s.rActive = true
        if (s.launchState==='inplay') return
      }
      if (e.code==='Space') {
        e.preventDefault()
        if (s.launchState==='ready') s.launchState='charging'
      }
    }
    const up = e => {
      const s = stateRef.current; if (!s) return
      if (e.code==='ArrowLeft'||e.code==='KeyZ') s.lActive = false
      if (e.code==='ArrowRight'||e.code==='KeyX') s.rActive = false
      if (e.code==='Space') {
        if (s.launchState==='charging') {
          const speed = 6 + s.chargeLevel * 13
          s.ball.vx = 0; s.ball.vy = -speed
          s.launchState = 'inplay'; s.chargeLevel = 0
        }
      }
    }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown',down); window.removeEventListener('keyup',up); cancelAnimationFrame(rafRef.current) }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d'); ctx.fillStyle='#071a07'; ctx.fillRect(0,0,W,H)
  }, [])

  const setFlipper = (side, val) => { const s=stateRef.current; if(s) s[side]=val }
  const doLaunch = (charging) => {
    const s = stateRef.current; if (!s) return
    if (charging && s.launchState==='ready') s.launchState='charging'
    if (!charging && s.launchState==='charging') {
      const speed = 6 + s.chargeLevel * 13
      s.ball.vx=0; s.ball.vy=-speed; s.launchState='inplay'; s.chargeLevel=0
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-black">
      <div className="flex-1 relative min-h-0 flex items-center justify-center overflow-hidden">
        <canvas ref={canvasRef} style={{touchAction:'none',maxWidth:'100%',maxHeight:'100%',width:'auto',height:'auto',aspectRatio:`${W}/${H}`}} />
        {phase!=='playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
            {phase==='dead' ? (
              <>
                <div className="text-5xl mb-3">🎳</div>
                <div className="text-2xl font-black text-white mb-1">Drained!</div>
                <div className="text-4xl font-black text-gold font-mono mb-6">{score}</div>
                <div className="flex gap-3">
                  <button onClick={start} className="px-6 py-3 bg-gold text-black font-bold rounded-xl">Play Again</button>
                  <button onClick={() => onEnd(score)} className="px-6 py-3 bg-surface border border-border rounded-xl text-sm font-semibold text-ink-secondary">Done</button>
                </div>
              </>
            ) : (
              <>
                <div className="text-5xl mb-4">🎰</div>
                <div className="text-2xl font-black text-white mb-2">Rotten Pinball</div>
                <div className="text-sm text-ink-muted mb-1 text-center px-8">Hit movie poster bumpers for points. Don't drain!</div>
                <div className="text-xs text-ink-muted mb-6 text-center px-8">Hold LAUNCH to charge · release to fire · Z/← Left · X/→ Right</div>
                <button onClick={start} className="px-8 py-3 bg-gold text-black font-black rounded-xl text-lg">Launch →</button>
              </>
            )}
          </div>
        )}
      </div>
      {phase==='playing' && (
        <div className="flex-shrink-0 grid grid-cols-3 gap-2 p-2 bg-black">
          <button onPointerDown={()=>setFlipper('lActive',true)} onPointerUp={()=>setFlipper('lActive',false)} onPointerLeave={()=>setFlipper('lActive',false)}
            className="py-5 bg-gold/20 border border-gold/40 rounded-xl text-xl font-black active:bg-gold/50 select-none text-gold">◄ LEFT</button>
          <button onPointerDown={()=>doLaunch(true)} onPointerUp={()=>doLaunch(false)} onPointerLeave={()=>doLaunch(false)}
            className="py-5 bg-surface border border-border rounded-xl text-sm font-black active:bg-raised select-none text-ink-secondary">🚀 LAUNCH</button>
          <button onPointerDown={()=>setFlipper('rActive',true)} onPointerUp={()=>setFlipper('rActive',false)} onPointerLeave={()=>setFlipper('rActive',false)}
            className="py-5 bg-gold/20 border border-gold/40 rounded-xl text-xl font-black active:bg-gold/50 select-none text-gold">RIGHT ►</button>
        </div>
      )}
    </div>
  )
}
