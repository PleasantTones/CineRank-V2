import React, { useState, useRef, useEffect, useCallback } from 'react'
import { MOVIES } from '../../lib/movies'
import { getCachedPoster } from '../../lib/posters'
import { useStore } from '../../store/useStore'

const W = 390, H = 600
const POSTER_W = 64, POSTER_H = 92

export default function PosterStorm({ onEnd }) {
  const [phase, setPhase] = useState('idle')
  const [score, setScore] = useState(0)
  const { globalRatings } = useStore()
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const rafRef = useRef(null)

  const getCanvasCoords = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current; if (!canvas) return {x:0,y:0}
    const rect = canvas.getBoundingClientRect()
    return { x:(clientX-rect.left)*(W/rect.width), y:(clientY-rect.top)*(H/rect.height) }
  },[])

  const start = useCallback(()=>{
    const canvas = canvasRef.current; if(!canvas) return
    canvas.width=W; canvas.height=H

    // Classify movies by ELO — top half = GOOD (green), bottom half = BAD (red)
    const rated = Object.entries(globalRatings)
      .filter(([,r])=>r.matches>0)
      .sort((a,b)=>b[1].elo-a[1].elo)
    const goodIds = new Set(rated.slice(0,Math.ceil(rated.length/2)).map(([id])=>id))

    const pool = [...MOVIES].filter(m=>m.img)
    const imgCache = {}
    pool.forEach(m=>{ const img=new Image(); img.src=getCachedPoster(m.id)||m.img; imgCache[m.id]=img })

    stateRef.current = {
      active:true, score:0, lives:3, frame:0, spawnTimer:0, speed:1,
      posters:[], pool, imgCache, goodIds,
      feedback:[]  // { x,y,text,color,life }
    }
    setPhase('playing')

    function loop(){
      const s=stateRef.current; if(!s?.active) return
      const ctx=canvas.getContext('2d')
      s.frame++; s.speed=1+s.frame*0.00025

      // Spawn
      s.spawnTimer++
      const interval=Math.max(40,90-s.speed*20)
      if(s.spawnTimer>interval){
        s.spawnTimer=0
        const m=s.pool[Math.floor(Math.random()*s.pool.length)]
        const isGood=s.goodIds.has(m.id)
        const elo=globalRatings[m.id]?.elo
        s.posters.push({
          x:POSTER_W/2+Math.random()*(W-POSTER_W), y:-POSTER_H,
          vy:(0.9+Math.random()*0.7)*s.speed,
          movieId:m.id, img:s.imgCache[m.id], isGood,
          elo, title:m.title, tapped:false
        })
      }

      // Move posters
      s.posters.forEach(p=>{ p.y+=p.vy })
      // Poster passed bottom — only bad to miss GOOD ones
      const gone=s.posters.filter(p=>p.y>H+POSTER_H && !p.tapped)
      gone.forEach(p=>{
        if(p.isGood){ s.lives--; if(s.lives<=0){s.active=false;setScore(s.score);setPhase('dead')} }
      })
      s.posters=s.posters.filter(p=>p.y<=H+POSTER_H)

      // Feedback
      s.feedback.forEach(f=>{ f.y-=1.5; f.life-- })
      s.feedback=s.feedback.filter(f=>f.life>0)

      // Draw background
      const bg=ctx.createLinearGradient(0,0,0,H)
      bg.addColorStop(0,'#0d0b18'); bg.addColorStop(1,'#14101e')
      ctx.fillStyle=bg; ctx.fillRect(0,0,W,H)

      // Falling posters
      s.posters.forEach(p=>{
        const x=p.x-POSTER_W/2, y=p.y-POSTER_H/2
        ctx.save()
        // Glow border (faint color hint as poster gets closer)
        const proximity=Math.max(0,(p.y)/(H*0.7))
        if(proximity>0.5){
          ctx.shadowBlur=12
          ctx.shadowColor=p.isGood?'rgba(52,211,153,0.6)':'rgba(239,68,68,0.6)'
        }
        ctx.strokeStyle=p.isGood?`rgba(52,211,153,${proximity*0.8})`:`rgba(239,68,68,${proximity*0.8})`
        ctx.lineWidth=2; ctx.strokeRect(x,y,POSTER_W,POSTER_H)
        ctx.shadowBlur=0
        if(p.img?.complete&&p.img.naturalWidth>0){
          ctx.drawImage(p.img,x,y,POSTER_W,POSTER_H)
          ctx.strokeRect(x,y,POSTER_W,POSTER_H)
        } else {
          ctx.fillStyle='#1a1208'; ctx.fillRect(x,y,POSTER_W,POSTER_H)
          ctx.fillStyle='rgba(200,160,64,0.5)'; ctx.font='9px Inter'; ctx.textAlign='center'
          const words=p.title.split(' ')
          let line='',lines=[],mw=POSTER_W-8
          words.forEach(w=>{const t=line?line+' '+w:w;ctx.measureText(t).width>mw?(lines.push(line),line=w):(line=t)});lines.push(line)
          lines.slice(0,3).forEach((l,i)=>ctx.fillText(l,p.x,p.y+i*12-10))
          ctx.strokeRect(x,y,POSTER_W,POSTER_H)
        }
        // Speed trail
        ctx.fillStyle='rgba(255,255,255,0.04)'; ctx.fillRect(x+4,y-p.vy*3,POSTER_W-8,p.vy*3)
        ctx.restore()
      })

      // Feedback text
      s.feedback.forEach(f=>{
        ctx.globalAlpha=f.life/20
        ctx.fillStyle=f.color; ctx.font='bold 16px Inter'; ctx.textAlign='center'
        ctx.fillText(f.text,f.x,f.y)
      })
      ctx.globalAlpha=1

      // HUD
      ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,W,44)
      ctx.fillStyle='rgba(200,160,64,0.9)'; ctx.font='bold 20px Inter'; ctx.textAlign='left'
      ctx.fillText(s.score,14,30)
      ctx.font='16px serif'; ctx.textAlign='right'
      for(let i=0;i<3;i++){
        ctx.fillStyle=i<s.lives?'#ef4444':'rgba(80,80,80,0.4)'; ctx.fillText('♥',W-14-i*22,30)
      }
      ctx.fillStyle='rgba(200,160,64,0.5)'; ctx.font='9px Inter'; ctx.textAlign='center'
      ctx.fillText('TAP the posters you\'ve ranked HIGHER — avoid the bottom half!',W/2,H-6)

      if(s.active) rafRef.current=requestAnimationFrame(loop)
    }
    rafRef.current=requestAnimationFrame(loop)
  },[globalRatings])

  const handleTap = useCallback((clientX, clientY)=>{
    const s=stateRef.current; if(!s?.active) return
    const {x,y}=getCanvasCoords(clientX,clientY)
    let hit=false
    s.posters.forEach(p=>{
      if(p.tapped) return
      if(Math.abs(x-p.x)<POSTER_W/2+4 && Math.abs(y-(p.y-POSTER_H/2))<POSTER_H/2+4){
        p.tapped=true; hit=true
        if(p.isGood){
          const pts=Math.round(100+p.elo/10)
          s.score+=pts
          s.feedback.push({x:p.x,y:p.y-POSTER_H/2,text:`+${pts}`,color:'#34d399',life:20})
        } else {
          s.lives--
          s.feedback.push({x:p.x,y:p.y-POSTER_H/2,text:'-1 ♥',color:'#ef4444',life:20})
          if(s.lives<=0){s.active=false;setScore(s.score);setPhase('dead')}
        }
      }
    })
  },[getCanvasCoords])

  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return
    canvas.width=W; canvas.height=H
    const ctx=canvas.getContext('2d')
    ctx.fillStyle='#0d0b18'; ctx.fillRect(0,0,W,H)
  },[])

  useEffect(()=>{
    return ()=>cancelAnimationFrame(rafRef.current)
  },[])

  return (
    <div className="absolute inset-0 flex flex-col bg-black">
      <div className="flex-1 relative min-h-0 flex items-center justify-center overflow-hidden">
        <canvas ref={canvasRef}
          style={{touchAction:'none',maxWidth:'100%',maxHeight:'100%',width:'auto',height:'auto',aspectRatio:`${W}/${H}`}}
          onClick={e=>handleTap(e.clientX,e.clientY)}
          onTouchStart={e=>{ e.preventDefault(); Array.from(e.changedTouches).forEach(t=>handleTap(t.clientX,t.clientY)) }}
        />
        {phase!=='playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm">
            {phase==='dead'?(
              <>
                <div className="text-5xl mb-3">🌪️</div>
                <div className="text-2xl font-black text-white mb-1">Storm's over!</div>
                <div className="text-4xl font-black text-gold font-mono mb-6">{score}</div>
                <div className="flex gap-3">
                  <button onClick={start} className="px-6 py-3 bg-gold text-black font-bold rounded-xl">Play Again</button>
                  <button onClick={()=>onEnd(score)} className="px-6 py-3 bg-surface border border-border rounded-xl text-sm font-semibold text-ink-secondary">Done</button>
                </div>
              </>
            ):(
              <>
                <div className="text-5xl mb-4">🌩️</div>
                <div className="text-2xl font-black text-white mb-2">Poster Storm</div>
                <div className="text-sm text-ink-muted mb-1 text-center px-8">Posters rain down. Tap the ones your group ranked <span className="text-green-400 font-bold">TOP HALF</span> by ELO.</div>
                <div className="text-xs text-ink-muted mb-2 text-center px-8">Tap a <span className="text-red-400">bottom-half</span> movie = lose a life. Let a <span className="text-green-400">good</span> one fall = lose a life.</div>
                <div className="text-xs text-ink-muted mb-6 text-center px-8">Hint: a red glow means danger as it gets closer.</div>
                <button onClick={start} className="px-8 py-3 bg-gold text-black font-black rounded-xl text-lg">Brace for Impact →</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
