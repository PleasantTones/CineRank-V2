import React, { useState, useRef, useEffect, useCallback } from 'react'
import { MOVIES } from '../../lib/movies'
import { getCachedPoster } from '../../lib/posters'

const W = 390, H = 600
const SHIP_R = 14, BULLET_SPEED = 9, ROTATE_SPEED = 0.07

function wrapX(x) { return ((x % W) + W) % W }
function wrapY(y) { return ((y % H) + H) % H }

function circleColl(ax,ay,ar,bx,by,br){ const d=Math.hypot(ax-bx,ay-by); return d<ar+br }

function initState(imgCache, pool) {
  return {
    active: true, score: 0, lives: 3, frame: 0,
    ship: { x: W/2, y: H/2, angle: -Math.PI/2, invincible: 0 },
    bullets: [], posters: [], spawnTimer: 0, speed: 1,
    shootCooldown: 0, pool, poolIdx: 0, imgCache,
    rotateLeft: false, rotateRight: false, shooting: false,
  }
}

function spawnPoster(s) {
  const edge = Math.floor(Math.random() * 4)
  let x, y
  if (edge === 0) { x = Math.random()*W; y = -50 }
  else if (edge === 1) { x = Math.random()*W; y = H+50 }
  else if (edge === 2) { x = -50; y = Math.random()*H }
  else { x = W+50; y = Math.random()*H }
  const angle = Math.atan2(H/2-y, W/2-x) + (Math.random()-0.5)*1.2
  const sp = (0.6 + Math.random()*0.6) * s.speed
  const m = s.pool[s.poolIdx % s.pool.length]; s.poolIdx++
  const sz = 28 + Math.random()*20
  s.posters.push({ x, y, vx: Math.cos(angle)*sp, vy: Math.sin(angle)*sp,
    angle: Math.random()*Math.PI*2, angV: (Math.random()-0.5)*0.04,
    movieId: m.id, img: s.imgCache[m.id], r: sz, hits: 0, maxHits: 1 })
}

function drawScene(ctx, s, particles) {
  ctx.fillStyle = '#080610'; ctx.fillRect(0,0,W,H)
  // Stars
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  for (let i=0; i<60; i++) {
    const sx=(i*73+s.frame*0.02)%W, sy=(i*47+s.frame*0.015)%H
    ctx.fillRect(sx,sy,1,1)
  }
  // Particles
  particles.forEach(p=>{
    ctx.globalAlpha=p.life/p.maxLife
    ctx.fillStyle=p.color; ctx.beginPath()
    ctx.arc(p.x,p.y,p.r*p.life/p.maxLife,0,Math.PI*2); ctx.fill()
  })
  ctx.globalAlpha=1
  // Bullets
  s.bullets.forEach(b=>{
    ctx.fillStyle='#FFE060'; ctx.beginPath()
    ctx.arc(b.x,b.y,3,0,Math.PI*2); ctx.fill()
    ctx.fillStyle='rgba(255,220,60,0.3)'; ctx.beginPath()
    ctx.arc(b.x,b.y,6,0,Math.PI*2); ctx.fill()
  })
  // Posters
  s.posters.forEach(ob=>{
    ctx.save(); ctx.translate(ob.x,ob.y); ctx.rotate(ob.angle)
    const sz=ob.r*2
    ctx.strokeStyle='rgba(200,160,64,0.7)'; ctx.lineWidth=2
    ctx.strokeRect(-ob.r,-ob.r,sz,sz)
    if(ob.img?.complete && ob.img.naturalWidth>0){
      ctx.drawImage(ob.img,-ob.r,-ob.r,sz,sz)
    } else {
      ctx.fillStyle='#1a1208'; ctx.fillRect(-ob.r,-ob.r,sz,sz)
      ctx.fillStyle='rgba(200,160,64,0.5)'; ctx.font='10px Inter'; ctx.textAlign='center'
      ctx.fillText('🎬',0,4)
    }
    ctx.restore()
  })
  // Ship
  const sh=s.ship
  if(sh.invincible===0 || sh.invincible%6<3){
    ctx.save(); ctx.translate(sh.x,sh.y); ctx.rotate(sh.angle)
    ctx.strokeStyle='#C8A040'; ctx.lineWidth=2; ctx.beginPath()
    ctx.moveTo(0,-SHIP_R); ctx.lineTo(-SHIP_R*0.65,SHIP_R*0.75); ctx.lineTo(SHIP_R*0.65,SHIP_R*0.75)
    ctx.closePath(); ctx.stroke()
    ctx.fillStyle='rgba(200,160,64,0.15)'; ctx.fill()
    // Thruster
    if(s.rotateLeft||s.rotateRight){
      ctx.strokeStyle='rgba(255,120,20,0.8)'; ctx.lineWidth=1.5; ctx.beginPath()
      ctx.moveTo(-4,SHIP_R*0.6); ctx.lineTo(0,SHIP_R+8); ctx.lineTo(4,SHIP_R*0.6); ctx.stroke()
    }
    ctx.restore()
  }
  // HUD
  ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(0,0,W,44)
  ctx.fillStyle='rgba(200,160,64,0.9)'; ctx.font='bold 20px Inter,sans-serif'
  ctx.textAlign='left'; ctx.fillText(s.score,14,30)
  ctx.font='16px serif'; ctx.textAlign='right'
  for(let i=0;i<3;i++){
    ctx.fillStyle=i<s.lives?'#ef4444':'rgba(80,80,80,0.4)'; ctx.fillText('♥',W-14-i*22,30)
  }
  ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.font='10px Inter'; ctx.textAlign='center'
  ctx.fillText(`LV ${Math.floor(s.speed*10-9)}`,W/2,30)
}

export default function PosterBlaster({ onEnd }) {
  const [phase, setPhase] = useState('idle')
  const [score, setScore] = useState(0)
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const particlesRef = useRef([])
  const rafRef = useRef(null)
  const keysRef = useRef({})

  const getCanvasCoords = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current; if (!canvas) return {x:0,y:0}
    const rect = canvas.getBoundingClientRect()
    return { x: (clientX-rect.left)*(W/rect.width), y: (clientY-rect.top)*(H/rect.height) }
  }, [])

  const addParticles = useCallback((x,y,color,count=8)=>{
    for(let i=0;i<count;i++){
      const a=Math.random()*Math.PI*2, sp=1+Math.random()*4
      particlesRef.current.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:3+Math.random()*4,
        life:30+Math.random()*20, maxLife:50, color})
    }
  },[])

  const start = useCallback(()=>{
    const canvas = canvasRef.current; if(!canvas) return
    canvas.width=W; canvas.height=H
    const pool = [...MOVIES].filter(m=>m.img).sort(()=>Math.random()-0.5)
    const imgCache = {}
    pool.forEach(m=>{ const img=new Image(); img.src=getCachedPoster(m.id)||m.img; imgCache[m.id]=img })
    particlesRef.current = []
    const s = initState(imgCache, pool)
    stateRef.current = s
    setPhase('playing')

    function loop(){
      const s=stateRef.current; if(!s?.active) return
      const ctx=canvas.getContext('2d')
      s.frame++; s.speed = 1 + s.frame*0.0003
      s.shootCooldown = Math.max(0, s.shootCooldown-1)

      // Rotate
      if(s.rotateLeft) s.ship.angle -= ROTATE_SPEED
      if(s.rotateRight) s.ship.angle += ROTATE_SPEED
      if(s.ship.invincible>0) s.ship.invincible--

      // Shoot
      if(s.shooting && s.shootCooldown===0){
        s.bullets.push({x:s.ship.x+Math.cos(s.ship.angle)*SHIP_R, y:s.ship.y+Math.sin(s.ship.angle)*SHIP_R,
          vx:Math.cos(s.ship.angle)*BULLET_SPEED, vy:Math.sin(s.ship.angle)*BULLET_SPEED, life:55})
        s.shootCooldown=10
      }

      // Move bullets
      s.bullets.forEach(b=>{ b.x=wrapX(b.x+b.vx); b.y=wrapY(b.y+b.vy); b.life-- })
      s.bullets=s.bullets.filter(b=>b.life>0)

      // Spawn posters
      s.spawnTimer++
      if(s.spawnTimer > Math.max(40, 90-s.speed*20)){
        s.spawnTimer=0; spawnPoster(s)
      }

      // Move posters
      s.posters.forEach(ob=>{ ob.x=wrapX(ob.x+ob.vx); ob.y=wrapY(ob.y+ob.vy); ob.angle+=ob.angV })

      // Bullet-poster collision
      s.bullets.forEach(b=>{
        s.posters.forEach(ob=>{
          if(circleColl(b.x,b.y,4,ob.x,ob.y,ob.r)){
            b.life=0; ob.hits++
            addParticles(ob.x,ob.y,'#FFD700',6)
            if(ob.hits>=ob.maxHits){ ob.r=-1; s.score+=Math.round(20*s.speed); addParticles(ob.x,ob.y,'#C8A040',12) }
          }
        })
      })
      s.posters=s.posters.filter(ob=>ob.r>0)

      // Ship-poster collision
      if(s.ship.invincible===0){
        s.posters.forEach(ob=>{
          if(circleColl(s.ship.x,s.ship.y,SHIP_R*0.7,ob.x,ob.y,ob.r)){
            s.lives--; s.ship.invincible=120
            addParticles(s.ship.x,s.ship.y,'#ef4444',12)
            if(s.lives<=0){ s.active=false; setScore(s.score); setPhase('dead') }
          }
        })
      }

      // Particles
      particlesRef.current.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; p.vy+=0.05; p.life-- })
      particlesRef.current=particlesRef.current.filter(p=>p.life>0)

      drawScene(ctx,s,particlesRef.current)
      if(s.active) rafRef.current=requestAnimationFrame(loop)
    }
    rafRef.current=requestAnimationFrame(loop)
  },[addParticles])

  useEffect(()=>{
    const down=e=>{ keysRef.current[e.code]=true
      const s=stateRef.current; if(!s?.active) return
      if(e.code==='ArrowLeft'||e.code==='KeyA') s.rotateLeft=true
      if(e.code==='ArrowRight'||e.code==='KeyD') s.rotateRight=true
      if(e.code==='Space'){ e.preventDefault(); s.shooting=true }
    }
    const up=e=>{ keysRef.current[e.code]=false
      const s=stateRef.current; if(!s) return
      if(e.code==='ArrowLeft'||e.code==='KeyA') s.rotateLeft=false
      if(e.code==='ArrowRight'||e.code==='KeyD') s.rotateRight=false
      if(e.code==='Space') s.shooting=false
    }
    window.addEventListener('keydown',down); window.addEventListener('keyup',up)
    return ()=>{ window.removeEventListener('keydown',down); window.removeEventListener('keyup',up); cancelAnimationFrame(rafRef.current) }
  },[])

  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return
    canvas.width=W; canvas.height=H
    const ctx=canvas.getContext('2d')
    ctx.fillStyle='#080610'; ctx.fillRect(0,0,W,H)
  },[])

  const btnDown=(action)=>{ const s=stateRef.current; if(s) s[action]=true }
  const btnUp=(action)=>{ const s=stateRef.current; if(s) s[action]=false }

  return (
    <div className="absolute inset-0 flex flex-col bg-black">
      <div className="flex-1 relative min-h-0 flex items-center justify-center overflow-hidden">
        <canvas ref={canvasRef} style={{touchAction:'none',maxWidth:'100%',maxHeight:'100%',width:'auto',height:'auto',aspectRatio:`${W}/${H}`}} />
        {phase!=='playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm">
            {phase==='dead'?(
              <>
                <div className="text-5xl mb-3">💥</div>
                <div className="text-2xl font-black text-white mb-1">Ship destroyed!</div>
                <div className="text-4xl font-black text-gold font-mono mb-6">{score}</div>
                <div className="flex gap-3">
                  <button onClick={start} className="px-6 py-3 bg-gold text-black font-bold rounded-xl">Play Again</button>
                  <button onClick={()=>onEnd(score)} className="px-6 py-3 bg-surface border border-border rounded-xl text-sm font-semibold text-ink-secondary">Done</button>
                </div>
              </>
            ):(
              <>
                <div className="text-5xl mb-4">🚀</div>
                <div className="text-2xl font-black text-white mb-2">Poster Blaster</div>
                <div className="text-sm text-ink-muted mb-1 text-center px-8">Rotate your ship and blast incoming movie posters.</div>
                <div className="text-xs text-ink-muted mb-6 text-center px-8">← → to rotate · Space to shoot · or use the buttons below</div>
                <button onClick={start} className="px-8 py-3 bg-gold text-black font-black rounded-xl text-lg">Launch →</button>
              </>
            )}
          </div>
        )}
      </div>
      {phase==='playing' && (
        <div className="flex-shrink-0 grid grid-cols-3 gap-2 p-2 bg-black">
          <button onPointerDown={()=>btnDown('rotateLeft')} onPointerUp={()=>btnUp('rotateLeft')} onPointerLeave={()=>btnUp('rotateLeft')}
            className="py-4 bg-surface border border-border rounded-xl text-xl font-bold active:bg-raised select-none">◄</button>
          <button onPointerDown={()=>btnDown('shooting')} onPointerUp={()=>btnUp('shooting')} onPointerLeave={()=>btnUp('shooting')}
            className="py-4 bg-gold/20 border border-gold/40 rounded-xl text-xl active:bg-gold/40 select-none">🔫</button>
          <button onPointerDown={()=>btnDown('rotateRight')} onPointerUp={()=>btnUp('rotateRight')} onPointerLeave={()=>btnUp('rotateRight')}
            className="py-4 bg-surface border border-border rounded-xl text-xl font-bold active:bg-raised select-none">►</button>
        </div>
      )}
    </div>
  )
}
