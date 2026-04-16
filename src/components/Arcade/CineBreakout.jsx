import React, { useState, useRef, useEffect, useCallback } from 'react'
import { MOVIES } from '../../lib/movies'
import { getCachedPoster } from '../../lib/posters'

const W = 390, H = 600
const COLS = 5, ROWS = 7
const BRICK_W = Math.floor((W - 20) / COLS)  // 74
const BRICK_H = 36
const BRICK_PAD = 3
const GRID_TOP = 60
const BALL_R = 9
const PADDLE_H = 12, PADDLE_W = 80
const BALL_SPEED = 5.5

function initBricks(pool, imgCache) {
  const bricks = []
  for (let r=0; r<ROWS; r++) for (let c=0; c<COLS; c++) {
    const idx=(r*COLS+c)%pool.length
    const m=pool[idx]
    bricks.push({ r,c,alive:true, movieId:m.id, img:imgCache[m.id], title:m.title })
  }
  return bricks
}

function drawParticles(ctx, particles) {
  particles.forEach(p=>{
    ctx.globalAlpha=p.life/p.maxLife
    ctx.fillStyle=p.color
    ctx.fillRect(p.x-p.r/2, p.y-p.r/2, p.r, p.r)
  })
  ctx.globalAlpha=1
}

export default function CineBreakout({ onEnd }) {
  const [phase, setPhase] = useState('idle')
  const [score, setScore] = useState(0)
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const particlesRef = useRef([])
  const rafRef = useRef(null)
  const paddleXRef = useRef(W/2)
  const countdownRef = useRef(0)  // 0 = playing, >0 = counting down  // direct ref for immediate response

  const getCanvasX = useCallback((clientX)=>{
    const canvas=canvasRef.current; if(!canvas) return W/2
    const rect=canvas.getBoundingClientRect()
    return (clientX-rect.left)*(W/rect.width)
  },[])

  const addBrickParticles = useCallback((bx,by,bw,bh)=>{
    const colors=['#C8A040','#FFD700','#FFA500','#ff6b6b','#a78bfa']
    for(let i=0;i<14;i++){
      const px=bx+Math.random()*bw, py=by+Math.random()*bh
      const a=Math.random()*Math.PI*2, sp=2+Math.random()*4
      particlesRef.current.push({x:px,y:py,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,
        r:3+Math.random()*5,life:25+Math.random()*15,maxLife:40,color:colors[Math.floor(Math.random()*colors.length)]})
    }
  },[])

  const start = useCallback(()=>{
    const canvas=canvasRef.current; if(!canvas) return
    canvas.width=W; canvas.height=H
    const pool=[...MOVIES].filter(m=>m.img).sort(()=>Math.random()-0.5)
    const imgCache={}
    pool.forEach(m=>{ const img=new Image(); img.src=getCachedPoster(m.id)||m.img; imgCache[m.id]=img })
    particlesRef.current=[]
    paddleXRef.current=W/2

    // Random ball direction: up, slightly angled
    const ang=(-Math.PI/2)+(Math.random()-0.5)*0.8
    stateRef.current={
      active:true, score:0, lives:3, frame:0,
      ball:{ x:W/2, y:H-120, vx:Math.cos(ang)*BALL_SPEED, vy:Math.sin(ang)*BALL_SPEED },
      countdown: 0,
      paddleX:W/2,
      bricks:initBricks(pool,imgCache),
      pool, imgCache, level:1, ballLaunched:false
    }
    setPhase('playing')

    function loop(){
      const s=stateRef.current; if(!s?.active) return
      const ctx=canvas.getContext('2d')
      s.frame++
      s.paddleX=paddleXRef.current

      const b=s.ball
      // Move
      b.x+=b.vx; b.y+=b.vy

      // Wall bounces
      if(b.x<BALL_R){ b.x=BALL_R; b.vx=Math.abs(b.vx) }
      if(b.x>W-BALL_R){ b.x=W-BALL_R; b.vx=-Math.abs(b.vx) }
      if(b.y<BALL_R){ b.y=BALL_R; b.vy=Math.abs(b.vy) }

      // Paddle bounce
      const px=s.paddleX-PADDLE_W/2; const paddleY=H-50
      if(b.y+BALL_R>paddleY && b.y+BALL_R<paddleY+PADDLE_H+8 && b.x>px-4 && b.x<px+PADDLE_W+4 && b.vy>0){
        // Angle based on where ball hits paddle
        const relX=(b.x-(px+PADDLE_W/2))/(PADDLE_W/2)  // -1 to 1
        const ang=-Math.PI/2+relX*0.85
        const sp=Math.hypot(b.vx,b.vy)
        b.vx=Math.cos(ang)*sp; b.vy=Math.sin(ang)*sp
        b.y=paddleY-BALL_R-1
        // Slight speed increase
        const newSp=Math.min(sp*1.015, BALL_SPEED*1.8)
        b.vx*=newSp/sp; b.vy*=newSp/sp
      }

      // Ball lost
      if(b.y>H+30){
        s.lives--
        if(s.lives<=0){ s.active=false; setScore(s.score); setPhase('dead'); return }
        // Reset ball
        const ang=(-Math.PI/2)+(Math.random()-0.5)*0.6
        b.x=s.paddleX; b.y=H-80
        b.vx=Math.cos(ang)*BALL_SPEED; b.vy=Math.sin(ang)*BALL_SPEED
      }

      // Brick collision — check all alive bricks
      for(const brick of s.bricks){
        if(!brick.alive) continue
        const bx=10+brick.c*(BRICK_W+BRICK_PAD)
        const by=GRID_TOP+brick.r*(BRICK_H+BRICK_PAD)

        // Circle-rect collision
        const nearX=Math.max(bx, Math.min(b.x, bx+BRICK_W))
        const nearY=Math.max(by, Math.min(b.y, by+BRICK_H))
        const dx=b.x-nearX, dy=b.y-nearY
        if(dx*dx+dy*dy < BALL_R*BALL_R){
          brick.alive=false
          s.score+=10*(s.level)
          addBrickParticles(bx,by,BRICK_W,BRICK_H)
          // Reflect: determine which side was hit
          const overlapX=BALL_R-Math.abs(dx), overlapY=BALL_R-Math.abs(dy)
          if(overlapX<overlapY){ b.vx=-b.vx } else { b.vy=-b.vy }
          break  // one brick per frame
        }
      }

      // Check win (all bricks cleared)
      if(s.bricks.every(br=>!br.alive) && !s.countdown){
        s.level++
        s.countdown = 3  // 3 second countdown
        s.bricks=initBricks(s.pool.sort(()=>Math.random()-0.5),s.imgCache)
        b.x=s.paddleX; b.y=H-80; b.vx=0; b.vy=0  // freeze ball
      }
      // Countdown between rounds
      if(s.countdown > 0) {
        b.x=s.paddleX; b.y=H-80; b.vx=0; b.vy=0  // hold ball
        if(s.frame % 60 === 0) {  // every second
          s.countdown--
          if(s.countdown === 0) {  // launch
            const sp=Math.min(BALL_SPEED*1.8, BALL_SPEED+s.level*0.3)
            const ang=(-Math.PI/2)+(Math.random()-0.5)*0.6
            b.vx=Math.cos(ang)*sp; b.vy=Math.sin(ang)*sp
          }
        }
      }

      // Particles
      particlesRef.current.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; p.vy+=0.08; p.life-- })
      particlesRef.current=particlesRef.current.filter(p=>p.life>0)

      // === DRAW ===
      const bg=ctx.createLinearGradient(0,0,0,H)
      bg.addColorStop(0,'#080612'); bg.addColorStop(1,'#0e0a1a')
      ctx.fillStyle=bg; ctx.fillRect(0,0,W,H)

      // Bricks
      s.bricks.forEach(brick=>{
        if(!brick.alive) return
        const bx=10+brick.c*(BRICK_W+BRICK_PAD)
        const by=GRID_TOP+brick.r*(BRICK_H+BRICK_PAD)
        if(brick.img?.complete&&brick.img.naturalWidth>0){
          ctx.drawImage(brick.img,bx,by,BRICK_W,BRICK_H)
        } else {
          const hue=(brick.r*40+brick.c*25)%360
          ctx.fillStyle=`hsla(${hue},60%,25%,1)`; ctx.fillRect(bx,by,BRICK_W,BRICK_H)
          ctx.fillStyle='rgba(200,160,64,0.5)'; ctx.font='8px Inter'; ctx.textAlign='center'
          ctx.fillText(brick.title?.slice(0,10),bx+BRICK_W/2,by+BRICK_H/2+3)
        }
        ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=1; ctx.strokeRect(bx,by,BRICK_W,BRICK_H)
      })

      // Particles
      drawParticles(ctx, particlesRef.current)

      // Paddle
      const pGrad=ctx.createLinearGradient(s.paddleX-PADDLE_W/2,paddleY,s.paddleX+PADDLE_W/2,paddleY)
      pGrad.addColorStop(0,'rgba(200,160,64,0.4)'); pGrad.addColorStop(0.5,'rgba(200,160,64,1)'); pGrad.addColorStop(1,'rgba(200,160,64,0.4)')
      ctx.fillStyle=pGrad; ctx.beginPath()
      // Use arc-based rounded rect (Safari compat — roundRect not available < 15.4)
      const rx=6, px2=s.paddleX-PADDLE_W/2
      ctx.beginPath(); ctx.moveTo(px2+rx,paddleY); ctx.lineTo(px2+PADDLE_W-rx,paddleY)
      ctx.arcTo(px2+PADDLE_W,paddleY,px2+PADDLE_W,paddleY+PADDLE_H,rx)
      ctx.lineTo(px2+PADDLE_W,paddleY+PADDLE_H-rx)
      ctx.arcTo(px2+PADDLE_W,paddleY+PADDLE_H,px2+PADDLE_W-rx,paddleY+PADDLE_H,rx)
      ctx.lineTo(px2+rx,paddleY+PADDLE_H)
      ctx.arcTo(px2,paddleY+PADDLE_H,px2,paddleY+PADDLE_H-rx,rx)
      ctx.lineTo(px2,paddleY+rx)
      ctx.arcTo(px2,paddleY,px2+rx,paddleY,rx)
      ctx.closePath(); ctx.fill()

      // Ball
      const ballGrad=ctx.createRadialGradient(b.x-2,b.y-2,2,b.x,b.y,BALL_R)
      ballGrad.addColorStop(0,'#ffffff'); ballGrad.addColorStop(1,'#c8a0ff')
      ctx.beginPath(); ctx.arc(b.x,b.y,BALL_R,0,Math.PI*2)
      ctx.fillStyle=ballGrad; ctx.fill()
      // Ball trail
      ctx.fillStyle='rgba(200,160,255,0.15)'; ctx.beginPath()
      ctx.arc(b.x-b.vx*2,b.y-b.vy*2,BALL_R*0.7,0,Math.PI*2); ctx.fill()

      // Countdown overlay
      if(s.countdown > 0) {
        ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(0,0,W,H)
        ctx.fillStyle='#C8A040'; ctx.font='bold 14px Inter'; ctx.textAlign='center'
        ctx.fillText(`Level ${s.level}`, W/2, H/2-40)
        ctx.font='black 80px Inter'; ctx.fillStyle='white'
        ctx.fillText(s.countdown, W/2, H/2+20)
        ctx.font='13px Inter'; ctx.fillStyle='rgba(200,160,64,0.7)'
        ctx.fillText('Get ready!', W/2, H/2+55)
      }
      // HUD
      ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,W,52)
      ctx.fillStyle='rgba(200,160,64,0.9)'; ctx.font='bold 20px Inter'; ctx.textAlign='left'
      ctx.fillText(s.score,14,32)
      ctx.fillStyle='rgba(200,160,64,0.5)'; ctx.font='11px Inter'
      ctx.fillText(`LVL ${s.level}`,14,48)
      ctx.font='16px serif'; ctx.textAlign='right'
      for(let i=0;i<3;i++){
        ctx.fillStyle=i<s.lives?'#ef4444':'rgba(80,80,80,0.4)'; ctx.fillText('♥',W-14-i*22,32)
      }

      if(s.active) rafRef.current=requestAnimationFrame(loop)
    }
    rafRef.current=requestAnimationFrame(loop)
  },[addBrickParticles])

  // Mouse/touch paddle control
  const movePaddle = useCallback((clientX)=>{
    const x=getCanvasX(clientX)
    paddleXRef.current=Math.max(PADDLE_W/2, Math.min(W-PADDLE_W/2, x))
  },[getCanvasX])

  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return
    canvas.width=W; canvas.height=H
    const ctx=canvas.getContext('2d')
    ctx.fillStyle='#080612'; ctx.fillRect(0,0,W,H)
  },[])
  useEffect(()=>()=>cancelAnimationFrame(rafRef.current),[])

  return (
    <div className="absolute inset-0 flex flex-col bg-black">
      <div className="flex-1 relative min-h-0 flex items-center justify-center overflow-hidden">
        <canvas ref={canvasRef}
          style={{touchAction:'none',maxWidth:'100%',maxHeight:'100%',width:'auto',height:'auto',aspectRatio:`${W}/${H}`,cursor:'none'}}
          onMouseMove={e=>movePaddle(e.clientX)}
          onTouchMove={e=>{ e.preventDefault(); movePaddle(e.touches[0].clientX) }}
          onTouchStart={e=>{ e.preventDefault(); movePaddle(e.touches[0].clientX) }}
        />
        {phase!=='playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm">
            {phase==='dead'?(
              <>
                <div className="text-5xl mb-3">🎬</div>
                <div className="text-2xl font-black text-white mb-1">That's a wrap!</div>
                <div className="text-4xl font-black text-gold font-mono mb-6">{score}</div>
                <div className="flex gap-3">
                  <button onClick={start} className="px-6 py-3 bg-gold text-black font-bold rounded-xl">Play Again</button>
                  <button onClick={()=>onEnd(score)} className="px-6 py-3 bg-surface border border-border rounded-xl text-sm font-semibold text-ink-secondary">Done</button>
                </div>
              </>
            ):(
              <>
                <div className="text-5xl mb-4">🧱</div>
                <div className="text-2xl font-black text-white mb-2">Cine Breakout</div>
                <div className="text-sm text-ink-muted mb-1 text-center px-8">Smash through the movie poster bricks with your ball.</div>
                <div className="text-xs text-ink-muted mb-6 text-center px-8">Move your mouse or finger to control the paddle. Don't let the ball drop!</div>
                <button onClick={start} className="px-8 py-3 bg-gold text-black font-black rounded-xl text-lg">Break it →</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
