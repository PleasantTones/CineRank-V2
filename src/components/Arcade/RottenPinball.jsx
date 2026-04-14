import React, { useState, useRef, useEffect, useCallback } from 'react'
import { MOVIES } from '../../lib/movies'
import { getCachedPoster } from '../../lib/posters'

const W = 390, H = 600
const BALL_R = 10
const GRAV = 0.38
const FLIPPER_LEN = 80
const LEFT_PIVOT = { x: 95, y: 535 }
const RIGHT_PIVOT = { x: W - 95, y: 535 }
const FLIPPER_REST = 0.52   // radians below horizontal
const FLIPPER_ACTIVE = -0.52  // radians above horizontal
const FLIPPER_SPEED = 0.18

// Bumper positions
const BUMPERS = [
  { x: W/2, y: 130, r: 28, poolIdx: 0 },
  { x: 120, y: 200, r: 22, poolIdx: 1 },
  { x: W-120, y: 200, r: 22, poolIdx: 2 },
  { x: W/2, y: 270, r: 24, poolIdx: 3 },
  { x: 90, y: 330, r: 20, poolIdx: 4 },
  { x: W-90, y: 330, r: 20, poolIdx: 5 },
]

function reflectFromCircle(ball, cx, cy, cr, boost=1.15) {
  const dx=ball.x-cx, dy=ball.y-cy, dist=Math.hypot(dx,dy)
  if(dist < BALL_R+cr+1) {
    const nx=dx/dist, ny=dy/dist
    const dot=ball.vx*nx+ball.vy*ny
    ball.vx=(ball.vx-2*dot*nx)*boost
    ball.vy=(ball.vy-2*dot*ny)*boost
    ball.x=cx+nx*(BALL_R+cr+2)
    ball.y=cy+ny*(BALL_R+cr+2)
    return true
  }
  return false
}

function getFlipper(pivot, angle, side) {
  // Returns {x1,y1,x2,y2} — pivot is x1,y1
  const dx = Math.cos(angle) * FLIPPER_LEN * side
  const dy = Math.sin(Math.abs(angle)) * (angle<0?-1:1) * FLIPPER_LEN
  return { x1:pivot.x, y1:pivot.y, x2:pivot.x+dx, y2:pivot.y+dy }
}

function ballFlipperCollision(ball, f, isActive) {
  const dx=f.x2-f.x1, dy=f.y2-f.y1, len2=dx*dx+dy*dy
  const t=Math.max(0,Math.min(1,((ball.x-f.x1)*dx+(ball.y-f.y1)*dy)/len2))
  const cx=f.x1+t*dx, cy=f.y1+t*dy
  const ex=ball.x-cx, ey=ball.y-cy, dist=Math.hypot(ex,ey)
  if(dist < BALL_R+4) {
    const nx=ex/(dist||1), ny=ey/(dist||1)
    const dot=ball.vx*nx+ball.vy*ny
    if(dot<0) {  // approaching flipper
      ball.vx-=2*dot*nx; ball.vy-=2*dot*ny
      if(isActive){ ball.vy-=7; ball.vx+=nx*2 }
      ball.x=cx+nx*(BALL_R+5); ball.y=cy+ny*(BALL_R+5)
    }
  }
}

export default function RottenPinball({ onEnd }) {
  const [phase, setPhase] = useState('idle')
  const [score, setScore] = useState(0)
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const rafRef = useRef(null)

  const start = useCallback(()=>{
    const canvas=canvasRef.current; if(!canvas) return
    canvas.width=W; canvas.height=H
    const pool=[...MOVIES].filter(m=>m.img).sort(()=>Math.random()-0.5)
    const imgCache={}
    pool.forEach(m=>{ const img=new Image(); img.src=getCachedPoster(m.id)||m.img; imgCache[m.id]=img })

    stateRef.current = {
      active:true, score:0, balls:3, frame:0,
      ball:{ x:W-40, y:200, vx:-2, vy:1 },
      lAngle: FLIPPER_REST, rAngle: FLIPPER_REST,
      lActive:false, rActive:false,
      bumperFlash:[0,0,0,0,0,0],
      pool, imgCache,
      launching:false
    }
    setPhase('playing')

    function loop(){
      const s=stateRef.current; if(!s?.active) return
      const ctx=canvas.getContext('2d')
      s.frame++

      // Animate flipper angles
      const lTarget=s.lActive?FLIPPER_ACTIVE:FLIPPER_REST
      const rTarget=s.rActive?FLIPPER_ACTIVE:FLIPPER_REST
      s.lAngle += (lTarget-s.lAngle)*FLIPPER_SPEED
      s.rAngle += (rTarget-s.rAngle)*FLIPPER_SPEED

      const b=s.ball
      b.vy+=GRAV
      b.vy=Math.min(b.vy,15)  // cap fall speed
      b.x+=b.vx; b.y+=b.vy

      // Wall collisions
      if(b.x<BALL_R){ b.x=BALL_R; b.vx=Math.abs(b.vx)*0.85 }
      if(b.x>W-BALL_R){ b.x=W-BALL_R; b.vx=-Math.abs(b.vx)*0.85 }
      if(b.y<BALL_R){ b.y=BALL_R; b.vy=Math.abs(b.vy)*0.8 }

      // Bumper collisions
      BUMPERS.forEach((bum,i)=>{
        if(reflectFromCircle(b,bum.x,bum.y,bum.r,1.2)){
          s.score+=50; s.bumperFlash[i]=15
        }
      })
      s.bumperFlash=s.bumperFlash.map(f=>Math.max(0,f-1))

      // Flipper collisions
      const lf=getFlipper(LEFT_PIVOT, s.lAngle, 1)
      const rf=getFlipper(RIGHT_PIVOT, -s.rAngle, -1)
      ballFlipperCollision(b, lf, s.lActive)
      ballFlipperCollision(b, rf, s.rActive)

      // Ball drain
      if(b.y > H+30){
        s.balls--
        if(s.balls<=0){ s.active=false; setScore(s.score); setPhase('dead'); return }
        // Respawn
        b.x=W-40; b.y=200; b.vx=-1.5+Math.random()*-1; b.vy=0.5
      }

      // Draw
      ctx.fillStyle='#0a0812'; ctx.fillRect(0,0,W,H)

      // Side walls decoration
      ctx.strokeStyle='rgba(200,160,64,0.2)'; ctx.lineWidth=1
      ctx.strokeRect(10,50,W-20,H-60)

      // Guide lines (funnel toward flippers)
      ctx.strokeStyle='rgba(200,160,64,0.15)'; ctx.lineWidth=2
      ctx.beginPath(); ctx.moveTo(10,430); ctx.lineTo(LEFT_PIVOT.x-5,LEFT_PIVOT.y); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(W-10,430); ctx.lineTo(RIGHT_PIVOT.x+5,RIGHT_PIVOT.y); ctx.stroke()

      // Bumpers
      BUMPERS.forEach((bum,i)=>{
        const flash=s.bumperFlash[i]>0
        const m=s.pool[bum.poolIdx%s.pool.length]
        ctx.save(); ctx.beginPath(); ctx.arc(bum.x,bum.y,bum.r,0,Math.PI*2); ctx.clip()
        if(s.imgCache[m.id]?.complete && s.imgCache[m.id].naturalWidth>0){
          ctx.drawImage(s.imgCache[m.id],bum.x-bum.r,bum.y-bum.r,bum.r*2,bum.r*2)
        } else {
          ctx.fillStyle='#1a1208'; ctx.fill()
        }
        ctx.restore()
        ctx.beginPath(); ctx.arc(bum.x,bum.y,bum.r,0,Math.PI*2)
        ctx.strokeStyle=flash?'#FFD700':'rgba(200,160,64,0.6)'; ctx.lineWidth=flash?3:1.5; ctx.stroke()
        if(flash){
          ctx.fillStyle='rgba(255,215,0,0.2)'; ctx.fill()
          ctx.fillStyle='#FFD700'; ctx.font='bold 9px Inter'; ctx.textAlign='center'
          ctx.fillText('+50',bum.x,bum.y-bum.r-5)
        }
      })

      // Flippers
      const drawFlipper=(f,active)=>{
        ctx.lineCap='round'; ctx.lineWidth=10
        ctx.strokeStyle=active?'rgba(200,160,64,0.9)':'rgba(200,160,64,0.5)'
        ctx.beginPath(); ctx.moveTo(f.x1,f.y1); ctx.lineTo(f.x2,f.y2); ctx.stroke()
        ctx.fillStyle=active?'rgba(200,160,64,0.9)':'rgba(200,160,64,0.5)'
        ctx.beginPath(); ctx.arc(f.x1,f.y1,5,0,Math.PI*2); ctx.fill()
      }
      drawFlipper(lf,s.lActive)
      drawFlipper(rf,s.rActive)

      // Ball
      const ballGrad=ctx.createRadialGradient(b.x-3,b.y-3,2,b.x,b.y,BALL_R)
      ballGrad.addColorStop(0,'#ffffff'); ballGrad.addColorStop(1,'#c0c0e0')
      ctx.beginPath(); ctx.arc(b.x,b.y,BALL_R,0,Math.PI*2)
      ctx.fillStyle=ballGrad; ctx.fill()
      ctx.strokeStyle='rgba(200,200,255,0.5)'; ctx.lineWidth=1; ctx.stroke()

      // HUD
      ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,W,44)
      ctx.fillStyle='rgba(200,160,64,0.9)'; ctx.font='bold 20px Inter'; ctx.textAlign='left'
      ctx.fillText(s.score,14,30)
      ctx.textAlign='right'
      for(let i=0;i<3;i++){
        ctx.fillStyle=i<s.balls?'#e8c860':'rgba(80,80,80,0.5)'
        ctx.beginPath(); ctx.arc(W-20-i*22,22,7,0,Math.PI*2); ctx.fill()
      }
      ctx.fillStyle='rgba(200,160,64,0.5)'; ctx.font='9px Inter'; ctx.textAlign='center'
      ctx.fillText('Z / ← LEFT    RIGHT → / X',W/2,H-5)

      if(s.active) rafRef.current=requestAnimationFrame(loop)
    }
    rafRef.current=requestAnimationFrame(loop)
  },[])

  useEffect(()=>{
    const down=e=>{
      const s=stateRef.current; if(!s?.active) return
      if(e.code==='ArrowLeft'||e.code==='KeyZ') s.lActive=true
      if(e.code==='ArrowRight'||e.code==='KeyX') s.rActive=true
    }
    const up=e=>{
      const s=stateRef.current; if(!s) return
      if(e.code==='ArrowLeft'||e.code==='KeyZ') s.lActive=false
      if(e.code==='ArrowRight'||e.code==='KeyX') s.rActive=false
    }
    window.addEventListener('keydown',down); window.addEventListener('keyup',up)
    return ()=>{ window.removeEventListener('keydown',down); window.removeEventListener('keyup',up); cancelAnimationFrame(rafRef.current) }
  },[])

  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return
    canvas.width=W; canvas.height=H
    const ctx=canvas.getContext('2d')
    ctx.fillStyle='#0a0812'; ctx.fillRect(0,0,W,H)
  },[])

  const setFlipper=(side,val)=>{ const s=stateRef.current; if(s) s[side]=val }

  return (
    <div className="absolute inset-0 flex flex-col bg-black">
      <div className="flex-1 relative min-h-0 flex items-center justify-center overflow-hidden">
        <canvas ref={canvasRef} style={{touchAction:'none',maxWidth:'100%',maxHeight:'100%',width:'auto',height:'auto',aspectRatio:`${W}/${H}`}} />
        {phase!=='playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm">
            {phase==='dead'?(
              <>
                <div className="text-5xl mb-3">🎳</div>
                <div className="text-2xl font-black text-white mb-1">Drained!</div>
                <div className="text-4xl font-black text-gold font-mono mb-6">{score}</div>
                <div className="flex gap-3">
                  <button onClick={start} className="px-6 py-3 bg-gold text-black font-bold rounded-xl">Play Again</button>
                  <button onClick={()=>onEnd(score)} className="px-6 py-3 bg-surface border border-border rounded-xl text-sm font-semibold text-ink-secondary">Done</button>
                </div>
              </>
            ):(
              <>
                <div className="text-5xl mb-4">🎰</div>
                <div className="text-2xl font-black text-white mb-2">Rotten Pinball</div>
                <div className="text-sm text-ink-muted mb-1 text-center px-8">Hit the movie bumpers for points. Don't let the ball drain!</div>
                <div className="text-xs text-ink-muted mb-6 text-center px-8">Z / ← = Left flipper &nbsp;·&nbsp; X / → = Right flipper</div>
                <button onClick={start} className="px-8 py-3 bg-gold text-black font-black rounded-xl text-lg">Launch →</button>
              </>
            )}
          </div>
        )}
      </div>
      {phase==='playing' && (
        <div className="flex-shrink-0 grid grid-cols-2 gap-2 p-2 bg-black">
          <button onPointerDown={()=>setFlipper('lActive',true)} onPointerUp={()=>setFlipper('lActive',false)} onPointerLeave={()=>setFlipper('lActive',false)}
            className="py-5 bg-gold/20 border border-gold/40 rounded-xl text-xl font-black active:bg-gold/50 select-none text-gold">◄ LEFT</button>
          <button onPointerDown={()=>setFlipper('rActive',true)} onPointerUp={()=>setFlipper('rActive',false)} onPointerLeave={()=>setFlipper('rActive',false)}
            className="py-5 bg-gold/20 border border-gold/40 rounded-xl text-xl font-black active:bg-gold/50 select-none text-gold">RIGHT ►</button>
        </div>
      )}
    </div>
  )
}
