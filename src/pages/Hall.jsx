import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { MOVIES, PLAYERS, PLAYER_COLORS, IMDB_URLS } from '../lib/movies'
import { makeMarbleTexture, makeGoldTexture, makeFrescoTexture } from '../lib/hallTextures'
import { getCachedPoster, fetchPoster } from '../lib/posters'

// ── Constants ────────────────────────────────────────────────────────────────
const HW   = 3.5   // half corridor width
const HH   = 4.0   // corridor height
const HL   = 80    // corridor length
const CAM_Y = 1.7
const MOVE  = 0.07
const TURN  = 0.028

const ROOM_LABELS = [
  { name: 'GODS OF OLYMPUS',      z0: -5,  z1: 8   },
  { name: 'GALLERY OF CHAMPIONS', z0: 8,   z1: 32  },
  { name: 'THE INNER SANCTUM',    z0: 32,  z1: 62  },
  { name: 'VAULT OF LEGENDS',     z0: 62,  z1: 76  },
  { name: 'THE GRAND FINALE',     z0: 76,  z1: 82  },
]

export default function Hall() {
  const navigate = useNavigate()
  const canvasRef   = useRef(null)
  const roomRef     = useRef(null)
  const collectRef  = useRef(null)
  const countRef    = useRef(null)
  const labelRef    = useRef(null)
  const keysRef     = useRef({})
  const joyRef      = useRef({ on: false, dx: 0, dy: 0 })
  const joyBaseRef  = useRef(null)
  const joyKnobRef  = useRef(null)
  const nearestRef  = useRef(null)
  const rafRef      = useRef(null)

  const { players, globalRatings, collected, collectPoster } = useStore()
  const collectedSet = useRef(new Set(collected))
  useEffect(() => { collectedSet.current = new Set(collected) }, [collected])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.shadowMap.enabled = false  // disabled for performance
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15

    // Size renderer properly
    function resize() {
      const W = window.innerWidth, H = window.innerHeight
      renderer.setSize(W, H)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
      camera.aspect = W / H
      camera.updateProjectionMatrix()
    }
    resize()

    // ── Scene ─────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0d0b08)
    scene.fog = new THREE.FogExp2(0x0d0b08, 0.028)

    // ── Camera ────────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 55)
    camera.position.set(0, CAM_Y, 2)  // start inside corridor
    camera.rotation.order = 'YXZ'
    let yaw = 0, pitch = 0  // yaw=0 means looking toward +Z in our setup

    // ── Textures ──────────────────────────────────────────────────────────────
    function canvasTex(cnv, rx = 1, ry = 1) {
      const t = new THREE.CanvasTexture(cnv)
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(rx, ry)
      return t
    }
    const tFloor   = canvasTex(makeMarbleTexture(512,512,{baseColor:[200,188,165],veinColor:[160,125,65],veinCount:8}), 6, 30)
    const tWall    = canvasTex(makeMarbleTexture(512,512,{baseColor:[228,216,192],veinColor:[185,148,80],veinCount:5}), 1, 1)
    const tCeiling = canvasTex(makeMarbleTexture(512,512,{baseColor:[218,208,185],veinCount:3}), 3, 12)
    const tGold    = canvasTex(makeGoldTexture(256,256), 1, 1)
    const tFresco  = new THREE.CanvasTexture(makeFrescoTexture(1024,512))

    // ── Materials ─────────────────────────────────────────────────────────────
    const mWall    = new THREE.MeshLambertMaterial({ map: tWall })
    const mFloor   = new THREE.MeshLambertMaterial({ map: tFloor })
    const mCeiling = new THREE.MeshLambertMaterial({ map: tCeiling })
    const mGold    = new THREE.MeshLambertMaterial({ map: tGold, color: 0xD4A840 })
    const mDark    = new THREE.MeshLambertMaterial({ color: 0x0a0804 })
    const mFresco  = new THREE.MeshLambertMaterial({ map: tFresco })

    function add(geo, mat, x, y, z, rx=0, ry=0, rz=0) {
      const m = new THREE.Mesh(geo, mat)
      m.position.set(x, y, z)
      m.rotation.set(rx, ry, rz)
      scene.add(m)
      return m
    }

    // ── Corridor surfaces (PlaneGeometry — no end-face issues) ────────────────
    const cz = HL / 2 - 5  // z center

    // Floor
    add(new THREE.PlaneGeometry(HW*2, HL+10), mFloor, 0, 0, cz, -Math.PI/2)
    // Ceiling
    add(new THREE.PlaneGeometry(HW*2, HL+10), mCeiling, 0, HH, cz, Math.PI/2)
    // Left wall (faces +X = inward)
    add(new THREE.PlaneGeometry(HL+10, HH), mWall, -HW, HH/2, cz, 0, Math.PI/2)
    // Right wall (faces -X = inward)
    add(new THREE.PlaneGeometry(HL+10, HH), mWall, HW, HH/2, cz, 0, -Math.PI/2)
    // Back wall (faces +Z = toward player start)
    add(new THREE.PlaneGeometry(HW*2, HH), mWall, 0, HH/2, -10, 0, 0)
    // End wall (faces -Z = toward player)
    add(new THREE.PlaneGeometry(HW*2, HH), mWall, 0, HH/2, HL-5, 0, Math.PI)

    // Ceiling fresco panels
    for (let z = 0; z < HL-5; z += 10) {
      add(new THREE.PlaneGeometry(HW*1.5, 7), mFresco, 0, HH-0.02, z, Math.PI/2, Math.PI)
    }

    // Crown molding strips (gold, along walls at ceiling)
    for (const x of [-HW, HW]) {
      const ry = x < 0 ? Math.PI/2 : -Math.PI/2
      add(new THREE.PlaneGeometry(HL+10, 0.22), mGold, x, HH - 0.11, cz, 0, ry)
      add(new THREE.PlaneGeometry(HL+10, 0.12), mGold, x, 0.06, cz, 0, ry)
    }
    // Floor border strips
    add(new THREE.PlaneGeometry(0.12, HL+10), mGold, -HW+0.4, 0.001, cz, -Math.PI/2)
    add(new THREE.PlaneGeometry(0.12, HL+10), mGold,  HW-0.4, 0.001, cz, -Math.PI/2)

    // ── Transverse arch walls ─────────────────────────────────────────────────
    function archWall(z) {
      const ry = Math.PI
      // Left panel
      add(new THREE.PlaneGeometry((HW - 0.9)*2, HH), mWall, -(HW+0.9)/2, HH/2, z, 0, ry)
      // Right panel
      add(new THREE.PlaneGeometry((HW - 0.9)*2, HH), mWall,  (HW+0.9)/2, HH/2, z, 0, ry)
      // Top
      add(new THREE.PlaneGeometry(HW*2, HH*0.35), mWall, 0, HH - HH*0.175 + 0.05, z, 0, ry)
      // Gold arch frame edges
      add(new THREE.PlaneGeometry(0.12, HH), mGold, -0.9, HH/2, z, 0, ry)
      add(new THREE.PlaneGeometry(0.12, HH), mGold,  0.9, HH/2, z, 0, ry)
      add(new THREE.PlaneGeometry(1.92, 0.1), mGold, 0, HH*0.65, z, 0, ry)
    }
    archWall(0); archWall(32); archWall(62); archWall(75)

    // ── Columns ───────────────────────────────────────────────────────────────
    const colGeo = new THREE.CylinderGeometry(0.16, 0.2, HH - 0.4, 10)
    const capGeo = new THREE.CylinderGeometry(0.25, 0.16, 0.18, 10)
    const baseGeo= new THREE.CylinderGeometry(0.22, 0.25, 0.12, 10)
    const mCol   = new THREE.MeshLambertMaterial({ map: tWall })

    for (let z = 4; z < HL - 6; z += 9) {
      for (const x of [-HW + 0.2, HW - 0.2]) {
        add(colGeo,  mCol,  x, HH/2 - 0.2, z)
        add(capGeo,  mGold, x, HH - 0.28, z)
        add(baseGeo, mGold, x, 0.06, z)
      }
    }

    // ── Chandeliers ───────────────────────────────────────────────────────────
    const chandGeo  = new THREE.SphereGeometry(0.16, 8, 6)
    const ringGeo   = new THREE.TorusGeometry(0.26, 0.03, 6, 16)
    const chandMat  = new THREE.MeshLambertMaterial({ color: 0xEEF4FF, transparent: true, opacity: 0.88 })

    const lights = []
    for (let z = 2; z < HL - 6; z += 9) {
      const cy = HH - 0.35
      add(chandGeo, chandMat, 0, cy, z)
      add(ringGeo, mGold, 0, cy - 0.15, z, Math.PI/2)
      // Chain
      add(new THREE.CylinderGeometry(0.015, 0.015, 0.55, 4), mGold, 0, HH - 0.06, z)

      const pl = new THREE.PointLight(0xFFEDD0, 1.6, 13, 1.8)
      pl.position.set(0, cy - 0.2, z)
      scene.add(pl)
      lights.push(pl)
    }

    // ── Lighting ──────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xFFF8E8, 0.7))
    const dir = new THREE.DirectionalLight(0xFFEED8, 0.45)
    dir.position.set(0, 10, 20)
    scene.add(dir)

    // ── Paintings ─────────────────────────────────────────────────────────────
    const paintings = []
    const ranked = [...MOVIES]
      .filter(m => globalRatings[m.id]?.matches > 0)
      .sort((a, b) => globalRatings[b.id].elo - globalRatings[a.id].elo)
    const allMovies = ranked.length ? ranked : [...MOVIES]

    const PW = 1.1, PH = 1.65

    function makeFallback(title, color) {
      const c = document.createElement('canvas'); c.width = 280; c.height = 420
      const ctx = c.getContext('2d')
      const g = ctx.createLinearGradient(0,0,0,420)
      g.addColorStop(0, color ? color+'44' : '#2a1a08')
      g.addColorStop(1, '#080604')
      ctx.fillStyle = g; ctx.fillRect(0,0,280,420)
      ctx.strokeStyle = '#C8A040'; ctx.lineWidth = 2
      ctx.strokeRect(4,4,272,412)
      ctx.fillStyle = '#F0C048'; ctx.font = 'bold 18px Inter,sans-serif'; ctx.textAlign = 'center'
      const words = title.split(' ')
      let line = '', lines = []
      words.forEach(w => { const t = line ? line+' '+w : w; if(ctx.measureText(t).width>240){lines.push(line);line=w}else line=t })
      lines.push(line)
      const startY = 210 - (lines.length-1)*22
      lines.forEach((l,i) => ctx.fillText(l, 140, startY+i*24))
      return c
    }

    function addPainting(movieId, side, z, scale=1, pcolor=null) {
      const px = side < 0 ? -HW + 0.04 : HW - 0.04
      const ry = side < 0 ? Math.PI/2 : -Math.PI/2
      const y  = HH/2 + 0.15
      const pw = PW*scale, ph = PH*scale

      // Gold frame
      const frame = add(new THREE.PlaneGeometry(pw+0.18, ph+0.18), mGold, px, y, z, 0, ry)

      // Dark mat
      const matMat = new THREE.MeshLambertMaterial({ color: 0x100c04 })
      add(new THREE.PlaneGeometry(pw+0.06, ph+0.06), matMat, px + (side<0?0.005:-0.005), y, z, 0, ry)

      // Canvas
      const canvasMat = new THREE.MeshLambertMaterial({
        color: pcolor ? new THREE.Color(pcolor).multiplyScalar(0.25) : 0x2a1808,
        side: THREE.FrontSide
      })
      const painting = add(new THREE.PlaneGeometry(pw, ph), canvasMat, px + (side<0?0.01:-0.01), y, z, 0, ry)

      // Point light on painting
      const pl = new THREE.PointLight(0xFFF5E0, 0.7, 3.5, 2)
      pl.position.set(px + side*(-0.9), y+0.8, z)
      scene.add(pl)

      const obj = { painting, frame, movieId, px, y, z, side, loaded: false }
      paintings.push(obj)

      // Load texture
      const movie = MOVIES.find(m => m.id === movieId)
      function applyTex(url) {
        if (!url) {
          canvasMat.map = new THREE.CanvasTexture(makeFallback(movie?.title||'', pcolor))
          canvasMat.color.set(0xffffff); canvasMat.needsUpdate = true; return
        }
        const img = new Image(); img.crossOrigin = 'anonymous'
        img.onload = () => {
          const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true
          canvasMat.map = t; canvasMat.color.set(0xffffff); canvasMat.needsUpdate = true
          obj.loaded = true
        }
        img.onerror = () => {
          canvasMat.map = new THREE.CanvasTexture(makeFallback(movie?.title||'', pcolor))
          canvasMat.color.set(0xffffff); canvasMat.needsUpdate = true
        }
        img.src = url
      }
      const cached = getCachedPoster(movieId)
      if (cached) applyTex(cached)
      else fetchPoster(movieId).then(applyTex)

      return obj
    }

    // Place paintings
    // Gods of Olympus — player cards
    PLAYERS.forEach((p, i) => {
      const pd = players[p]||{}; const r = pd.ratings||{}
      const top = [...MOVIES].filter(m=>r[m.id]?.matches>0).sort((a,b)=>(r[b.id]?.elo||0)-(r[a.id]?.elo||0))[0]
      if (top) addPainting(top.id, i%2===0?-1:1, -6 + i*2.4, 0.88, PLAYER_COLORS[p])
    })

    // Gallery of Champions
    allMovies.slice(0,14).forEach((m,i) => addPainting(m.id, i%2===0?-1:1, 10+i*1.8))

    // Inner Sanctum — controversial
    const controversial = [...MOVIES].map(m => {
      const elos = PLAYERS.map(p=>players[p]?.ratings?.[m.id]).filter(r=>r?.matches>0).map(r=>r.elo)
      return {m, sp: elos.length>=2 ? Math.max(...elos)-Math.min(...elos) : 0}
    }).sort((a,b)=>b.sp-a.sp).slice(0,10)
    controversial.forEach(({m},i) => addPainting(m.id, i%2===0?-1:1, 34+i*2.6))

    // Vault
    allMovies.slice(0,8).forEach((m,i) => addPainting(m.id, i%2===0?-1:1, 63+i*1.6))

    // Grand Finale — large end wall portrait
    if (allMovies[0]) {
      const king = allMovies[0]
      const kingMat = new THREE.MeshLambertMaterial({ color: 0x1a1004 })
      add(new THREE.PlaneGeometry(2.4+0.3, 3.6+0.3), mGold, 0, HH/2+0.3, HL-5.05, 0, Math.PI)
      const kp = add(new THREE.PlaneGeometry(2.4, 3.6), kingMat, 0, HH/2+0.3, HL-5.03, 0, Math.PI)

      const pl2 = new THREE.SpotLight(0xFFEED0, 2.5, 12, 0.45, 0.5)
      pl2.position.set(0, HH-0.4, HL-9)
      pl2.target = kp
      scene.add(pl2, pl2.target)

      const cached = getCachedPoster(king.id)
      function applyKing(url) {
        if (!url) return
        const img = new Image(); img.crossOrigin = 'anonymous'
        img.onload = () => {
          const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true
          kingMat.map = t; kingMat.color.set(0xffffff); kingMat.needsUpdate = true
        }
        img.src = url
      }
      if (cached) applyKing(cached)
      else fetchPoster(king.id).then(applyKing)

      // Crown label
      const lc = document.createElement('canvas'); lc.width=512; lc.height=96
      const lt = lc.getContext('2d')
      lt.fillStyle='#08060a'; lt.fillRect(0,0,512,96)
      lt.strokeStyle='#C8A040'; lt.lineWidth=2; lt.strokeRect(3,3,506,90)
      lt.fillStyle='#F0C048'; lt.font='bold 22px Inter,sans-serif'; lt.textAlign='center'
      lt.fillText('👑 #1 ALL-TIME · ' + (king.title.length>28 ? king.title.slice(0,27)+'…' : king.title), 256, 56)
      const lMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(lc), transparent: true })
      add(new THREE.PlaneGeometry(2.4, 0.42), lMat, 0, 0.8, HL-5.02, 0, Math.PI)
    }

    // Section plaques
    function plaque(text, z) {
      const c = document.createElement('canvas'); c.width=512; c.height=80
      const ctx = c.getContext('2d')
      ctx.fillStyle='#0e0b06'; ctx.fillRect(0,0,512,80)
      ctx.strokeStyle='#C8A040'; ctx.lineWidth=2; ctx.strokeRect(3,3,506,74)
      ctx.fillStyle='#C8A040'; ctx.font='bold 20px Inter,sans-serif'; ctx.textAlign='center'
      ctx.fillText(text,256,47)
      const mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite:false })
      add(new THREE.PlaneGeometry(1.9, 0.3), mat, 0, HH-0.42, z, 0, Math.PI)
      add(new THREE.PlaneGeometry(2.0, 0.38), mGold, 0, HH-0.42, z+0.01, 0, Math.PI)
    }
    plaque('GODS OF OLYMPUS', -2)
    plaque('GALLERY OF CHAMPIONS', 18)
    plaque('THE INNER SANCTUM', 44)
    plaque('VAULT OF LEGENDS', 69)

    // ── Input ─────────────────────────────────────────────────────────────────
    window.addEventListener('keydown', e => { keysRef.current[e.code] = true })
    window.addEventListener('keyup',   e => { keysRef.current[e.code] = false })

    // Mouse drag
    let mx = 0, my = 0, mdrag = false
    canvas.addEventListener('mousedown', e => { mdrag=true; mx=e.clientX; my=e.clientY })
    window.addEventListener('mouseup', () => { mdrag=false })
    window.addEventListener('mousemove', e => {
      if (!mdrag) return
      yaw   += (e.clientX-mx)*0.004; mx=e.clientX
      pitch -= (e.clientY-my)*0.003; my=e.clientY
      pitch = Math.max(-0.5, Math.min(0.5, pitch))
    })

    // Touch look
    let tx=0, ty=0, tdrag=false
    canvas.addEventListener('touchstart', e=>{if(e.touches.length===1){tdrag=true;tx=e.touches[0].clientX;ty=e.touches[0].clientY}},{passive:true})
    canvas.addEventListener('touchmove', e=>{
      if(!tdrag||e.touches.length!==1)return
      yaw   +=(e.touches[0].clientX-tx)*0.005; tx=e.touches[0].clientX
      pitch -=(e.touches[0].clientY-ty)*0.004; ty=e.touches[0].clientY
      pitch=Math.max(-0.5,Math.min(0.5,pitch))
    },{passive:true})
    canvas.addEventListener('touchend',()=>{tdrag=false})

    // Joystick
    const base=joyBaseRef.current, knob=joyKnobRef.current
    if(base&&knob){
      let ja=false,jx=0,jy=0
      base.addEventListener('touchstart',e=>{ja=true;jx=e.touches[0].clientX;jy=e.touches[0].clientY;joyRef.current.on=true;e.preventDefault()},{passive:false})
      window.addEventListener('touchmove',e=>{
        if(!ja)return
        const dx=e.touches[0].clientX-jx,dy=e.touches[0].clientY-jy
        const d=Math.min(38,Math.sqrt(dx*dx+dy*dy)),a=Math.atan2(dy,dx)
        const cx=Math.cos(a)*d,cy=Math.sin(a)*d
        knob.style.transform=`translate(calc(-50% + ${cx}px),calc(-50% + ${cy}px))`
        joyRef.current={on:true,dx:cx/38,dy:cy/38}
      },{passive:true})
      window.addEventListener('touchend',()=>{ja=false;joyRef.current={on:false,dx:0,dy:0};knob.style.transform='translate(-50%,-50%)'})
    }

    // Click collect
    canvas.addEventListener('click',()=>{
      const p=nearestRef.current
      if(p && !collectedSet.current.has(p.movieId)){
        collectedSet.current.add(p.movieId)
        collectPoster(p.movieId)
        const m=MOVIES.find(m=>m.id===p.movieId)
        if(collectRef.current){
          collectRef.current.textContent=`✦ ${m?.title} collected!`
          collectRef.current.style.display='block'
          setTimeout(()=>{if(collectRef.current)collectRef.current.style.display='none'},2500)
        }
      }
    })

    window.addEventListener('resize', resize)

    // ── Game loop ─────────────────────────────────────────────────────────────
    let frame = 0
    const pos = camera.position
    const fwd = new THREE.Vector3()
    const rgt = new THREE.Vector3()

    function loop() {
      rafRef.current = requestAnimationFrame(loop)
      frame++

      // Apply rotation
      camera.rotation.y = yaw
      camera.rotation.x = pitch

      // Compute movement vectors from yaw
      fwd.set(Math.sin(yaw), 0, Math.cos(yaw))
      rgt.set(Math.cos(yaw), 0, -Math.sin(yaw))

      const k = keysRef.current, j = joyRef.current

      if (k['ArrowLeft'])  yaw += TURN
      if (k['ArrowRight']) yaw -= TURN

      const dx =
        (k['KeyW']||k['ArrowUp']    ? 1 : 0) -
        (k['KeyS']||k['ArrowDown']  ? 1 : 0)
      const dz =
        (k['KeyD'] ? 1 : 0) - (k['KeyA'] ? 1 : 0)

      let nx = pos.x + fwd.x*dx*MOVE + rgt.x*dz*MOVE
      let nz = pos.z + fwd.z*dx*MOVE + rgt.z*dz*MOVE

      if (j.on) {
        nx += fwd.x * (-j.dy) * MOVE * 1.2 + rgt.x * j.dx * MOVE * 1.2
        nz += fwd.z * (-j.dy) * MOVE * 1.2 + rgt.z * j.dx * MOVE * 1.2
      }

      // Collision
      if (Math.abs(nx) < HW-0.3 && nz > -10 && nz < HL-5.5) {
        pos.x = nx; pos.z = nz
      }

      // Room label (every 12 frames)
      if (frame % 12 === 0) {
        const room = ROOM_LABELS.find(r=>pos.z>=r.z0 && pos.z<=r.z1)
        if (roomRef.current) roomRef.current.textContent = room?.name || ''
        if (countRef.current) countRef.current.textContent = `✦ ${collectedSet.current.size} collected`
      }

      // Nearest painting (every 8 frames)
      if (frame % 8 === 0) {
        let near=null, minD=3.0
        paintings.forEach(p => {
          const d = Math.sqrt((pos.x-p.px)**2+(pos.z-p.z)**2)
          if (d<minD){minD=d;near=p}
        })
        nearestRef.current = near
        if (labelRef.current) {
          if (near) {
            const m = MOVIES.find(m=>m.id===near.movieId)
            const gr = globalRatings[near.movieId]
            const col = collectedSet.current.has(near.movieId)
            labelRef.current.style.display = 'block'
            labelRef.current.innerHTML = `<strong>${m?.title||''}</strong><br><span style="color:#C8A040;font-size:11px">${gr?.elo?`ELO ${gr.elo} · `:''}</span><span style="color:${col?'#4ADE80':'#C8A040'};font-size:11px">${col?'✦ Collected':'Click to collect'}</span>`
          } else {
            labelRef.current.style.display = 'none'
          }
        }
      }

      renderer.render(scene, camera)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('keydown', e => { keysRef.current[e.code] = true })
      window.removeEventListener('keyup',   e => { keysRef.current[e.code] = false })
      window.removeEventListener('resize', resize)
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose()
        if (o.material) { Array.isArray(o.material) ? o.material.forEach(m=>m.dispose()) : o.material.dispose() }
      })
      renderer.dispose()
    }
  }, [])

  return (
    <div className="fixed inset-0 bg-black" style={{ zIndex: 100, touchAction: 'none' }}>
      <canvas ref={canvasRef} style={{ display:'block', width:'100%', height:'100%' }} />

      <div ref={roomRef} className="absolute top-4 left-1/2 -translate-x-1/2 text-[11px] font-bold tracking-[0.25em] pointer-events-none whitespace-nowrap"
        style={{ color:'rgba(200,168,64,0.9)', textShadow:'0 1px 8px rgba(0,0,0,0.9)' }} />

      <div ref={countRef} className="absolute top-4 right-4 text-[11px] font-semibold pointer-events-none"
        style={{ color:'rgba(200,168,64,0.7)' }}>✦ 0 collected</div>

      <button onClick={() => navigate('/vote')}
        className="absolute top-4 left-4 text-xs font-semibold"
        style={{ color:'rgba(200,168,64,0.7)' }}>← Exit Hall</button>

      <div ref={collectRef} className="absolute top-14 left-1/2 -translate-x-1/2 text-xs font-bold px-5 py-2.5 rounded-xl whitespace-nowrap pointer-events-none"
        style={{ display:'none', background:'rgba(200,168,64,0.92)', color:'#0a0600' }} />

      <div ref={labelRef} className="absolute bottom-20 left-1/2 -translate-x-1/2 text-center text-xs pointer-events-none whitespace-nowrap rounded-xl px-5 py-3"
        style={{ display:'none', background:'rgba(8,6,2,0.9)', border:'1px solid rgba(200,168,64,0.25)', lineHeight:1.7, backdropFilter:'blur(8px)' }} />

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[9px] tracking-widest pointer-events-none whitespace-nowrap"
        style={{ color:'rgba(200,168,64,0.3)' }}>
        DRAG TO LOOK · WASD / ARROWS TO MOVE · CLICK TO COLLECT
      </div>

      {/* Mobile joystick */}
      <div ref={joyBaseRef} className="absolute bottom-16 left-6 w-20 h-20 rounded-full md:hidden"
        style={{ background:'rgba(200,168,64,0.06)', border:'2px solid rgba(200,168,64,0.18)', touchAction:'none' }}>
        <div ref={joyKnobRef} className="absolute top-1/2 left-1/2 w-9 h-9 rounded-full"
          style={{ transform:'translate(-50%,-50%)', background:'rgba(200,168,64,0.3)', border:'1px solid rgba(200,168,64,0.5)' }} />
      </div>
    </div>
  )
}
