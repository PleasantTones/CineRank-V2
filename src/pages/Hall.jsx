import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { MOVIES, PLAYERS, PLAYER_COLORS } from '../lib/movies'
import { makeMarbleTexture, makeGoldTexture, makeFrescoTexture } from '../lib/hallTextures'
import { getCachedPoster, fetchPoster } from '../lib/posters'

const HW = 3.5, HH = 4.0, HL = 80, CAM_Y = 1.7, MOVE = 0.15, TURN = 0.036

const ROOMS = [
  { name: 'GODS OF OLYMPUS',      z0: -9, z1: 4  },
  { name: 'GALLERY OF CHAMPIONS', z0: 4,  z1: 32 },
  { name: 'THE INNER SANCTUM',    z0: 32, z1: 62 },
  { name: 'VAULT OF LEGENDS',     z0: 62, z1: 76 },
  { name: 'THE GRAND FINALE',     z0: 76, z1: 82 },
]

export default function Hall() {
  const navigate = useNavigate()
  const mountRef  = useRef(null) // div container, always rendered
  const roomRef   = useRef(null)
  const countRef  = useRef(null)
  const labelRef  = useRef(null)
  const collectRef = useRef(null)
  const joyBaseRef = useRef(null)
  const joyKnobRef = useRef(null)
  const keysRef   = useRef({})
  const joyRef    = useRef({ on: false, dx: 0, dy: 0 })
  const nearestRef = useRef(null)
  const rafRef    = useRef(null)
  const collectedSet = useRef(new Set())

  const { players, globalRatings, collected, collectPoster } = useStore()
  const hasData = Object.values(globalRatings).some(r => r.matches > 0)

  // Keep collected set in sync
  useEffect(() => { collectedSet.current = new Set(collected) }, [collected])

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    // Wait for real data before building
    let timer = null
    let cancelled = false

    function waitForData() {
      const gr = useStore.getState().globalRatings
      if (Object.values(gr).some(r => r.matches > 0)) {
        if (!cancelled) initScene(gr)
      } else {
        timer = setTimeout(waitForData, 200)
      }
    }
    waitForData()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      // Three.js cleanup
      const canvas = container.querySelector('canvas')
      if (canvas && canvas._threeRenderer) {
        canvas._threeRenderer.dispose()
      }
    }

    function initScene(gr) {
      if (cancelled) return

      // ── Canvas ──────────────────────────────────────────────────────────────
      const canvas = document.createElement('canvas')
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
      container.appendChild(canvas)

      // ── Renderer ────────────────────────────────────────────────────────────
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
      canvas._threeRenderer = renderer
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 0.95

      const isMobile = window.innerWidth < 768

      function resize() {
        const W = window.innerWidth, H = window.innerHeight
        renderer.setSize(W, H, false)
        renderer.setPixelRatio(1)
        if (camera) { camera.aspect = W / H; camera.updateProjectionMatrix() }
      }

      // ── Scene ───────────────────────────────────────────────────────────────
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x0d0b08)
      scene.fog = new THREE.FogExp2(0x0d0b08, isMobile ? 0.05 : 0.032)

      // ── Camera ──────────────────────────────────────────────────────────────
      let camera = null
      camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 55)
      camera.position.set(0, CAM_Y, 2)
      camera.rotation.order = 'YXZ'
      let yaw = 0, pitch = 0
      resize()
      window.addEventListener('resize', resize)

      // ── Textures ────────────────────────────────────────────────────────────
      const sz = isMobile ? 256 : 512
      function canvasTex(c, rx, ry) {
        const t = new THREE.CanvasTexture(c)
        t.wrapS = t.wrapT = THREE.RepeatWrapping
        t.repeat.set(rx, ry)
        return t
      }
      const tFloor   = canvasTex(makeMarbleTexture(sz, sz, { baseColor:[228,218,198], veinColor:[188,162,118], veinCount: isMobile?3:5 }), 6, 30)
      const tWall    = canvasTex(makeMarbleTexture(sz, sz, { baseColor:[228,218,198], veinColor:[175,148,100], veinCount: isMobile?2:4 }), 1, 1)
      const tCeiling = canvasTex(makeMarbleTexture(sz, sz, { baseColor:[205,208,212], veinColor:[175,178,182], veinCount:1 }), 3, 12)
      const tFresco  = new THREE.CanvasTexture(makeFrescoTexture(isMobile?512:1024, isMobile?256:512))

      // ── Materials ───────────────────────────────────────────────────────────
      const mWall    = new THREE.MeshStandardMaterial({ map: tWall,    roughness: 0.68, metalness: 0.06 })
      const mFloor   = new THREE.MeshStandardMaterial({ map: tFloor,   roughness: 0.55, metalness: 0.08 })
      const mCeiling = new THREE.MeshStandardMaterial({ map: tCeiling, roughness: 0.85, metalness: 0.0  })
      const mGold    = new THREE.MeshLambertMaterial({ color: 0x5C4A10 })
      const mFresco  = new THREE.MeshStandardMaterial({ map: tFresco,  roughness: 0.9,  metalness: 0.0  })
      const mBlack   = new THREE.MeshStandardMaterial({ color: 0x0a0806, roughness: 0.9, metalness: 0.0 })

      function mesh(geo, mat, x, y, z, rx=0, ry=0) {
        const m = new THREE.Mesh(geo, mat)
        m.position.set(x, y, z)
        m.rotation.set(rx, ry, 0)
        scene.add(m)
        return m
      }

      // ── Corridor ────────────────────────────────────────────────────────────
      const cz = HL / 2 - 5
      mesh(new THREE.PlaneGeometry(HW*2, HL+10), mFloor,   0, 0,  cz, -Math.PI/2)
      mesh(new THREE.PlaneGeometry(HW*2, HL+10), mCeiling, 0, HH, cz,  Math.PI/2)
      mesh(new THREE.PlaneGeometry(HL+10, HH),   mWall, -HW, HH/2, cz, 0,  Math.PI/2)
      mesh(new THREE.PlaneGeometry(HL+10, HH),   mWall,  HW, HH/2, cz, 0, -Math.PI/2)

      const dw = 1.1, dh = 2.8, pW = HW - dw
      // Back wall with doorway
      mesh(new THREE.PlaneGeometry(pW, HH), mWall, -(dw+pW/2), HH/2, -10, 0, 0)
      mesh(new THREE.PlaneGeometry(pW, HH), mWall,  (dw+pW/2), HH/2, -10, 0, 0)
      mesh(new THREE.PlaneGeometry(dw*2, HH-dh), mWall, 0, dh+(HH-dh)/2, -10, 0, 0)
      // End wall with doorway
      mesh(new THREE.PlaneGeometry(pW, HH), mWall, -(dw+pW/2), HH/2, HL-5, 0, Math.PI)
      mesh(new THREE.PlaneGeometry(pW, HH), mWall,  (dw+pW/2), HH/2, HL-5, 0, Math.PI)
      mesh(new THREE.PlaneGeometry(dw*2, HH-dh), mWall, 0, dh+(HH-dh)/2, HL-5, 0, Math.PI)

      if (!isMobile) {
        for (let z = 0; z < HL-5; z += 10)
          mesh(new THREE.PlaneGeometry(HW*1.5, 7), mFresco, 0, HH-0.02, z, Math.PI/2, Math.PI)
      }

      // Crown molding & baseboards
      for (const x of [-HW, HW]) {
        const ry = x < 0 ? Math.PI/2 : -Math.PI/2
        const xi = x < 0 ? x+0.02 : x-0.02
        mesh(new THREE.PlaneGeometry(HL+10, 0.24), mGold, xi, HH-0.12, cz, 0, ry)
        mesh(new THREE.PlaneGeometry(HL+10, 0.14), mGold, xi, 0.07, cz, 0, ry)
      }
      mesh(new THREE.PlaneGeometry(0.32, HL+10), mBlack, -HW+0.3, 0.12, cz, -Math.PI/2)
      mesh(new THREE.PlaneGeometry(0.32, HL+10), mBlack,  HW-0.3, 0.12, cz, -Math.PI/2)
      mesh(new THREE.PlaneGeometry(0.06, HL+10), mGold, -HW+0.22, 0.30, cz, -Math.PI/2)
      mesh(new THREE.PlaneGeometry(0.06, HL+10), mGold,  HW-0.22, 0.30, cz, -Math.PI/2)

      // Arch walls
      for (const az of [0, 32, 62, 75]) {
        for (const ry of [0, Math.PI]) {
          const aw = HW - 1.0
          mesh(new THREE.PlaneGeometry(aw, HH), mWall, -(HW-aw/2), HH/2, az, 0, ry)
          mesh(new THREE.PlaneGeometry(aw, HH), mWall,  (HW-aw/2), HH/2, az, 0, ry)
          mesh(new THREE.PlaneGeometry(2.0, HH-2.9), mWall, 0, 2.9+(HH-2.9)/2, az, 0, ry)
          mesh(new THREE.PlaneGeometry(0.1, HH), mGold, -1.0, HH/2, az, 0, ry)
          mesh(new THREE.PlaneGeometry(0.1, HH), mGold,  1.0, HH/2, az, 0, ry)
          mesh(new THREE.PlaneGeometry(2.1, 0.08), mGold, 0, 2.9, az, 0, ry)
        }
      }

      // Columns (desktop only, safe positions)
      if (!isMobile) {
        const colG = new THREE.CylinderGeometry(0.16, 0.2, HH-0.4, 10)
        const capG = new THREE.CylinderGeometry(0.25, 0.16, 0.18, 10)
        const basG = new THREE.CylinderGeometry(0.22, 0.25, 0.12, 10)
        const mCol = new THREE.MeshStandardMaterial({ map: tWall, roughness: 0.65, metalness: 0.06 })
        for (const z of [-8, 7, 77]) {
          for (const x of [-HW+0.2, HW-0.2]) {
            mesh(colG, mCol, x, HH/2-0.2, z)
            mesh(capG, mGold, x, HH-0.28, z)
            mesh(basG, mGold, x, 0.06, z)
          }
        }
      }

      // Chandeliers
      const chandG = isMobile
        ? new THREE.CylinderGeometry(0.12, 0.16, 0.28, 6)
        : new THREE.SphereGeometry(0.16, 8, 6)
      const ringG = new THREE.TorusGeometry(0.26, 0.03, 4, 12)
      const chandM = new THREE.MeshStandardMaterial({ color:0xEEF6FF, roughness:0.02, transparent:true, opacity:0.82 })
      for (let z = 4; z < HL-6; z += 20) {
        const cy = HH - 0.35
        mesh(chandG, chandM, 0, cy, z)
        mesh(ringG, mGold, 0, cy-0.15, z, Math.PI/2)
        if (!isMobile) mesh(new THREE.CylinderGeometry(0.015,0.015,0.55,4), mGold, 0, HH-0.06, z)
        const pl = new THREE.PointLight(0xFFE8A0, 2.8, 18, 1.5)
        pl.position.set(0, cy-0.2, z)
        scene.add(pl)
      }

      // Lighting
      scene.add(new THREE.AmbientLight(0xFFF8F0, 0.40))
      const dir = new THREE.DirectionalLight(0xFFF8F0, 0.45)
      dir.position.set(0, 8, 20)
      scene.add(dir)

      // ── Paintings ───────────────────────────────────────────────────────────
      const paintings = []
      const ranked = [...MOVIES]
        .filter(m => gr[m.id]?.matches > 0)
        .sort((a, b) => gr[b.id].elo - gr[a.id].elo)
      const allMovies = ranked.length ? ranked : [...MOVIES]

      function makeFallback(title, col) {
        const fc = document.createElement('canvas'); fc.width=280; fc.height=420
        const ctx = fc.getContext('2d')
        ctx.fillStyle = col ? col+'44' : '#2a1a08'; ctx.fillRect(0,0,280,420)
        ctx.strokeStyle = '#C8A040'; ctx.lineWidth = 2; ctx.strokeRect(4,4,272,412)
        ctx.fillStyle = '#F0C048'; ctx.font = 'bold 18px Inter,sans-serif'; ctx.textAlign = 'center'
        const words = title.split(' '); let line = '', lines = []
        words.forEach(w => { const t = line ? line+' '+w : w; ctx.measureText(t).width>240 ? (lines.push(line),line=w) : (line=t) })
        lines.push(line)
        lines.forEach((l, i) => ctx.fillText(l, 140, 210-(lines.length-1)*11+i*24))
        return fc
      }

      function addPainting(movieId, side, z, scale=1, pcol=null) {
        const px = side < 0 ? -HW+0.04 : HW-0.04
        const ry = side < 0 ? Math.PI/2 : -Math.PI/2
        const y = HH/2 + 0.15
        const pw = 1.1*scale, ph = 1.65*scale
        const movie = MOVIES.find(m => m.id === movieId)

        mesh(new THREE.PlaneGeometry(pw+0.18, ph+0.18), mGold, px, y, z, 0, ry)
        const matMat = new THREE.MeshStandardMaterial({ color:0x100c04, roughness:1 })
        mesh(new THREE.PlaneGeometry(pw+0.06, ph+0.06), matMat, px+(side<0?0.005:-0.005), y, z, 0, ry)
        const canMat = new THREE.MeshLambertMaterial({
          color: pcol ? new THREE.Color(pcol).multiplyScalar(0.25) : 0x2a1808,
          side: THREE.FrontSide
        })
        const p = mesh(new THREE.PlaneGeometry(pw, ph), canMat, px+(side<0?0.01:-0.01), y, z, 0, ry)
        const obj = { movieId, px, y, z }
        paintings.push(obj)

        function applyTex(url) {
          if (!url) { canMat.map = new THREE.CanvasTexture(makeFallback(movie?.title||'', pcol)); canMat.color.set(0xffffff); canMat.needsUpdate = true; return }
          const img = new Image()
          if (!url.startsWith('data:')) img.crossOrigin = 'anonymous'
          img.onload = () => { const t = new THREE.Texture(img); t.colorSpace=THREE.SRGBColorSpace; t.needsUpdate=true; canMat.map=t; canMat.color.set(0xffffff); canMat.needsUpdate=true }
          img.onerror = () => { canMat.map=new THREE.CanvasTexture(makeFallback(movie?.title||'',pcol)); canMat.color.set(0xffffff); canMat.needsUpdate=true }
          img.src = url
        }
        const cached = getCachedPoster(movieId)
        if (cached) applyTex(cached)
        else fetchPoster(movieId).then(applyTex)
      }

      // Place paintings — positions verified conflict-free with arch walls
      const curPlayers = useStore.getState().players
      PLAYERS.forEach((p, i) => {
        const r = curPlayers[p]?.ratings || {}
        const top = [...MOVIES].filter(m => r[m.id]?.matches > 0).sort((a,b)=>(r[b.id]?.elo||0)-(r[a.id]?.elo||0))[0]
        if (top) addPainting(top.id, i%2===0?-1:1, -9+i*1.75, 0.88, PLAYER_COLORS[p])
      })
      allMovies.slice(0, isMobile?8:14).forEach((m,i) => addPainting(m.id, i%2===0?-1:1, 4+i*1.8))
      const controversial = [...MOVIES].map(m => {
        const elos = PLAYERS.map(p=>curPlayers[p]?.ratings?.[m.id]).filter(r=>r?.matches>0).map(r=>r.elo)
        return { m, sp: elos.length>=2 ? Math.max(...elos)-Math.min(...elos) : 0 }
      }).sort((a,b)=>b.sp-a.sp)
      controversial.slice(0, isMobile?5:10).forEach(({m},i) => addPainting(m.id, i%2===0?-1:1, 36+i*2.6))
      allMovies.slice(0, isMobile?4:6).forEach((m,i) => addPainting(m.id, i%2===0?-1:1, 64+i*1.4))

      // Grand Finale
      if (allMovies[0]) {
        const king = allMovies[0]
        const kMat = new THREE.MeshLambertMaterial({ color: 0x1a1004 })
        mesh(new THREE.PlaneGeometry(2.7, 3.9), mGold, 0, HH/2+0.3, HL-5.05, 0, Math.PI)
        mesh(new THREE.PlaneGeometry(2.4, 3.6), kMat, 0, HH/2+0.3, HL-5.03, 0, Math.PI)
        scene.add(Object.assign(new THREE.PointLight(0xFFEED0, 3.0, 8, 1.6), { position: new THREE.Vector3(0, HH-0.6, HL-8) }))
        const fc2 = document.createElement('canvas'); fc2.width=400; fc2.height=600
        const fctx = fc2.getContext('2d')
        fctx.fillStyle='#1a1208'; fctx.fillRect(0,0,400,600)
        fctx.strokeStyle='#C8A040'; fctx.lineWidth=3; fctx.strokeRect(6,6,388,588)
        fctx.fillStyle='#C8A040'; fctx.font='bold 20px Inter,sans-serif'; fctx.textAlign='center'
        fctx.fillText('👑 #1 ALL-TIME', 200, 260)
        fctx.fillStyle='#FFFFFF'; fctx.font='bold 22px Inter,sans-serif'
        const kw = king.title.split(' '); let kl='', klines=[]
        kw.forEach(w => { const t=kl?kl+' '+w:w; fctx.measureText(t).width>350?(klines.push(kl),kl=w):(kl=t) }); klines.push(kl)
        klines.forEach((l,i) => fctx.fillText(l, 200, 310+i*28))
        kMat.map = new THREE.CanvasTexture(fc2); kMat.color.set(0xffffff); kMat.needsUpdate = true
        const cK = getCachedPoster(king.id)
        const applyK = url => { if(!url) return; const img=new Image(); if(!url.startsWith('data:')) img.crossOrigin='anonymous'; img.onload=()=>{const t=new THREE.Texture(img);t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;kMat.map=t;kMat.needsUpdate=true}; img.src=url }
        if (cK) applyK(cK); else fetchPoster(king.id).then(applyK)
      }

      // Plaques
      function plaque(text, z) {
        const pc = document.createElement('canvas'); pc.width=512; pc.height=80
        const ctx = pc.getContext('2d')
        ctx.fillStyle='#0e0b06'; ctx.fillRect(0,0,512,80)
        ctx.strokeStyle='#C8A040'; ctx.lineWidth=2; ctx.strokeRect(3,3,506,74)
        ctx.fillStyle='#C8A040'; ctx.font='bold 20px Inter,sans-serif'; ctx.textAlign='center'; ctx.fillText(text,256,47)
        const mat = new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(pc), transparent:true, depthWrite:false })
        mesh(new THREE.PlaneGeometry(1.9,0.3), mat, 0, HH-1.0, z, 0, Math.PI)
        mesh(new THREE.PlaneGeometry(2.0,0.38), mGold, 0, HH-1.0, z+0.01, 0, Math.PI)
      }
      plaque('GODS OF OLYMPUS', -2)
      plaque('GALLERY OF CHAMPIONS', 18)
      plaque('THE INNER SANCTUM', 44)
      plaque('VAULT OF LEGENDS', 69)

      // ── Controls ────────────────────────────────────────────────────────────
      window.addEventListener('keydown', e => { keysRef.current[e.code] = true })
      window.addEventListener('keyup',   e => { keysRef.current[e.code] = false })
      let mx=0,my=0,md=false
      canvas.addEventListener('mousedown', e=>{md=true;mx=e.clientX;my=e.clientY})
      window.addEventListener('mouseup',()=>{md=false})
      window.addEventListener('mousemove',e=>{if(!md)return;yaw+=(e.clientX-mx)*0.004;mx=e.clientX;pitch-=(e.clientY-my)*0.003;my=e.clientY;pitch=Math.max(-0.5,Math.min(0.5,pitch))})
      let tx=0,ty=0,td=false
      canvas.addEventListener('touchstart',e=>{if(e.touches.length===1){td=true;tx=e.touches[0].clientX;ty=e.touches[0].clientY}},{passive:true})
      canvas.addEventListener('touchmove',e=>{if(!td||e.touches.length!==1)return;yaw+=(e.touches[0].clientX-tx)*0.005;tx=e.touches[0].clientX;pitch-=(e.touches[0].clientY-ty)*0.004;ty=e.touches[0].clientY;pitch=Math.max(-0.5,Math.min(0.5,pitch))},{passive:true})
      canvas.addEventListener('touchend',()=>{td=false})
      canvas.addEventListener('click',()=>{const p=nearestRef.current;if(p&&!collectedSet.current.has(p.movieId)){collectedSet.current.add(p.movieId);collectPoster(p.movieId);const m=MOVIES.find(m=>m.id===p.movieId);if(collectRef.current){collectRef.current.textContent=`✦ ${m?.title} collected!`;collectRef.current.style.display='block';setTimeout(()=>{if(collectRef.current)collectRef.current.style.display='none'},2500)}}})

      const jb=joyBaseRef.current,jk=joyKnobRef.current
      if(jb&&jk){let ja=false,jx=0,jy=0;jb.addEventListener('touchstart',e=>{ja=true;jx=e.touches[0].clientX;jy=e.touches[0].clientY;joyRef.current.on=true;e.preventDefault()},{passive:false});window.addEventListener('touchmove',e=>{if(!ja)return;const dx=e.touches[0].clientX-jx,dy=e.touches[0].clientY-jy,d=Math.min(38,Math.sqrt(dx*dx+dy*dy)),a=Math.atan2(dy,dx),cx=Math.cos(a)*d,cy=Math.sin(a)*d;jk.style.transform=`translate(calc(-50% + ${cx}px),calc(-50% + ${cy}px))`;joyRef.current={on:true,dx:cx/38,dy:cy/38}},{passive:true});window.addEventListener('touchend',()=>{ja=false;joyRef.current={on:false,dx:0,dy:0};jk.style.transform='translate(-50%,-50%)'})}

      // ── Game loop ────────────────────────────────────────────────────────────
      let frame=0,lastTime=0
      const fps=isMobile?30:60, fpsDur=1000/fps
      const pos=camera.position, fwd=new THREE.Vector3(), rgt=new THREE.Vector3()

      function loop(ts) {
        rafRef.current = requestAnimationFrame(loop)
        if (ts-lastTime < fpsDur) return
        lastTime = ts; frame++
        camera.rotation.y = yaw + Math.PI
        camera.rotation.x = pitch
        fwd.set(Math.sin(yaw),0,Math.cos(yaw))
        rgt.set(Math.cos(yaw),0,-Math.sin(yaw))
        const k=keysRef.current,j=joyRef.current
        if(k['ArrowLeft']) yaw+=TURN
        if(k['ArrowRight']) yaw-=TURN
        const dx=(k['KeyW']||k['ArrowUp']?1:0)-(k['KeyS']||k['ArrowDown']?1:0)
        const dz=(k['KeyD']?1:0)-(k['KeyA']?1:0)
        let nx=pos.x+fwd.x*dx*MOVE+rgt.x*dz*MOVE
        let nz=pos.z+fwd.z*dx*MOVE+rgt.z*dz*MOVE
        if(j.on){nx+=fwd.x*(-j.dy)*MOVE*1.2+rgt.x*j.dx*MOVE*1.2;nz+=fwd.z*(-j.dy)*MOVE*1.2+rgt.z*j.dx*MOVE*1.2}
        if(Math.abs(nx)<HW-0.3&&nz>-10&&nz<HL-5.5){pos.x=nx;pos.z=nz}
        if(frame%12===0){const room=ROOMS.find(r=>pos.z>=r.z0&&pos.z<=r.z1);if(roomRef.current)roomRef.current.textContent=room?.name||'';if(countRef.current)countRef.current.textContent=`✦ ${collectedSet.current.size} collected`}
        if(frame%8===0){let near=null,minD=3.0;paintings.forEach(p=>{const d=Math.sqrt((pos.x-p.px)**2+(pos.z-p.z)**2);if(d<minD){minD=d;near=p}});nearestRef.current=near;if(labelRef.current){if(near){const m=MOVIES.find(m=>m.id===near.movieId);const g=gr[near.movieId];const col=collectedSet.current.has(near.movieId);labelRef.current.style.display='block';labelRef.current.innerHTML=`<strong>${m?.title||''}</strong><br><span style="color:#C8A040;font-size:11px">${g?.elo?`ELO ${g.elo} · `:''}</span><span style="color:${col?'#4ADE80':'#C8A040'};font-size:11px">${col?'✦ Collected':'Click to collect'}</span>`}else labelRef.current.style.display='none'}}
        renderer.render(scene, camera)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
  }, [])

  return (
    <div className="fixed inset-0 bg-black" style={{ zIndex:100, touchAction:'none' }}>
      {!hasData && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black">
          <div className="text-[11px] font-bold tracking-[0.25em] animate-pulse" style={{color:'rgba(200,168,64,0.7)'}}>LOADING HALL...</div>
        </div>
      )}
      <div ref={mountRef} className="absolute inset-0" />

      <div ref={roomRef} className="absolute top-4 left-1/2 -translate-x-1/2 text-[11px] font-bold tracking-[0.25em] pointer-events-none whitespace-nowrap" style={{color:'rgba(200,168,64,0.9)',textShadow:'0 1px 8px rgba(0,0,0,0.9)'}} />
      <div ref={countRef} className="absolute top-4 right-4 text-[11px] font-semibold pointer-events-none" style={{color:'rgba(200,168,64,0.7)'}}>✦ 0 collected</div>
      <button onClick={()=>navigate('/vote')} className="absolute top-4 left-4 text-xs font-semibold" style={{color:'rgba(200,168,64,0.7)'}}>← Exit Hall</button>
      <div ref={collectRef} className="absolute top-14 left-1/2 -translate-x-1/2 text-xs font-bold px-5 py-2.5 rounded-xl whitespace-nowrap pointer-events-none" style={{display:'none',background:'rgba(200,168,64,0.92)',color:'#0a0600'}} />
      <div ref={labelRef} className="absolute bottom-20 left-1/2 -translate-x-1/2 text-center text-xs pointer-events-none whitespace-nowrap rounded-xl px-5 py-3" style={{display:'none',background:'rgba(8,6,2,0.9)',border:'1px solid rgba(200,168,64,0.25)',lineHeight:1.7,backdropFilter:'blur(8px)'}} />
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[9px] tracking-widest pointer-events-none whitespace-nowrap" style={{color:'rgba(200,168,64,0.3)'}}>DRAG TO LOOK · WASD / ARROWS TO MOVE · CLICK TO COLLECT</div>
      <div ref={joyBaseRef} className="absolute bottom-16 left-6 w-20 h-20 rounded-full md:hidden" style={{background:'rgba(200,168,64,0.06)',border:'2px solid rgba(200,168,64,0.18)',touchAction:'none'}}>
        <div ref={joyKnobRef} className="absolute top-1/2 left-1/2 w-9 h-9 rounded-full" style={{transform:'translate(-50%,-50%)',background:'rgba(200,168,64,0.3)',border:'1px solid rgba(200,168,64,0.5)'}} />
      </div>
    </div>
  )
}
