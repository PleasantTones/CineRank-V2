import React, { useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { MOVIES, PLAYERS, PLAYER_COLORS } from '../lib/movies'

// ── Constants ─────────────────────────────────────────────────────────────────
const HW=3.5,HL=80,HH=4.2,EYE=1.7
const LW0=6,LW1=22,LW2=40,LW3=56
const DOOR_W=1.3
const FOV=Math.PI/2.0,HALF_FOV=FOV/2
const PH=HH*0.92,PW=1.7,SPACING=1.6

export default function Hall() {
  const canvasRef = useRef(null)
  const labelRef = useRef(null)
  const roomRef = useRef(null)
  const collectRef = useRef(null)
  const collectCountRef = useRef(null)
  const { players, globalRatings, player, collected, collectPoster } = useStore()
  const stateRef = useRef(null)
  const keysRef = useRef({})
  const rafRef = useRef(null)
  const joyRef = useRef({ on: false, dx: 0, dy: 0 })
  const nearestRef = useRef(null)

  const getGlobalRanked = useCallback(() => {
    return [...MOVIES].filter(m => globalRatings[m.id]?.matches > 0)
      .sort((a,b) => globalRatings[b.id].elo - globalRatings[a.id].elo)
  }, [globalRatings])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const W = canvas.width = Math.min(680, window.innerWidth - 8)
    const H = canvas.height = Math.round(W * 0.58)
    const ctx = canvas.getContext('2d')

    // ── Camera ────────────────────────────────────────────────────────────────
    let cam = { x: 0, z: -8, yaw: 0, pitch: 0.04 }
    let running = true
    let nearestPainting = null
    const collectedSet = new Set(collected)

    // ── Project point ─────────────────────────────────────────────────────────
    function pr(wx,wy,wz) {
      const dx=wx-cam.x,dz=wz-cam.z
      const cy=Math.cos(cam.yaw),sy=Math.sin(cam.yaw)
      const rx=dx*cy-dz*sy,rz=dx*sy+dz*cy,ry=wy-EYE
      if(rz<=0.05)return null
      const cp=Math.cos(cam.pitch),sp=Math.sin(cam.pitch)
      const pz=rz*cp-ry*sp,py=rz*sp+ry*cp
      if(pz<=0.05)return null
      return{sx:W/2+(rx/pz)*W/(2*Math.tan(HALF_FOV)),sy:H/2-(py/pz)*W/(2*Math.tan(HALF_FOV))*(H/W)+cam.pitch*H*0.6,d:rz}
    }

    function projRect(px,y0,y1,z0,z1){
      const c=[pr(px,y1,z0),pr(px,y1,z1),pr(px,y0,z1),pr(px,y0,z0)]
      return c.every(v=>v)?c:null
    }

    // ── Paintings setup ────────────────────────────────────────────────────────
    const paintings = []
    const rankedMovies = getGlobalRanked()
    const globalList = rankedMovies.length > 0 ? rankedMovies : [...MOVIES]

    function sideP(id,side,pz,pw,ph,imgSrc,emoji,title,sub,rank,pc,type){
      const px=side<0?-HW:HW,nx=side<0?1:-1
      const imgEl=imgSrc?Object.assign(new Image(),{src:imgSrc}):null
      paintings.push({id,px,pz,nx,nz:0,pw,ph,imgEl,emoji,title,sub,rankNum:rank,playerColor:pc,type})
    }
    function wingP(id,side,pz,pw,ph,imgSrc,emoji,title,sub,rank,pc,type){
      const px=side<0?-HW-2.5:HW+2.5,nx=side<0?1:-1
      const imgEl=imgSrc?Object.assign(new Image(),{src:imgSrc}):null
      paintings.push({id,px,pz,nx,nz:0,pw,ph,imgEl,emoji,title,sub,rankNum:rank,playerColor:pc,type})
    }

    // Gods of Olympus (z -18 to -2): player cards
    PLAYERS.forEach((p,i) => {
      const pd = players[p] || {}; const r = pd.ratings || {}
      const tm = Math.round(MOVIES.reduce((s,m)=>s+(r[m.id]?.matches||0),0)/2)
      const tw = MOVIES.reduce((s,m)=>s+(r[m.id]?.wins||0),0)
      const wr = tm>0?Math.round(tw/(tm*2)*100):0
      const topM = [...MOVIES].filter(m=>r[m.id]?.matches>0).sort((a,b)=>(r[b.id]?.elo||0)-(r[a.id]?.elo||0))[0]
      sideP('god_'+p,i%2===0?-1:1,-17+i*3.5,PW*1.1,PH*1.02,topM?.img||null,
        ['👑','⚔️','🏆','🎯','⚡'][i],p,`${tm} matchups · ${wr}% win rate`,null,PLAYER_COLORS[p],'player')
    })

    // Gallery of Champions (z 8–26)
    globalList.slice(0,12).forEach((m,i)=>{
      const gr=globalRatings[m.id]||{elo:1000,wins:0,matches:0}
      sideP('mv_'+m.id,i%2===0?-1:1,8+i*1.6,PW,PH,m.img,null,m.title,
        `ELO ${gr.elo} · Rank #${i+1} · ${gr.wins}W`,i+1,null,'movie')
    })

    // Wing rooms (z 6-22)
    const games=[{e:'🏃',n:'Cinema Runner'},{e:'🎭',n:'Memory Match'},{e:'🔤',n:'Scramble'},{e:'🎯',n:'Quick Draw'},{e:'🎪',n:'Poster Catch'},{e:'🍅',n:'Rotten or Fresh'}]
    games.forEach((g,i)=>wingP('arc_'+i,-1,7.5+i*2.5,PW,PH,null,g.e,g.n,'Arcade game',null,null,'arcade'))
    PLAYERS.forEach((p,i)=>{
      const r=(players[p]||{}).ratings||{}
      const topM=[...MOVIES].filter(m=>r[m.id]?.matches>0).sort((a,b)=>(r[b.id]?.elo||0)-(r[a.id]?.elo||0))[0]
      wingP('pl_'+p,1,7.5+i*3.2,PW,PH,topM?.img||null,'🏆',p,`${p}'s Hall`,null,PLAYER_COLORS[p],'player')
    })

    // Inner Sanctum (z 31–55): most divisive
    const controversial = [...MOVIES].map(m=>{
      const elos=PLAYERS.map(p=>(players[p]?.ratings?.[m.id]?.elo)||1000)
      return{m,sp:Math.max(...elos)-Math.min(...elos)}
    }).sort((a,b)=>b.sp-a.sp).slice(0,9)
    controversial.forEach(({m,sp},i)=>{
      const gr=globalRatings[m.id]||{elo:1000}
      sideP('con_'+m.id,i%2===0?-1:1,31+i*2.7,PW,PH,m.img,null,m.title,
        sp>0?`${sp} ELO spread`:`#${i+1} in rotation`,null,null,'movie')
    })

    // Wing of Controversy & Hall of Champions (z 41–54)
    PLAYERS.forEach((p,i)=>{
      const r=(players[p]||{}).ratings||{}
      const sorted=[...MOVIES].filter(m=>r[m.id]?.matches>0).sort((a,b)=>(r[a.id]?.elo||0)-(r[b.id]?.elo||0))
      const contrarian=sorted[0]
      wingP('ctv_'+p,-1,41.5+i*3.2,PW,PH,contrarian?.img||null,null,`${p}'s Hot Take`,
        contrarian?.title||'TBD',null,PLAYER_COLORS[p],'player')
      const champion=sorted[sorted.length-1]
      wingP('champ_'+p,1,41.5+i*3.2,PW,PH,champion?.img||null,null,`${p}'s Champion`,
        champion?.title||'TBD',null,PLAYER_COLORS[p],'player')
    })

    // Vault of Legends (z 61–73)
    const vaultSrc=[...MOVIES].filter(m=>globalRatings[m.id]?.wins>0).sort((a,b)=>globalRatings[b.id].wins-globalRatings[a.id].wins)
    const vaultList=vaultSrc.length>=3?vaultSrc:globalList
    vaultList.slice(0,6).forEach((m,i)=>{
      const gr=globalRatings[m.id]||{wins:0,matches:0,elo:1000}
      sideP('vlt_'+m.id,-1,61+i*2.4,PW,PH,m.img,null,m.title,
        gr.wins>0?`${gr.wins} wins`:`Rank #${i+1}`,i<3?i+1:null,null,'movie')
    })
    const wrcList=globalList.slice(6,12)
    wrcList.forEach((m,i)=>{
      const gr=globalRatings[m.id]||{elo:1000}
      sideP('wrc_'+m.id,1,61+i*2.4,PW,PH,m.img,null,m.title,`ELO ${gr.elo}`,null,null,'movie')
    })

    // Grand Finale (z 76–79)
    if(globalList.length>0){
      const k=globalList[0]; const kg=globalRatings[k.id]||{elo:1000,wins:0}
      const imgElKing=k.img?Object.assign(new Image(),{src:k.img}):null
      paintings.push({id:'king_end',px:0,pz:HL-0.4,nx:0,nz:-1,pw:PW*1.3,ph:PH,
        imgEl:imgElKing,emoji:null,title:k.title,sub:`👑 #1 ALL-TIME · ELO ${kg.elo}`,rankNum:1,playerColor:null,type:'movie'})
      if(globalList[1]) sideP('fin2',-1,77,PW*1.2,PH,globalList[1].img,null,globalList[1].title,
        `#2 ALL-TIME · ELO ${globalRatings[globalList[1].id]?.elo||1000}`,2,null,'movie')
      if(globalList[2]) sideP('fin3',1,77,PW*1.2,PH,globalList[2].img,null,globalList[2].title,
        `#3 ALL-TIME · ELO ${globalRatings[globalList[2].id]?.elo||1000}`,3,null,'movie')
    }

    // ── drawScene (raycaster) ─────────────────────────────────────────────────
    function drawScene(){
      const cy=Math.cos(cam.yaw),sy=Math.sin(cam.yaw)
      const horizonY=H*0.5+cam.pitch*H*0.6

      // Ceiling
      const cg=ctx.createLinearGradient(0,0,0,horizonY)
      cg.addColorStop(0,'#e8dfc8');cg.addColorStop(0.5,'#d4c898');cg.addColorStop(1,'#c0aa70')
      ctx.fillStyle=cg;ctx.fillRect(0,0,W,horizonY+1)
      const dg=ctx.createRadialGradient(W/2,horizonY*0.25,0,W/2,horizonY*0.25,W*0.38)
      dg.addColorStop(0,'rgba(155,198,235,0.5)');dg.addColorStop(0.45,'rgba(195,210,188,0.2)');dg.addColorStop(1,'transparent')
      ctx.fillStyle=dg;ctx.fillRect(0,0,W,horizonY+1)

      // Floor — red carpet
      const fg=ctx.createLinearGradient(0,horizonY,0,H)
      fg.addColorStop(0,'#c0282a');fg.addColorStop(0.4,'#9a1c1e');fg.addColorStop(0.75,'#6e1214');fg.addColorStop(1,'#3a0808')
      ctx.fillStyle=fg;ctx.fillRect(0,horizonY,W,H-horizonY)
      // Carpet sheen
      const vx=W*0.5,vy=horizonY
      for(let x=-6;x<=6;x++){
        ctx.strokeStyle=`rgba(60,8,8,${0.18*(1-Math.abs(x)/7)})`;ctx.lineWidth=0.8
        ctx.beginPath();ctx.moveTo(vx+x*W*0.42,H);ctx.lineTo(vx,vy);ctx.stroke()
      }
      ctx.strokeStyle='rgba(195,158,52,0.7)';ctx.lineWidth=2
      ctx.beginPath();ctx.moveTo(0,horizonY);ctx.lineTo(W,horizonY);ctx.stroke()

      // Raycast
      for(let col=0;col<W;col++){
        const rayAngle=cam.yaw-HALF_FOV+(col/W)*FOV
        const rdx=Math.sin(rayAngle),rdz=Math.cos(rayAngle)
        let hitDist=78,hitWallX=0,wallSide=0

        // Side walls
        if(Math.abs(rdx)>0.0001){
          const tL=(-HW-cam.x)/rdx;const tR=(HW-cam.x)/rdx
          if(tL>0.05){const hz=cam.z+tL*rdz;if(hz>-21&&hz<HL){const cd=tL*Math.cos(rayAngle-cam.yaw);if(cd<hitDist){hitDist=cd;hitWallX=((hz%1)+1)%1;wallSide=0;}}}
          if(tR>0.05){const hz=cam.z+tR*rdz;if(hz>-21&&hz<HL){const cd=tR*Math.cos(rayAngle-cam.yaw);if(cd<hitDist){hitDist=cd;hitWallX=((hz%1)+1)%1;wallSide=0;}}}
        }
        // End/back walls
        if(Math.abs(rdz)>0.0001){
          const tEnd=(HL-cam.z)/rdz;const tBack=(-20-cam.z)/rdz
          if(tEnd>0.05){const hx=cam.x+tEnd*rdx;if(hx>=-HW&&hx<=HW){const cd=tEnd*Math.cos(rayAngle-cam.yaw);if(cd<hitDist){hitDist=cd;hitWallX=((hx/HW*0.5+0.5)%1+1)%1;wallSide=2;}}}
          if(tBack>0.05){const hx=cam.x+tBack*rdx;if(hx>=-HW&&hx<=HW){const cd=tBack*Math.cos(rayAngle-cam.yaw);if(cd<hitDist){hitDist=cd;hitWallX=0.5;wallSide=2;}}}
        }
        // Wing walls
        if(Math.abs(rdx)>0.0001){
          for(const[wz0,wz1]of[[LW0,LW1],[LW2,LW3]]){
            const tWL=(-HW-5-cam.x)/rdx;const tWR=(HW+5-cam.x)/rdx
            if(tWL>0.05){const hz=cam.z+tWL*rdz;if(hz>=wz0&&hz<=wz1){const cd=tWL*Math.cos(rayAngle-cam.yaw);if(cd<hitDist){hitDist=cd;hitWallX=((hz%1)+1)%1;wallSide=1;}}}
            if(tWR>0.05){const hz=cam.z+tWR*rdz;if(hz>=wz0&&hz<=wz1){const cd=tWR*Math.cos(rayAngle-cam.yaw);if(cd<hitDist){hitDist=cd;hitWallX=((hz%1)+1)%1;wallSide=1;}}}
          }
        }
        // Wing entrance walls
        if(Math.abs(rdz)>0.0001){
          for(const[wz0,wz1]of[[LW0,LW1],[LW2,LW3]]){
            for(const wz of[wz0,wz1]){
              const t=(wz-cam.z)/rdz
              if(t>0.05){const hx=cam.x+t*rdx;if((hx<-HW&&hx>=-HW-5)||(hx>HW&&hx<=HW+5)){const cd=t*Math.cos(rayAngle-cam.yaw);if(cd<hitDist){hitDist=cd;hitWallX=((hx%1)+1)%1;wallSide=1;}}}
            }
          }
        }
        // Transverse walls with door
        if(Math.abs(rdz)>0.0001){
          for(const wz of[0,30,60,75]){
            const t=(wz-cam.z)/rdz
            if(t>0.05){const hx=cam.x+t*rdx;if(hx>=-HW&&hx<=HW&&Math.abs(hx)>=DOOR_W){const cd=t*Math.cos(rayAngle-cam.yaw);if(cd<hitDist){hitDist=cd;hitWallX=((hx/HW*0.5+0.5)%1+1)%1;wallSide=2;}}}
          }
        }

        if(hitDist>=77)continue

        const stripH=Math.min(H*4,(HH/hitDist)*(H/(2*Math.tan(HALF_FOV/2))))
        const pitchOff=cam.pitch*H*0.6
        const wallTop=Math.max(0,(H/2-stripH/2)+pitchOff)
        const wallBot=Math.min(H,(H/2+stripH/2)+pitchOff)
        const b=Math.max(0.28,Math.min(1,1.02-hitDist*0.014))
        const marble=0.93+Math.sin(((hitWallX+1)%1)*26.3)*0.04+Math.cos(((hitWallX+1)%1)*9.7)*0.03
        const bv=b*marble
        let r,g,bl
        if(wallSide===2){r=238*bv;g=222*bv;bl=192*bv;}
        else if(wallSide===1){r=216*bv;g=200*bv;bl=168*bv;}
        else{r=230*bv;g=214*bv;bl=184*bv;}
        ctx.fillStyle=`rgb(${Math.round(r)},${Math.round(g)},${Math.round(bl)})`
        ctx.fillRect(col,wallTop,1,wallBot-wallTop)
        // Crown molding
        if(wallSide!==2){
          const gb=Math.max(0.4,b)
          ctx.fillStyle=`rgba(${Math.round(208*gb)},${Math.round(162*gb)},${Math.round(42*gb)},0.92)`
          ctx.fillRect(col,wallTop,1,Math.max(1,stripH*0.045))
        }
      }

      // Chandeliers
      for(let cz=4;cz<=HL;cz+=6){
        if(Math.abs(cz-cam.z)>22)continue
        const dx=0-cam.x,dz2=cz-cam.z
        const rx=dx*cy-dz2*sy,rz=dx*sy+dz2*cy,ry=HH-0.2-EYE
        if(rz<=0.1)continue
        const cp2=Math.cos(cam.pitch),sp2=Math.sin(cam.pitch)
        const pz=rz*cp2-ry*sp2,py=rz*sp2+ry*cp2
        if(pz<=0.1)continue
        const scx=W/2+(rx/pz)*W/(2*Math.tan(HALF_FOV))
        const scy=H/2-(py/pz)*W/(2*Math.tan(HALF_FOV))*(H/W)+cam.pitch*H*0.6
        if(scx<-50||scx>W+50)continue
        const sz=Math.max(3,Math.min(52,80/pz))
        const gl=ctx.createRadialGradient(scx,scy,0,scx,scy,sz*3)
        gl.addColorStop(0,'rgba(255,248,205,0.76)');gl.addColorStop(0.28,'rgba(255,218,130,0.28)');gl.addColorStop(1,'transparent')
        ctx.fillStyle=gl;ctx.fillRect(scx-sz*3,scy-sz*3,sz*6,sz*6)
        ctx.fillStyle=`rgba(255,248,210,${Math.max(0.16,0.76-pz*0.028)})`
        ctx.beginPath();ctx.ellipse(scx,scy,sz*0.44,sz*0.22,0,0,Math.PI*2);ctx.fill()
      }
    }

    // ── drawPaintings ─────────────────────────────────────────────────────────
    function drawPaintings(){
      const vis=[]
      paintings.forEach(p=>{
        const dist=Math.sqrt((cam.x-p.px)**2+(cam.z-p.pz)**2)
        if(dist>28)return
        if((cam.x-p.px)*p.nx+(cam.z-p.pz)*p.nz<0.05)return
        if(Math.abs(p.px)>HW+0.5&&Math.abs(cam.x)<=HW-0.1)return
        if(p.pz<-0.5&&cam.z>-1.0)return
        if([0,30,60,75].some(wz=>(cam.z<wz&&p.pz>wz+0.1)||(cam.z>wz&&p.pz<wz-0.1)))return

        const _tx=-p.nz,_tz=p.nx,_hw=p.pw/2
        const z0=p.pz-_hw,z1=p.pz+_hw
        const y0=EYE-p.ph/2,y1=EYE+p.ph/2
        function projP(fw){
          const h=_hw+fw,fy0=y0-fw,fy1=y1+fw
          const c=[pr(p.px-_tx*h,fy1,p.pz-_tz*h),pr(p.px+_tx*h,fy1,p.pz+_tz*h),pr(p.px+_tx*h,fy0,p.pz+_tz*h),pr(p.px-_tx*h,fy0,p.pz-_tz*h)]
          return c.every(v=>v)?c:null
        }
        const outer=projP(0)
        if(!outer)return
        const sxs=outer.map(c=>c.sx)
        if(Math.max(...sxs)<-30||Math.min(...sxs)>W+30)return
        const avgD=outer.reduce((s,c)=>s+c.d,0)/4
        const alpha=Math.max(0,Math.min(1,2.0-dist*0.075))
        if(alpha<0.04)return
        vis.push({p,outer,z0,z1,y0,y1,dist,avgD,alpha,projP})
      })
      vis.sort((a,b)=>b.dist-a.dist)

      nearestPainting=null;let minD=3.5
      vis.forEach(({p,outer,z0,z1,y0,y1,dist,alpha,projP})=>{
        const[tl,tr,br,bl]=outer
        if(dist<minD){minD=dist;nearestPainting=p;}
        const bv=Math.max(0.35,Math.min(1,1.18-dist*0.036))
        ctx.save();ctx.globalAlpha=alpha

        const FRAME=0.06
        const outerF=projP(FRAME)
        const innerF=projP(-FRAME*0.5)
        if(!outerF||!innerF){ctx.restore();return}

        poly(innerF,`rgb(${Math.round(228*bv)},${Math.round(214*bv)},${Math.round(182*bv)})`)

        if(innerF){
          const[itl,itr,ibr,ibl]=innerF
          const minX=Math.min(itl.sx,itr.sx,ibr.sx,ibl.sx),maxX=Math.max(itl.sx,itr.sx,ibr.sx,ibl.sx)
          const minY=Math.min(itl.sy,itr.sy,ibr.sy,ibl.sy),maxY=Math.max(itl.sy,itr.sy,ibr.sy,ibl.sy)
          const pw2=Math.max(1,maxX-minX),ph2=Math.max(1,maxY-minY)

          if(p.imgEl&&p.imgEl.complete&&p.imgEl.naturalWidth>0){
            drawImageInQuad(p.imgEl,innerF)
            ctx.save()
            ctx.beginPath();ctx.moveTo(itl.sx,itl.sy);ctx.lineTo(itr.sx,itr.sy);ctx.lineTo(ibr.sx,ibr.sy);ctx.lineTo(ibl.sx,ibl.sy);ctx.closePath();ctx.clip()
            const gl=ctx.createLinearGradient(minX,minY,maxX,maxY)
            gl.addColorStop(0,'rgba(255,255,255,0.22)');gl.addColorStop(0.3,'rgba(255,255,255,0.02)');gl.addColorStop(0.5,'transparent')
            ctx.fillStyle=gl;ctx.fillRect(minX,minY,pw2,ph2)
            if(collectedSet.has(p.id)){ctx.fillStyle='rgba(200,168,64,0.15)';ctx.fillRect(minX,minY,pw2,ph2)}
            ctx.restore()
            // Caption
            const capH2=Math.max(14,ph2*0.14)
            ctx.fillStyle='rgba(6,3,0,0.86)';ctx.fillRect(minX,maxY-capH2,pw2,capH2)
            ctx.textAlign='center'
            let szT=Math.min(11,pw2*0.08);ctx.font=`bold ${szT}px Inter,sans-serif`
            while(szT>5&&ctx.measureText(p.title||'').width>pw2*0.9){szT-=0.5;ctx.font=`bold ${szT}px Inter,sans-serif`}
            ctx.fillStyle=`rgba(255,238,145,${alpha})`;ctx.fillText(p.title||'',minX+pw2*0.5,maxY-capH2+szT+1)
            let szS=Math.min(8,pw2*0.06);ctx.font=`${szS}px Inter,sans-serif`
            const sub=p.sub||''
            while(szS>4&&ctx.measureText(sub).width>pw2*0.9){szS-=0.5;ctx.font=`${szS}px Inter,sans-serif`}
            ctx.fillStyle=`rgba(210,185,88,${alpha*0.88})`;ctx.fillText(sub,minX+pw2*0.5,maxY-capH2+szT+szS+2)
          } else {
            ctx.textAlign='center'
            const cx2=minX+pw2*0.5,cy2=minY+ph2*0.5
            const eSz=Math.min(ph2*0.26,pw2*0.5,42)
            ctx.font=`${eSz}px serif`;ctx.fillStyle=`rgba(50,28,2,${alpha})`
            ctx.fillText(p.emoji||'🎬',cx2,minY+ph2*0.38)
            let tSz=Math.min(ph2*0.13,pw2*0.14,16);ctx.font=`bold ${tSz}px Inter,sans-serif`
            while(tSz>5&&ctx.measureText(p.title||'').width>pw2*0.88){tSz-=0.5;ctx.font=`bold ${tSz}px Inter,sans-serif`}
            ctx.fillStyle=p.playerColor||`rgba(35,16,0,${alpha})`;ctx.fillText(p.title||'',cx2,minY+ph2*0.58)
            let sSz=Math.min(ph2*0.08,pw2*0.1,10);ctx.font=`${sSz}px Inter,sans-serif`
            ctx.fillStyle=`rgba(85,52,8,${alpha*0.9})`;ctx.fillText(p.sub||'',cx2,minY+ph2*0.72)
          }

          // Rank medal
          if(p.rankNum&&p.rankNum<=3&&outerF){
            const[otl]=outerF
            ctx.font=`${Math.max(9,13*bv)}px serif`;ctx.textAlign='left'
            ctx.fillText(['🥇','🥈','🥉'][p.rankNum-1],otl.sx+3,otl.sy+14)
          }
          // Nearest highlight
          if(p===nearestPainting&&innerF){
            const[itl2,itr2,ibr2,ibl2]=innerF
            ctx.save();ctx.shadowBlur=18;ctx.shadowColor='rgba(255,200,50,0.8)'
            ctx.strokeStyle='rgba(255,218,62,0.9)';ctx.lineWidth=2
            ctx.beginPath();ctx.moveTo(itl2.sx,itl2.sy);ctx.lineTo(itr2.sx,itr2.sy);ctx.lineTo(ibr2.sx,ibr2.sy);ctx.lineTo(ibl2.sx,ibl2.sy);ctx.closePath();ctx.stroke()
            ctx.restore()
          }
        }
        ctx.restore()
      })

      // Room name HUD
      const rooms=[
        {n:'GODS OF OLYMPUS',x0:-HW,x1:HW,z0:-20,z1:0},
        {n:'GRAND ENTRANCE',x0:-HW,x1:HW,z0:0,z1:6},
        {n:'GALLERY OF CHAMPIONS',x0:-HW,x1:HW,z0:6,z1:30},
        {n:'ARCADE RECORDS WING',x0:-HW-6,x1:-HW,z0:LW0,z1:LW1},
        {n:'PLAYERS HALL',x0:HW,x1:HW+6,z0:LW0,z1:LW1},
        {n:'THE INNER SANCTUM',x0:-HW,x1:HW,z0:30,z1:60},
        {n:'WING OF CONTROVERSY',x0:-HW-6,x1:-HW,z0:LW2,z1:LW3},
        {n:'HALL OF CHAMPIONS',x0:HW,x1:HW+6,z0:LW2,z1:LW3},
        {n:'VAULT OF LEGENDS',x0:-HW,x1:HW,z0:60,z1:75},
        {n:'THE GRAND FINALE',x0:-HW,x1:HW,z0:75,z1:80},
      ]
      const room=rooms.find(r=>cam.x>=r.x0&&cam.x<=r.x1&&cam.z>=r.z0&&cam.z<=r.z1)
      if(roomRef.current) roomRef.current.textContent=room?.n||''

      // Collected counter
      if(collectCountRef.current) collectCountRef.current.textContent=`✦ ${collectedSet.size} collected`

      // Nearest painting label
      if(nearestPainting){
        nearestRef.current = nearestPainting
        if(labelRef.current){
          const p=nearestPainting
          const isCollected=collectedSet.has(p.id)
          labelRef.current.style.display='block'
          labelRef.current.innerHTML=`<strong>${p.title||''}</strong><br><span style="color:#8a6a20;font-size:11px">${p.sub||''}</span><br><span style="color:#c8a040;font-size:11px">${isCollected?'✦ Collected':'Click to collect'}</span>`
        }
      } else {
        if(labelRef.current) labelRef.current.style.display='none'
        nearestRef.current=null
      }
    }

    function poly(pts,color){
      if(!pts)return
      ctx.fillStyle=color;ctx.beginPath()
      ctx.moveTo(pts[0].sx,pts[0].sy)
      pts.slice(1).forEach(p=>ctx.lineTo(p.sx,p.sy))
      ctx.closePath();ctx.fill()
    }

    function drawImageInQuad(img,pts){
      if(!pts||!img||!img.complete||!img.naturalWidth)return
      const[tl,tr,br,bl]=pts
      if([tl,tr,br,bl].some(p=>p.d<0.1))return
      const flip=tl.sx>tr.sx
      const iw=img.naturalWidth,ih=img.naturalHeight
      function drawTri(x0,y0,u0,v0,x1,y1,u1,v1,x2,y2,u2,v2){
        const det=(u1-u0)*(v2-v0)-(u2-u0)*(v1-v0)
        if(Math.abs(det)<1)return
        const a=((x1-x0)*(v2-v0)-(x2-x0)*(v1-v0))/det
        const b=((y1-y0)*(v2-v0)-(y2-y0)*(v1-v0))/det
        const c=((x2-x0)*(u1-u0)-(x1-x0)*(u2-u0))/det
        const d=((y2-y0)*(u1-u0)-(y1-y0)*(u2-u0))/det
        const e=x0-a*u0-c*v0,f=y0-b*u0-d*v0
        if(!isFinite(a)||!isFinite(b)||!isFinite(c)||!isFinite(d)||Math.abs(a)>200||Math.abs(d)>200)return
        ctx.save();ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.lineTo(x2,y2);ctx.closePath();ctx.clip()
        ctx.transform(a,b,c,d,e,f);ctx.drawImage(img,0,0);ctx.restore()
      }
      if(!flip){drawTri(tl.sx,tl.sy,0,0,tr.sx,tr.sy,iw,0,bl.sx,bl.sy,0,ih);drawTri(tr.sx,tr.sy,iw,0,br.sx,br.sy,iw,ih,bl.sx,bl.sy,0,ih)}
      else{drawTri(tr.sx,tr.sy,0,0,tl.sx,tl.sy,iw,0,br.sx,br.sy,0,ih);drawTri(tl.sx,tl.sy,iw,0,bl.sx,bl.sy,iw,ih,br.sx,br.sy,0,ih)}
    }

    // ── Game loop ─────────────────────────────────────────────────────────────
    const keys=keysRef.current
    function loop(){
      if(!running)return
      const S=0.08,R=0.04
      if(keys['ArrowLeft'])cam.yaw-=R;if(keys['ArrowRight'])cam.yaw+=R
      let mx=0,mz=0
      if(keys['ArrowUp']||keys['KeyW']||keys['w'])  {mx+=Math.sin(cam.yaw)*S;mz+=Math.cos(cam.yaw)*S}
      if(keys['ArrowDown']||keys['KeyS']||keys['s']){mx-=Math.sin(cam.yaw)*S;mz-=Math.cos(cam.yaw)*S}
      if(keys['KeyA']||keys['a']){mx-=Math.cos(cam.yaw)*S;mz+=Math.sin(cam.yaw)*S}
      if(keys['KeyD']||keys['d']){mx+=Math.cos(cam.yaw)*S;mz-=Math.sin(cam.yaw)*S}
      const joy=joyRef.current
      if(joy.on){const S2=0.07;mx+=(Math.sin(cam.yaw)*(-joy.dy)+Math.cos(cam.yaw)*joy.dx)*S2;mz+=(Math.cos(cam.yaw)*(-joy.dy)+Math.sin(cam.yaw)*joy.dx)*S2*(-1)}
      if(mx||mz){
        const nx=cam.x+mx,nz=cam.z+mz
        const inM=Math.abs(nx)<HW-0.3&&nz>-19.5&&nz<79.6
        const inL=nx>-HW-4.7&&nx<-HW+0.2&&((nz>LW0+0.3&&nz<LW1-0.3)||(nz>LW2+0.3&&nz<LW3-0.3))
        const inR=nx>HW-0.2&&nx<HW+4.7&&((nz>LW0+0.3&&nz<LW1-0.3)||(nz>LW2+0.3&&nz<LW3-0.3))
        if(inM||inL||inR){cam.x=nx;cam.z=nz}
      }
      drawScene();drawPaintings()
      // Vignette
      const vg=ctx.createRadialGradient(W/2,H/2,H*0.08,W/2,H/2,H*0.8)
      vg.addColorStop(0,'transparent');vg.addColorStop(1,'rgba(10,6,1,0.28)')
      ctx.fillStyle=vg;ctx.fillRect(0,0,W,H)
      rafRef.current=requestAnimationFrame(loop)
    }
    rafRef.current=requestAnimationFrame(loop)
    stateRef.current={cam,collectedSet}

    // Keyboard
    const onKey=(e)=>{ keysRef.current[e.code]=e.type==='keydown'; keysRef.current[e.key]=e.type==='keydown' }
    window.addEventListener('keydown',onKey);window.addEventListener('keyup',onKey)

    // Click to collect
    canvas.addEventListener('click',()=>{
      if(nearestRef.current&&!stateRef.current?.collectedSet.has(nearestRef.current.id)){
        stateRef.current.collectedSet.add(nearestRef.current.id)
        collectPoster(nearestRef.current.id)
        if(collectRef.current){
          collectRef.current.style.display='block'
          collectRef.current.textContent=`✦ ${nearestRef.current.title} collected!`
          setTimeout(()=>{ if(collectRef.current) collectRef.current.style.display='none' },2000)
        }
      }
    })

    // Touch look
    let lt=null
    canvas.addEventListener('touchstart',e=>{lt={x:e.touches[0].clientX,y:e.touches[0].clientY}},{passive:true})
    canvas.addEventListener('touchmove',e=>{
      if(!lt||e.touches.length!==1)return
      cam.yaw+=(e.touches[0].clientX-lt.x)*0.006
      lt={x:e.touches[0].clientX,y:e.touches[0].clientY}
    },{passive:true})
    canvas.addEventListener('touchend',()=>{lt=null})

    return ()=>{
      running=false
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('keydown',onKey)
      window.removeEventListener('keyup',onKey)
    }
  }, [])

  // Mobile joystick
  const joyBaseRef=useRef(null)
  const joyKnobRef=useRef(null)
  useEffect(()=>{
    const base=joyBaseRef.current; const knob=joyKnobRef.current
    if(!base||!knob)return
    let active=false,startX=0,startY=0
    const onStart=e=>{
      active=true;const t=e.touches[0]
      startX=t.clientX;startY=t.clientY
      joyRef.current.on=true
      e.preventDefault()
    }
    const onMove=e=>{
      if(!active)return
      const dx=e.touches[0].clientX-startX,dy=e.touches[0].clientY-startY
      const d=Math.min(36,Math.sqrt(dx*dx+dy*dy))
      const angle=Math.atan2(dy,dx)
      const cx=Math.cos(angle)*d,cy=Math.sin(angle)*d
      knob.style.transform=`translate(calc(-50% + ${cx}px), calc(-50% + ${cy}px))`
      joyRef.current={on:true,dx:cx/36,dy:cy/36}
      e.preventDefault()
    }
    const onEnd=()=>{
      active=false;joyRef.current={on:false,dx:0,dy:0}
      knob.style.transform='translate(-50%,-50%)'
    }
    base.addEventListener('touchstart',onStart,{passive:false})
    base.addEventListener('touchmove',onMove,{passive:false})
    base.addEventListener('touchend',onEnd)
    return()=>{ base.removeEventListener('touchstart',onStart); base.removeEventListener('touchmove',onMove); base.removeEventListener('touchend',onEnd) }
  },[])

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      <div className="relative flex-1">
        <canvas ref={canvasRef} className="block w-full h-full object-contain" />

        {/* Room name */}
        <div ref={roomRef} className="absolute top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gold/80 tracking-[0.25em] whitespace-nowrap pointer-events-none" />

        {/* Collected counter */}
        <div ref={collectCountRef} className="absolute top-3 right-3 text-[11px] text-gold/70 font-semibold pointer-events-none">✦ 0 collected</div>

        {/* Back button */}
        <a href="/vote" onClick={e=>{e.preventDefault();window.history.back()}}
          className="absolute top-3 left-3 text-xs text-gold/60 hover:text-gold transition-colors font-semibold">← Back</a>

        {/* Collect toast */}
        <div ref={collectRef} style={{display:'none'}} className="absolute top-12 left-1/2 -translate-x-1/2 bg-gold/90 text-black text-xs font-bold px-4 py-2 rounded-lg whitespace-nowrap pointer-events-none" />

        {/* Nearest painting info */}
        <div ref={labelRef} style={{display:'none'}} className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-black/80 border border-gold/20 rounded-xl px-5 py-3 text-center text-xs text-white pointer-events-none whitespace-nowrap" />

        {/* Controls hint */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] text-gold/40 tracking-widest whitespace-nowrap pointer-events-none">
          ARROWS/WASD MOVE · A/D STRAFE · CLICK POSTER TO COLLECT
        </div>

        {/* Mobile joystick */}
        <div ref={joyBaseRef} className="absolute bottom-12 left-6 w-20 h-20 rounded-full border-2 border-gold/20 bg-black/30 touch-none md:hidden">
          <div ref={joyKnobRef} className="absolute top-1/2 left-1/2 w-8 h-8 rounded-full bg-gold/40 border border-gold/60" style={{transform:'translate(-50%,-50%)'}} />
        </div>
      </div>
    </div>
  )
}
