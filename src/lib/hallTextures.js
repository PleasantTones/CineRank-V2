// Procedural marble texture generator
export function makeMarbleTexture(w = 512, h = 512, opts = {}) {
  const {
    baseColor = [232, 222, 198],
    veinColor  = [200, 168, 100],
    veinCount  = 6,
    brightness = 1,
  } = opts

  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')

  // Base fill
  ctx.fillStyle = `rgb(${baseColor[0]},${baseColor[1]},${baseColor[2]})`
  ctx.fillRect(0, 0, w, h)

  // Noise overlay
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 18
    d[i]   = Math.max(0, Math.min(255, d[i]   + n))
    d[i+1] = Math.max(0, Math.min(255, d[i+1] + n))
    d[i+2] = Math.max(0, Math.min(255, d[i+2] + n))
  }
  ctx.putImageData(img, 0, 0)

  // Veins
  for (let v = 0; v < veinCount; v++) {
    const t = Math.random()
    const x0 = Math.random() * w, y0 = 0
    const x1 = Math.random() * w, y1 = h
    const cx = (x0 + x1) / 2 + (Math.random() - 0.5) * w * 0.6
    const cy = h * 0.5 + (Math.random() - 0.5) * h * 0.4
    const alpha = 0.12 + Math.random() * 0.15
    const lw = 0.5 + Math.random() * 1.5
    ctx.strokeStyle = `rgba(${veinColor[0]},${veinColor[1]},${veinColor[2]},${alpha})`
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.quadraticCurveTo(cx, cy, x1, y1)
    ctx.stroke()
    // Sub-veins
    for (let s = 0; s < 3; s++) {
      ctx.lineWidth = lw * 0.4
      ctx.strokeStyle = `rgba(${veinColor[0]},${veinColor[1]},${veinColor[2]},${alpha * 0.6})`
      const bx = x0 + (x1 - x0) * Math.random()
      const by = y0 + (y1 - y0) * Math.random()
      ctx.beginPath()
      ctx.moveTo(bx, by)
      ctx.quadraticCurveTo(bx + (Math.random()-0.5)*80, by + (Math.random()-0.5)*80,
                           bx + (Math.random()-0.5)*120, by + (Math.random()-0.5)*120)
      ctx.stroke()
    }
  }

  // Subtle brightness
  if (brightness !== 1) {
    ctx.fillStyle = `rgba(255,255,255,${brightness > 1 ? brightness - 1 : 0})`
    ctx.globalCompositeOperation = brightness > 1 ? 'screen' : 'multiply'
    ctx.fillRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'source-over'
  }

  return canvas
}

export function makeGoldTexture(w = 256, h = 256) {
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0,   '#F5D880')
  g.addColorStop(0.2, '#C8A040')
  g.addColorStop(0.4, '#E8C860')
  g.addColorStop(0.6, '#A07820')
  g.addColorStop(0.8, '#D4A840')
  g.addColorStop(1,   '#F0C040')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  // Subtle noise
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 12
    d[i]   = Math.max(0, Math.min(255, d[i]+n))
    d[i+1] = Math.max(0, Math.min(255, d[i+1]+n))
    d[i+2] = Math.max(0, Math.min(255, d[i+2]+n))
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

export function makeFrescoTexture(w = 1024, h = 512) {
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  // Sky gradient
  const g = ctx.createRadialGradient(w/2, h*0.4, 20, w/2, h/2, w*0.7)
  g.addColorStop(0,   '#B8D4E8')
  g.addColorStop(0.3, '#C8DDF0')
  g.addColorStop(0.7, '#D8C898')
  g.addColorStop(1,   '#C8B878')
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
  // Clouds
  for (let i = 0; i < 12; i++) {
    const cx = Math.random() * w, cy = Math.random() * h * 0.6
    const r = 30 + Math.random() * 80
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    cg.addColorStop(0,   'rgba(255,252,240,0.7)')
    cg.addColorStop(0.5, 'rgba(240,235,210,0.3)')
    cg.addColorStop(1,   'rgba(220,210,180,0)')
    ctx.fillStyle = cg
    ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.6, 0, 0, Math.PI*2); ctx.fill()
  }
  // Gold border frame
  ctx.strokeStyle = 'rgba(200,168,64,0.8)'; ctx.lineWidth = 8
  ctx.strokeRect(8, 8, w-16, h-16)
  ctx.strokeStyle = 'rgba(200,168,64,0.4)'; ctx.lineWidth = 2
  ctx.strokeRect(18, 18, w-36, h-36)
  return canvas
}
