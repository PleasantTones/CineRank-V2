import React, { useRef, useEffect, useCallback } from 'react'

// Reusable canvas wrapper that auto-sizes and handles cleanup
export default function CanvasGame({ width = 600, height = 420, onSetup, onCleanup, className = '' }) {
  const canvasRef = useRef(null)
  const cleanupRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = width
    canvas.height = height
    const cleanup = onSetup(canvas)
    cleanupRef.current = cleanup
    return () => {
      if (cleanupRef.current) cleanupRef.current()
      if (onCleanup) onCleanup()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={`block w-full rounded-2xl bg-raised ${className}`}
      style={{ aspectRatio: `${width}/${height}`, imageRendering: 'auto' }}
    />
  )
}
