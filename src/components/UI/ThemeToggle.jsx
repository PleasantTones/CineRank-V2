import React, { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [light, setLight] = useState(() => localStorage.getItem('cinerank_theme') === 'light')

  useEffect(() => {
    if (light) {
      document.body.style.filter = 'invert(1) hue-rotate(180deg) brightness(0.88) sepia(0.12)'
    } else {
      document.body.style.filter = ''
    }
    localStorage.setItem('cinerank_theme', light ? 'light' : 'dark')
    // Counter-invert images and canvas
    const style = document.getElementById('theme-invert-style') || document.createElement('style')
    style.id = 'theme-invert-style'
    style.textContent = light
      ? 'img, canvas { filter: invert(1) hue-rotate(180deg) brightness(1.12) !important; }'
      : ''
    if (!document.getElementById('theme-invert-style')) document.head.appendChild(style)
  }, [light])

  return (
    <button
      onClick={() => setLight(l => !l)}
      className="w-8 h-8 rounded-full flex items-center justify-center text-ink-muted hover:text-ink-secondary transition-colors text-base"
      title={light ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {light ? '🌙' : '☀️'}
    </button>
  )
}
