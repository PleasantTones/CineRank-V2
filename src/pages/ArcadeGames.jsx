import React, { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { MOVIES } from '../lib/movies'

// ── Quick Draw ────────────────────────────────────────────────────────────────
export function QuickDraw({ onEnd }) {
  const [score, setScore] = useState(0)
  const [misses, setMisses] = useState(0)
  const [posters, setPosters] = useState([])
  const speedRef = useRef(900)
  const runningRef = useRef(true)
  const clickedRef = useRef(new Set())  // track clicked IDs so timeout never double-counts
  const pool = MOVIES.filter(m => m.img)

  function spawn() {
    if (!runningRef.current) return
    const m = pool[Math.floor(Math.random() * pool.length)]
    const id = Date.now() + Math.random()
    setPosters(prev => [...prev, { id, movie: m, x: 5 + Math.random() * 72, y: 10 + Math.random() * 65 }])
    setTimeout(() => {
      if (clickedRef.current.has(id)) {
        // Already clicked — don't count as miss, just clean up
        clickedRef.current.delete(id)
      } else {
        setPosters(prev => {
          const exists = prev.find(p => p.id === id)
          if (exists) {
            setMisses(m => { const nm = m+1; if (nm >= 3) runningRef.current = false; return nm })
          }
          return prev.filter(p => p.id !== id)
        })
      }
      if (runningRef.current) {
        speedRef.current = Math.max(320, speedRef.current - 35)
        setTimeout(spawn, Math.max(180, speedRef.current * 0.55))
      }
    }, speedRef.current)
  }

  useEffect(() => {
    const t = setTimeout(spawn, 600)
    return () => { runningRef.current = false; clearTimeout(t) }
  }, [])

  useEffect(() => {
    if (misses >= 3) setTimeout(() => onEnd(score), 400)
  }, [misses])

  return (
    <div className="absolute inset-0 flex flex-col p-3 gap-2">
      <div className="flex justify-between items-center px-1 flex-shrink-0">
        <span className="text-gold font-bold font-mono text-xl">{score}</span>
        <div className="flex gap-1">{[0,1,2].map(i => <span key={i} className="text-base">{i < misses ? '❌' : '⬜'}</span>)}</div>
      </div>
      <div className="relative bg-raised rounded-2xl overflow-hidden flex-1">
        <p className="absolute top-3 left-0 right-0 text-center text-[10px] text-ink-muted">Tap posters before they vanish</p>
        {posters.map(p => (
          <motion.button key={p.id} initial={{ scale:0,opacity:0 }} animate={{ scale:1,opacity:1 }}
            style={{ position:'absolute', left:`${p.x}%`, top:`${p.y}%` }}
            className="w-14 h-20 rounded-xl overflow-hidden border-2 border-gold/40 shadow-lg active:scale-95 transition-transform"
            onClick={() => {
              clickedRef.current.add(p.id)  // mark as clicked BEFORE state update
              setPosters(prev => prev.filter(pp => pp.id !== p.id))
              setScore(s => s + Math.max(10, Math.round(100 * speedRef.current / 900)))
              if (navigator.vibrate) navigator.vibrate(15)
            }}>
            <img src={p.movie.img} className="w-full h-full object-cover" />
          </motion.button>
        ))}
      </div>
    </div>
  )
}

// ── Memory Match ──────────────────────────────────────────────────────────────
export function MemoryMatch({ onEnd }) {
  const pool = MOVIES.filter(m => m.img).sort(() => Math.random() - 0.5).slice(0, 6)
  const [deck] = useState(() =>
    [...pool, ...pool].sort(() => Math.random() - 0.5).map((m, i) => ({ id: i, movie: m, flipped: false, matched: false }))
  )
  const [cards, setCards] = useState(deck)
  const [selected, setSelected] = useState([])
  const [timeLeft, setTimeLeft] = useState(30)
  const [score, setScore] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTimeLeft(tt => {
      if (tt <= 1) { clearInterval(t); setTimeout(() => onEnd(score), 400); return 0 }
      return tt - 1
    }), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (cards.every(c => c.matched)) setTimeout(() => onEnd(score + timeLeft * 15), 400)
  }, [cards])

  const flip = card => {
    if (card.flipped || card.matched || selected.length >= 2) return
    const newSel = [...selected, card]
    setCards(d => d.map(c => c.id === card.id ? { ...c, flipped: true } : c))
    if (newSel.length === 2) {
      setSelected([])
      if (newSel[0].movie.id === newSel[1].movie.id) {
        const pts = 100 + timeLeft * 4
        setScore(s => s + pts)
        setCards(d => d.map(c => c.movie.id === newSel[0].movie.id ? { ...c, matched: true } : c))
      } else {
        setTimeout(() => setCards(d => d.map(c => newSel.find(s => s.id === c.id) ? { ...c, flipped: false } : c)), 900)
      }
    } else { setSelected(newSel) }
  }

  return (
    <div className="absolute inset-0 flex flex-col gap-3 p-3">
      <div className="flex justify-between px-1 flex-shrink-0">
        <span className="text-gold font-bold font-mono">{score} pts</span>
        <span className={`font-bold font-mono ${timeLeft <= 10 ? 'text-lose' : 'text-ink-secondary'}`}>{timeLeft}s</span>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="grid grid-cols-4 gap-2 w-full" style={{maxHeight:'100%'}}>
          {cards.map(card => (
            <motion.button key={card.id} onClick={() => flip(card)} whileTap={{ scale: 0.94 }}
              className={`aspect-[2/3] rounded-xl overflow-hidden border-2 transition-all ${card.matched ? 'border-win opacity-60' : card.flipped ? 'border-gold' : 'border-border'}`}>
              {card.flipped || card.matched
                ? <img src={card.movie.img} className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-raised flex items-center justify-center text-2xl">🎬</div>}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Scramble ──────────────────────────────────────────────────────────────────
export function Scramble({ onEnd }) {
  const pool = MOVIES.filter(m => m.title.split(' ').length >= 2 && m.title.length > 5)
  const [round, setRound] = useState(0)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(15)
  const [input, setInput] = useState('')
  const [result, setResult] = useState(null)
  const movie = pool[round % pool.length]
  const [scrambled] = useState(() => movie.title.split('').sort(() => Math.random() - 0.5).join(''))

  useEffect(() => {
    setTimeLeft(15); setInput(''); setResult(null)
    const t = setInterval(() => setTimeLeft(tt => {
      if (tt <= 1) { clearInterval(t); nextRound(false); return 0 }
      return tt - 1
    }), 1000)
    return () => clearInterval(t)
  }, [round])

  function nextRound(correct) {
    setResult(correct ? 'correct' : 'wrong')
    if (correct) setScore(s => s + Math.round(100 + timeLeft * 8))
    setTimeout(() => {
      if (round >= 9) { onEnd(score + (correct ? Math.round(100 + timeLeft * 8) : 0)); return }
      setRound(r => r + 1)
    }, 900)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-ink-muted">Round {round+1}/10</span>
        <span className="text-gold font-bold font-mono">{score} pts</span>
        <span className={`font-bold font-mono ${timeLeft <= 5 ? 'text-lose' : 'text-ink-secondary'}`}>{timeLeft}s</span>
      </div>
      <div className="bg-raised rounded-2xl p-5 text-center space-y-3">
        <p className="text-[10px] text-ink-muted uppercase tracking-widest">Unscramble</p>
        <p className="text-2xl font-black tracking-widest text-ink-primary break-all">{scrambled.toUpperCase()}</p>
        {result && <p className={`text-sm font-bold ${result==='correct'?'text-win':'text-lose'}`}>
          {result==='correct' ? '✓ Correct!' : `✗ ${movie.title}`}
        </p>}
      </div>
      <form onSubmit={e => { e.preventDefault(); nextRound(input.trim().toLowerCase() === movie.title.toLowerCase()) }} className="flex gap-2">
        <input autoFocus value={input} onChange={e => setInput(e.target.value)} disabled={!!result}
          placeholder="Type the title..." className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-sm text-ink-primary placeholder-ink-muted focus:outline-none focus:border-gold" />
        <button type="submit" disabled={!!result} className="px-5 py-3 bg-gold text-black font-bold rounded-xl text-sm disabled:opacity-40">Go</button>
      </form>
    </div>
  )
}
