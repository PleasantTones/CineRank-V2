import React, { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { MOVIES, PLAYERS, PLAYER_COLORS, IMDB_URLS } from '../lib/movies'
import { makeMarbleTexture, makeGoldTexture, makeFrescoTexture } from '../lib/hallTextures'
import { getCachedPoster, fetchPoster } from '../lib/posters'

// ── Room definitions ──────────────────────────────────────────────────────────
const ROOMS = [
  { name: 'GODS OF OLYMPUS',      z0: -12, z1: 0   },
  { name: 'GRAND ENTRANCE',       z0: 0,   z1: 6   },
  { name: 'GALLERY OF CHAMPIONS', z0: 6,   z1: 30  },
  { name: 'ARCADE RECORDS WING',  z0: 6,   z1: 22, wing: 'left' },
  { name: 'PLAYERS HALL',         z0: 6,   z1: 22, wing: 'right'},
  { name: 'THE INNER SANCTUM',    z0: 30,  z1: 60  },
  { name: 'VAULT OF LEGENDS',     z0: 60,  z1: 75  },
  { name: 'THE GRAND FINALE',     z0: 75,  z1: 81  },
]

const HW = 3.5   // half-width of corridor
const HH = 4.2   // full height
const HL = 80    // hall length
const MOVE_SPEED = 0.06
const TURN_SPEED = 0.025

export default function Hall() {
  const navigate = useNavigate()
  const canvasRef    = useRef(null)
  const labelRef     = useRef(null)
  const roomRef      = useRef(null)
  const collectRef   = useRef(null)
  const countRef     = useRef(null)
  const keysRef      = useRef({})
  const joyBaseRef   = useRef(null)
  const joyKnobRef   = useRef(null)
  const joyStateRef  = useRef({ on: false, dx: 0, dy: 0 })
  const nearestRef   = useRef(null)
  const rafRef       = useRef(null)

  const { players, globalRatings, collected, collectPoster } = useStore()
  const collectedSet = useRef(new Set(collected))

  useEffect(() => { collectedSet.current = new Set(collected) }, [collected])

  const getGlobalRanked = useCallback(() =>
    [...MOVIES].filter(m => globalRatings[m.id]?.matches > 0)
      .sort((a, b) => globalRatings[b.id].elo - globalRatings[a.id].elo),
    [globalRatings])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
    const W = canvas.clientWidth, H = canvas.clientHeight
    renderer.setSize(W, H, false)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    // Disable shadows on mobile for performance
    const isMobile = window.innerWidth < 768
    renderer.shadowMap.enabled = !isMobile
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1

    // ── Scene ─────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0806)
    scene.fog = new THREE.Fog(0x0a0806, isMobile ? 14 : 18, isMobile ? 30 : 42)

    // ── Camera ────────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(72, W / H, 0.05, 60)
    camera.position.set(0, 1.7, -9)
    camera.rotation.order = 'YXZ'
    let yaw = 0, pitch = 0

    // ── Textures ──────────────────────────────────────────────────────────────
    const texLoader = new THREE.TextureLoader()
    function canvasTex(cnv, repeatX = 1, repeatY = 1) {
      const t = new THREE.CanvasTexture(cnv)
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(repeatX, repeatY)
      return t
    }

    const marbleTex  = canvasTex(makeMarbleTexture(512, 512), 4, 4)
    const marbleWall = canvasTex(makeMarbleTexture(512, 512, { baseColor: [228, 218, 195], veinCount: 4 }), 2, 1)
    const marbleFloor= canvasTex(makeMarbleTexture(512, 512, { baseColor: [215, 200, 170], veinColor: [170, 135, 70] }), 8, 40)
    const goldTex    = canvasTex(makeGoldTexture(256, 256), 1, 1)
    const frescoTex  = new THREE.CanvasTexture(makeFrescoTexture(1024, 512))

    // ── Materials ─────────────────────────────────────────────────────────────
    const mMarble = new THREE.MeshStandardMaterial({ map: marbleWall, roughness: 0.55, metalness: 0.05 })
    const mFloor  = new THREE.MeshStandardMaterial({ map: marbleFloor, roughness: 0.3, metalness: 0.12, envMapIntensity: 0.4 })
    const mCeiling= new THREE.MeshStandardMaterial({ map: marbleTex, roughness: 0.7, metalness: 0 })
    const mGold   = new THREE.MeshStandardMaterial({ map: goldTex, roughness: 0.25, metalness: 0.8 })
    const mGoldDark = new THREE.MeshStandardMaterial({ color: 0xA07820, roughness: 0.3, metalness: 0.9 })
    const mBlack  = new THREE.MeshStandardMaterial({ color: 0x050403, roughness: 0.9 })
    const mCrystal = new THREE.MeshStandardMaterial({ color: 0xEEF4FF, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.85 })

    // ── Geometry helpers ──────────────────────────────────────────────────────
    function box(w, h, d, mat, x, y, z, rx = 0, ry = 0) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
      m.position.set(x, y, z)
      m.rotation.set(rx, ry, 0)
      m.receiveShadow = true; m.castShadow = false
      scene.add(m); return m
    }
    function cyl(rt, rb, h, seg, mat, x, y, z) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat)
      m.position.set(x, y, z); m.receiveShadow = true
      scene.add(m); return m
    }

    // ── Main corridor ─────────────────────────────────────────────────────────
    const CZ = HL / 2 - 5   // center Z offset
    box(HW*2, 0.02, HL+4, mFloor,  0, 0,    CZ)    // floor
    box(HW*2, 0.02, HL+4, mCeiling, 0, HH, CZ)     // ceiling
    box(0.08, HH, HL+4, mMarble, -HW, HH/2, CZ)    // left wall
    box(0.08, HH, HL+4, mMarble,  HW, HH/2, CZ)    // right wall
    box(HW*2, HH, 0.08, mMarble, 0, HH/2, -10.5)   // back wall

    // End wall (grand finale)
    box(HW*2, HH, 0.08, mMarble, 0, HH/2, HL - 5)

    // Crown molding — gold strip along top of walls
    box(0.12, 0.18, HL+4, mGold, -HW + 0.06, HH - 0.09, CZ)
    box(0.12, 0.18, HL+4, mGold,  HW - 0.06, HH - 0.09, CZ)
    // Baseboard
    box(0.1, 0.14, HL+4, mGoldDark, -HW + 0.05, 0.07, CZ)
    box(0.1, 0.14, HL+4, mGoldDark,  HW - 0.05, 0.07, CZ)
    // Floor border strips
    box(HW*2, 0.015, 0.08, mGold, 0, 0.01, CZ - HL/2 - 1.9)
    box(0.08, 0.015, HL+4, mGold, -HW + 0.5, 0.01, CZ)
    box(0.08, 0.015, HL+4, mGold,  HW - 0.5, 0.01, CZ)

    // Ceiling fresco panels every 12 units
    for (let fz = -6; fz < HL - 4; fz += 12) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(HW * 1.4, 6), new THREE.MeshStandardMaterial({ map: frescoTex, roughness: 0.9 }))
      m.rotation.x = Math.PI / 2; m.position.set(0, HH - 0.01, fz); scene.add(m)
    }
    // Ceiling gold grid
    for (let fz = -8; fz < HL; fz += 6) {
      box(HW * 2, 0.05, 0.06, mGold, 0, HH - 0.025, fz)
    }
    box(0.06, 0.05, HL+4, mGold, -HW * 0.5, HH - 0.025, CZ)
    box(0.06, 0.05, HL+4, mGold,  HW * 0.5, HH - 0.025, CZ)

    // ── Columns (pilasters on walls) ──────────────────────────────────────────
    for (let z = 0; z < HL - 5; z += 8) {
      [-HW + 0.22, HW - 0.22].forEach(x => {
        // Column shaft
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, HH - 0.4, 12), mMarble)
        col.position.set(x, HH/2 - 0.2, z); scene.add(col)
        // Capital (top)
        cyl(0.28, 0.18, 0.2, 12, mGold, x, HH - 0.3, z)
        // Base
        cyl(0.26, 0.28, 0.15, 12, mGold, x, 0.075, z)
      })
    }

    // ── Chandeliers ───────────────────────────────────────────────────────────
    const chandelierPositions = []
    for (let z = 0; z < HL; z += 7) {
      chandelierPositions.push(z - 3)
      // Crystal body
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, isMobile ? 8 : 16, isMobile ? 8 : 12), mCrystal)
      body.position.set(0, HH - 0.38, z - 3); scene.add(body)
      // Gold ring
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 8, 24), mGold)
      ring.position.set(0, HH - 0.52, z - 3); ring.rotation.x = Math.PI/2; scene.add(ring)
      // Pendant drops
      for (let p = 0; p < 8; p++) {
        const angle = (p / 8) * Math.PI * 2
        const drop = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 6), mCrystal)
        drop.position.set(
          Math.cos(angle) * 0.26, HH - 0.66,
          (z - 3) + Math.sin(angle) * 0.26
        )
        drop.rotation.z = Math.PI; scene.add(drop)
      }
      // Hanging chain
      box(0.025, 0.6, 0.025, mGoldDark, 0, HH - 0.08, z - 3)
      // Point light
      const pl = new THREE.PointLight(0xFFF5D0, 1.8, 14, 1.5)
      pl.position.set(0, HH - 0.55, z - 3)
      pl.castShadow = !isMobile
      if (!isMobile) pl.shadow.mapSize.set(256, 256)
      scene.add(pl)
    }

    // ── Ambient + directional ─────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xFFF5E0, 0.55))
    const dir = new THREE.DirectionalLight(0xFFEED0, 0.4)
    dir.position.set(0, 8, -5); scene.add(dir)

    // ── Transverse archway walls ──────────────────────────────────────────────
    function archwall(zp) {
      // Left and right panels
      box((HW - 0.85) * 2, HH, 0.3, mMarble, -(HW + 0.85) / 2, HH/2, zp)
      box((HW - 0.85) * 2, HH, 0.3, mMarble,  (HW + 0.85) / 2, HH/2, zp)
      // Top arch lintel
      box(HW*2, HH - 2.8, 0.3, mMarble, 0, HH/2 + (HH-2.8)/2 - 0.15, zp)
      // Gold arch frame
      box(0.12, HH, 0.2, mGold, -0.85, HH/2, zp)
      box(0.12, HH, 0.2, mGold,  0.85, HH/2, zp)
      box(1.82, 0.12, 0.2, mGold, 0, 2.85, zp)
    }
    archwall(0); archwall(30); archwall(60); archwall(74)

    // ── Painting frames + posters ─────────────────────────────────────────────
    const paintings = []
    const ranked = getGlobalRanked()
    const allMovies = ranked.length > 0 ? ranked : [...MOVIES]

    function addPainting(movieId, side, z, scale = 1, playerLabel = null, playerColor = null) {
      const x = side < 0 ? -HW + 0.06 : HW - 0.06
      const pw = 1.05 * scale, ph = 1.58 * scale
      const y = HH / 2 + 0.1

      // Outer gold frame
      const frameGeo = new THREE.BoxGeometry(pw + 0.16, ph + 0.16, 0.08)
      const frame = new THREE.Mesh(frameGeo, mGold)
      frame.position.set(x + (side < 0 ? 0.04 : -0.04), y, z)
      frame.rotation.y = side < 0 ? Math.PI/2 : -Math.PI/2
      scene.add(frame)

      // Inner dark mat
      const mat2 = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.04, ph + 0.04, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x1a1408, roughness: 1 }))
      mat2.position.copy(frame.position)
      mat2.rotation.copy(frame.rotation)
      scene.add(mat2)

      // Canvas plane — placeholder until texture loads
      const canvasMat = new THREE.MeshStandardMaterial({
        color: playerColor ? new THREE.Color(playerColor).multiplyScalar(0.3) : 0x2a2010,
        roughness: 0.9, side: THREE.FrontSide
      })
      const painting = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), canvasMat)
      painting.position.set(
        x + (side < 0 ? 0.085 : -0.085),
        y, z
      )
      painting.rotation.y = side < 0 ? Math.PI/2 : -Math.PI/2
      scene.add(painting)

      // Spot light on painting
      const spot = new THREE.SpotLight(0xFFEED0, 1.2, 6, 0.35, 0.4, 1.5)
      spot.position.set(x + side * (-1.2), y + 1.2, z)
      spot.target = painting
      if (!isMobile) { scene.add(spot); scene.add(spot.target) }

      // Frame accent lights (gold glow strips)
      const glow = new THREE.PointLight(0xC8A040, 0.3, 2.5)
      glow.position.set(x + (side < 0 ? 0.1 : -0.1), y, z)
      scene.add(glow)

      const paintingObj = { painting, frame, movieId, x, y: painting.position.y, z, side, textureLoaded: false }
      paintings.push(paintingObj)

      // Load texture async
      const movie = MOVIES.find(m => m.id === movieId)
      if (movie) {
        const cached = getCachedPoster(movieId)
        const loadUrl = (url) => {
          if (!url) { canvasMat.map = new THREE.CanvasTexture(makeFallbackCanvas(movie.title, playerColor)); canvasMat.needsUpdate = true; return }
          const img = new Image(); img.crossOrigin = 'anonymous'
          img.onload = () => {
            const tex = new THREE.Texture(img)
            tex.colorSpace = THREE.SRGBColorSpace
            tex.needsUpdate = true
            canvasMat.map = tex; canvasMat.color.set(0xffffff); canvasMat.needsUpdate = true
            paintingObj.textureLoaded = true
          }
          img.onerror = () => {
            canvasMat.map = new THREE.CanvasTexture(makeFallbackCanvas(movie.title, playerColor))
            canvasMat.needsUpdate = true
          }
          img.src = url
        }
        if (cached) { loadUrl(cached) }
        else { fetchPoster(movieId).then(loadUrl) }
      }

      return paintingObj
    }

    function makeFallbackCanvas(title, color) {
      const c = document.createElement('canvas'); c.width = 300; c.height = 450
      const ctx = c.getContext('2d')
      const g = ctx.createLinearGradient(0, 0, 0, 450)
      g.addColorStop(0, color || '#2a1a08'); g.addColorStop(1, '#0e0a04')
      ctx.fillStyle = g; ctx.fillRect(0, 0, 300, 450)
      ctx.fillStyle = color || '#c8a040'; ctx.font = 'bold 22px Inter, sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const words = title.split(' ')
      const lines = []; let line = ''
      words.forEach(w => { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > 260) { lines.push(line); line = w } else line = t })
      lines.push(line)
      const lh = 28, startY = 225 - (lines.length - 1) * lh / 2
      lines.forEach((l, i) => ctx.fillText(l, 150, startY + i * lh))
      return c
    }

    // Place paintings
    const gallery = allMovies.slice(0, 16)
    gallery.forEach((m, i) => addPainting(m.id, i % 2 === 0 ? -1 : 1, 8 + i * 1.8))

    // Gods of Olympus (player cards)
    PLAYERS.forEach((p, i) => {
      const pd = players[p] || {}; const r = pd.ratings || {}
      const topM = [...MOVIES].filter(m => r[m.id]?.matches > 0).sort((a,b) => (r[b.id]?.elo||0)-(r[a.id]?.elo||0))[0]
      if (topM) addPainting(topM.id, i % 2 === 0 ? -1 : 1, -10 + i * 2.2, 0.9, p, PLAYER_COLORS[p])
    })

    // Inner Sanctum (controversial)
    const controversial = [...MOVIES].map(m => {
      const elos = PLAYERS.map(p => players[p]?.ratings?.[m.id]).filter(r => r?.matches > 0).map(r => r.elo)
      return { m, sp: elos.length >= 2 ? Math.max(...elos) - Math.min(...elos) : 0 }
    }).sort((a, b) => b.sp - a.sp).slice(0, 10)
    controversial.forEach(({ m }, i) => addPainting(m.id, i % 2 === 0 ? -1 : 1, 32 + i * 2.4, 1))

    // Vault of Legends
    allMovies.slice(0, 8).forEach((m, i) => addPainting(m.id, i % 2 === 0 ? -1 : 1, 61 + i * 1.8, 1))

    // Grand Finale — end wall, big portrait
    if (allMovies[0]) {
      const kingMovie = allMovies[0]
      const pw = 2.2, ph = 3.3
      const kingMat = new THREE.MeshStandardMaterial({ color: 0x2a1a08, roughness: 0.9 })
      const kingPainting = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), kingMat)
      kingPainting.position.set(0, HH / 2 + 0.3, HL - 5.06)
      scene.add(kingPainting)
      // Grand gold frame
      const gf = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.32, ph + 0.32, 0.12), mGold)
      gf.position.copy(kingPainting.position); gf.position.z += 0.06; scene.add(gf)
      const spot2 = new THREE.SpotLight(0xFFEED0, 3, 10, 0.4, 0.3, 1.2)
      spot2.position.set(0, HH - 0.3, HL - 9)
      spot2.target = kingPainting
      if (!isMobile) { scene.add(spot2); scene.add(spot2.target) }
      const cached = getCachedPoster(kingMovie.id)
      const loadKing = url => {
        if (!url) return
        const img = new Image(); img.crossOrigin = 'anonymous'
        img.onload = () => {
          const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true
          kingMat.map = t; kingMat.color.set(0xffffff); kingMat.needsUpdate = true
        }
        img.src = url
      }
      if (cached) loadKing(cached)
      else fetchPoster(kingMovie.id).then(loadKing)

      // "HALL OF FAME" text panel below
      const textCanvas = document.createElement('canvas'); textCanvas.width = 512; textCanvas.height = 128
      const tc = textCanvas.getContext('2d')
      tc.fillStyle = '#0a0800'; tc.fillRect(0, 0, 512, 128)
      tc.fillStyle = '#C8A040'; tc.font = 'bold 28px Inter, sans-serif'; tc.textAlign = 'center'
      tc.fillText('👑 #1 ALL-TIME', 256, 44)
      tc.font = '18px Inter, sans-serif'; tc.fillStyle = '#8a6a20'
      const titleStr = kingMovie.title.length > 30 ? kingMovie.title.slice(0, 29) + '…' : kingMovie.title
      tc.fillText(titleStr, 256, 80)
      const textMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(textCanvas), transparent: true })
      const textPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), textMat)
      textPlane.position.set(0, 1.1, HL - 5.05); scene.add(textPlane)
    }

    // ── Section title plaques ─────────────────────────────────────────────────
    function addPlaque(text, z) {
      const c = document.createElement('canvas'); c.width = 512; c.height = 96
      const ctx = c.getContext('2d')
      ctx.fillStyle = '#08060a'; ctx.fillRect(0, 0, 512, 96)
      ctx.strokeStyle = '#C8A040'; ctx.lineWidth = 2; ctx.strokeRect(3, 3, 506, 90)
      ctx.fillStyle = '#C8A040'; ctx.font = 'bold 22px Inter, sans-serif'; ctx.textAlign = 'center'
      ctx.fillText(text, 256, 54)
      const mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true })
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.34), mat)
      m.position.set(0, HH - 0.5, z); scene.add(m)
      // Gold backing
      const bk = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.42, 0.04), mGold)
      bk.position.set(0, HH - 0.5, z - 0.03); scene.add(bk)
    }
    addPlaque('GODS OF OLYMPUS', -5)
    addPlaque('GALLERY OF CHAMPIONS', 15)
    addPlaque('THE INNER SANCTUM', 42)
    addPlaque('VAULT OF LEGENDS', 68)
    addPlaque('THE GRAND FINALE', HL - 7)

    // ── Resize handler ────────────────────────────────────────────────────────
    function onResize() {
      const W2 = canvas.clientWidth, H2 = canvas.clientHeight
      renderer.setSize(W2, H2, false)
      camera.aspect = W2 / H2; camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    // ── Keyboard ──────────────────────────────────────────────────────────────
    const onKey = e => { keysRef.current[e.code] = e.type === 'keydown' }
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey)

    // ── Mouse look ────────────────────────────────────────────────────────────
    let dragging = false, lastMX = 0, lastMY = 0
    canvas.addEventListener('mousedown', e => { dragging = true; lastMX = e.clientX; lastMY = e.clientY })
    window.addEventListener('mouseup', () => dragging = false)
    window.addEventListener('mousemove', e => {
      if (!dragging) return
      yaw   -= (e.clientX - lastMX) * 0.004
      pitch -= (e.clientY - lastMY) * 0.003
      pitch = Math.max(-0.55, Math.min(0.55, pitch))
      lastMX = e.clientX; lastMY = e.clientY
    })

    // ── Touch look ────────────────────────────────────────────────────────────
    let lastTX = 0, lastTY = 0, touchActive = false
    canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 1) { touchActive = true; lastTX = e.touches[0].clientX; lastTY = e.touches[0].clientY }
    }, { passive: true })
    canvas.addEventListener('touchmove', e => {
      if (!touchActive || e.touches.length !== 1) return
      yaw   -= (e.touches[0].clientX - lastTX) * 0.005
      pitch -= (e.touches[0].clientY - lastTY) * 0.004
      pitch = Math.max(-0.55, Math.min(0.55, pitch))
      lastTX = e.touches[0].clientX; lastTY = e.touches[0].clientY
    }, { passive: true })
    canvas.addEventListener('touchend', () => { touchActive = false })

    // Click to collect
    canvas.addEventListener('click', () => {
      if (nearestRef.current && !collectedSet.current.has(nearestRef.current.movieId)) {
        collectedSet.current.add(nearestRef.current.movieId)
        collectPoster(nearestRef.current.movieId)
        if (collectRef.current) {
          const m = MOVIES.find(m => m.id === nearestRef.current.movieId)
          collectRef.current.textContent = `✦ ${m?.title} collected!`
          collectRef.current.style.display = 'block'
          setTimeout(() => { if (collectRef.current) collectRef.current.style.display = 'none' }, 2500)
        }
      }
    })

    // ── Joystick ──────────────────────────────────────────────────────────────
    const base = joyBaseRef.current, knob = joyKnobRef.current
    if (base && knob) {
      let jActive = false, jSX = 0, jSY = 0
      base.addEventListener('touchstart', e => {
        jActive = true; jSX = e.touches[0].clientX; jSY = e.touches[0].clientY
        joyStateRef.current.on = true; e.preventDefault()
      }, { passive: false })
      window.addEventListener('touchmove', e => {
        if (!jActive) return
        const dx = e.touches[0].clientX - jSX, dy = e.touches[0].clientY - jSY
        const d = Math.min(38, Math.sqrt(dx*dx+dy*dy)), a = Math.atan2(dy, dx)
        const cx = Math.cos(a)*d, cy = Math.sin(a)*d
        knob.style.transform = `translate(calc(-50% + ${cx}px), calc(-50% + ${cy}px))`
        joyStateRef.current = { on: true, dx: cx/38, dy: cy/38 }
      }, { passive: true })
      window.addEventListener('touchend', () => {
        jActive = false; joyStateRef.current = { on: false, dx: 0, dy: 0 }
        knob.style.transform = 'translate(-50%,-50%)'
      })
    }

    // ── Game loop ─────────────────────────────────────────────────────────────
    const camPos = camera.position
    let frameCount = 0

    function loop() {
      rafRef.current = requestAnimationFrame(loop)
      frameCount++

      const k = keysRef.current, j = joyStateRef.current
      // Turning
      if (k['ArrowLeft'])  yaw += TURN_SPEED
      if (k['ArrowRight']) yaw -= TURN_SPEED
      camera.rotation.y = yaw
      camera.rotation.x = pitch

      // Movement
      const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
      const right   = new THREE.Vector3( Math.cos(yaw), 0, -Math.sin(yaw))
      const move    = new THREE.Vector3()

      if (k['KeyW'] || k['ArrowUp'])   move.addScaledVector(forward,  MOVE_SPEED)
      if (k['KeyS'] || k['ArrowDown']) move.addScaledVector(forward, -MOVE_SPEED)
      if (k['KeyA']) move.addScaledVector(right, -MOVE_SPEED)
      if (k['KeyD']) move.addScaledVector(right,  MOVE_SPEED)
      if (j.on) {
        move.addScaledVector(forward, -j.dy * MOVE_SPEED * 1.2)
        move.addScaledVector(right,    j.dx * MOVE_SPEED * 1.2)
      }

      // Collision
      const nx = camPos.x + move.x, nz = camPos.z + move.z
      const inMain = Math.abs(nx) < HW - 0.25 && nz > -10.5 && nz < HL - 4.8
      if (inMain) { camPos.x = nx; camPos.z = nz }

      // Room name update (every 10 frames)
      if (frameCount % 10 === 0 && roomRef.current) {
        const cz = camPos.z
        const room = ROOMS.find(r => !r.wing && cz >= r.z0 && cz <= r.z1)
        roomRef.current.textContent = room?.name || ''
        if (countRef.current) countRef.current.textContent = `✦ ${collectedSet.current.size} collected`
      }

      // Find nearest painting (every 6 frames)
      if (frameCount % 6 === 0) {
        let nearest = null, minD = 2.8
        paintings.forEach(p => {
          const d = Math.sqrt((camPos.x - p.x)**2 + (camPos.z - p.z)**2)
          if (d < minD) { minD = d; nearest = p }
        })
        nearestRef.current = nearest
        if (labelRef.current) {
          if (nearest) {
            const movie = MOVIES.find(m => m.id === nearest.movieId)
            const isCollected = collectedSet.current.has(nearest.movieId)
            const gr = globalRatings[nearest.movieId]
            labelRef.current.style.display = 'block'
            labelRef.current.innerHTML = `<strong style="color:#F0F0F0">${movie?.title || ''}</strong><br><span style="color:#C8A040;font-size:11px">${gr?.elo ? `ELO ${gr.elo}` : ''}</span><br><span style="color:${isCollected ? '#4ADE80' : '#C8A040'};font-size:11px">${isCollected ? '✦ Collected' : 'Click to collect'}</span>`
            // Highlight the nearest painting
            paintings.forEach(p => {
              if (p === nearest) {
                p.frame.material = mGold
                // Pulse gold glow on frame — handled by spot light intensity
              } else {
                p.frame.material = mGold
              }
            })
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
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      scene.traverse(obj => { if (obj.geometry) obj.geometry.dispose(); if (obj.material) { if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose()); else obj.material.dispose() } })
      renderer.dispose()
    }
  }, [])

  return (
    <div className="fixed inset-0 bg-black flex flex-col" style={{ touchAction: 'none' }}>
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ cursor: 'crosshair' }}
      />

      {/* Room name */}
      <div ref={roomRef}
        className="absolute top-4 left-1/2 -translate-x-1/2 text-[11px] font-bold tracking-[0.25em] whitespace-nowrap pointer-events-none"
        style={{ color: 'rgba(200,168,64,0.85)', textShadow: '0 1px 8px rgba(0,0,0,0.8)' }}
      />

      {/* Collected count */}
      <div ref={countRef}
        className="absolute top-4 right-4 text-[11px] font-semibold pointer-events-none"
        style={{ color: 'rgba(200,168,64,0.7)', textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}
      >✦ 0 collected</div>

      {/* Back */}
      <button
        onClick={() => navigate('/vote')}
        className="absolute top-4 left-4 text-xs font-semibold transition-colors"
        style={{ color: 'rgba(200,168,64,0.65)' }}
        onMouseEnter={e => e.target.style.color = 'rgba(200,168,64,1)'}
        onMouseLeave={e => e.target.style.color = 'rgba(200,168,64,0.65)'}
      >← Exit Hall</button>

      {/* Collect toast */}
      <div ref={collectRef}
        className="absolute top-14 left-1/2 -translate-x-1/2 text-xs font-bold px-5 py-2.5 rounded-xl whitespace-nowrap pointer-events-none"
        style={{ display: 'none', background: 'rgba(200,168,64,0.92)', color: '#0a0600', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
      />

      {/* Nearest painting info */}
      <div ref={labelRef}
        className="absolute bottom-20 left-1/2 -translate-x-1/2 text-center text-xs pointer-events-none whitespace-nowrap rounded-xl px-5 py-3"
        style={{ display: 'none', background: 'rgba(8,6,2,0.88)', border: '1px solid rgba(200,168,64,0.2)', lineHeight: 1.7, backdropFilter: 'blur(8px)' }}
      />

      {/* Controls hint */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[9px] tracking-widest pointer-events-none whitespace-nowrap"
        style={{ color: 'rgba(200,168,64,0.35)' }}>
        DRAG TO LOOK · WASD/ARROWS TO MOVE · CLICK POSTER TO COLLECT
      </div>

      {/* Mobile joystick */}
      <div ref={joyBaseRef}
        className="absolute bottom-16 left-6 w-20 h-20 rounded-full md:hidden"
        style={{ background: 'rgba(200,168,64,0.08)', border: '2px solid rgba(200,168,64,0.2)', touchAction: 'none' }}>
        <div ref={joyKnobRef}
          className="absolute top-1/2 left-1/2 w-9 h-9 rounded-full"
          style={{ transform: 'translate(-50%,-50%)', background: 'rgba(200,168,64,0.35)', border: '1px solid rgba(200,168,64,0.6)' }}
        />
      </div>
    </div>
  )
}
