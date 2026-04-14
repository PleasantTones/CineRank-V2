import React, { useEffect, useRef } from 'react'

let triggerFn = null
export function spawnConfetti() { if (triggerFn) triggerFn() }

export default function Confetti() {
  const canvasRef = useRef(null)
  const particles = useRef([])
  const rafRef = useRef(null)

  useEffect(() => {
    triggerFn = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const W = canvas.width = window.innerWidth
      const H = canvas.height = window.innerHeight
      const colors = ['#C8A040','#F0C048','#4ADE80','#F87171','#60A5FA','#F0F0F0']
      for (let i = 0; i < 80; i++) {
        particles.current.push({
          x: W / 2 + (Math.random() - 0.5) * W * 0.4,
          y: H * 0.4,
          vx: (Math.random() - 0.5) * 8,
          vy: -(Math.random() * 6 + 4),
          color: colors[Math.floor(Math.random() * colors.length)],
          size: Math.random() * 6 + 3,
          rot: Math.random() * 360,
          rotV: (Math.random() - 0.5) * 8,
          life: 1,
        })
      }
      if (!rafRef.current) animate()
    }
    return () => { triggerFn = null }
  }, [])

  function animate() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    particles.current = particles.current.filter(p => p.life > 0)
    particles.current.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.25
      p.rot += p.rotV; p.life -= 0.018
      ctx.save()
      ctx.globalAlpha = p.life
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot * Math.PI / 180)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
      ctx.restore()
    })
    if (particles.current.length > 0) {
      rafRef.current = requestAnimationFrame(animate)
    } else {
      rafRef.current = null
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ width: '100vw', height: '100dvh' }}
    />
  )
}
