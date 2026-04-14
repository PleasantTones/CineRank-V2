import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { PLAYER_COLORS } from '../../lib/movies'
import { sbFetch } from '../../lib/supabase'

function timeAgo(ts) {
  const s = Math.round((Date.now() - new Date(ts)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`
  return `${Math.floor(s/86400)}d ago`
}

export default function FloatChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [unread, setUnread] = useState(0)
  const [online, setOnline] = useState([])
  const messagesRef = useRef(null)
  const lastTsRef = useRef(null)
  const { player } = useStore()

  const load = useCallback(async () => {
    try {
      const msgs = await sbFetch('/rest/v1/chat?select=id,player,message,created_at&order=created_at.desc&limit=60')
      if (!msgs) return
      const sorted = [...msgs].reverse()
      setMessages(sorted)

      // Online status (active in last 10 min)
      const recent = new Set(sorted.filter(m => Date.now() - new Date(m.created_at) < 600000).map(m => m.player))
      setOnline([...recent])

      // Unread count
      if (sorted.length > 0) {
        const newest = sorted[sorted.length - 1].created_at
        if (lastTsRef.current && newest > lastTsRef.current && !open) {
          const newCount = sorted.filter(m => m.created_at > lastTsRef.current).length
          setUnread(u => u + newCount)
        }
        lastTsRef.current = newest
      }
    } catch(e) {}
  }, [open])

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    if (open) {
      setUnread(0)
      load()
    }
  }, [open])

  useEffect(() => {
    if (open && messagesRef.current) {
      setTimeout(() => { if(messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight }, 50)
    }
  }, [messages, open])

  async function send(e) {
    e.preventDefault()
    if (!player || !input.trim()) return
    const msg = input.trim()
    setInput('')
    try {
      await sbFetch('/rest/v1/chat', { method: 'POST', body: JSON.stringify({ player, message: msg }) })
      load()
    } catch(e) {}
  }

  const othersOnline = online.filter(p => p !== player)

  return (
    <>
      {/* Float button */}
      <motion.button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-28 right-4 z-40 w-12 h-12 rounded-full bg-surface border border-border flex items-center justify-center shadow-lg hover:border-gold/40 transition-colors"
        whileTap={{ scale: 0.93 }}
        animate={othersOnline.length > 0 ? { boxShadow: ['0 0 0 0 rgba(200,160,64,0)', '0 0 0 6px rgba(200,160,64,0.15)', '0 0 0 0 rgba(200,160,64,0)'] } : {}}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        <span className="text-lg">💬</span>
        {unread > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-gold text-black text-[10px] font-black rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </div>
        )}
        {othersOnline.length > 0 && (
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-win rounded-full border-2 border-base" />
        )}
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16, originX: 1, originY: 1 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed bottom-40 right-4 z-40 w-72 bg-surface border border-border rounded-2xl overflow-hidden shadow-xl" style={{ maxHeight: "70dvh" }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <span className="text-sm font-bold text-ink-primary flex-1">Group Chat</span>
              <div className="flex gap-1">
                {online.slice(0, 5).map(p => (
                  <div key={p} className="w-2 h-2 rounded-full" style={{ background: PLAYER_COLORS[p] || '#888' }} title={p} />
                ))}
              </div>
              <button onClick={() => setOpen(false)} className="text-ink-muted hover:text-ink-primary text-sm ml-1">✕</button>
            </div>

            {/* Messages */}
            <div ref={messagesRef} className="h-56 overflow-y-auto overscroll-contain p-3 space-y-2 no-scrollbar">
              {messages.length === 0 ? (
                <div className="text-center text-ink-muted text-xs py-8">No messages yet. Say hi! 👋</div>
              ) : messages.map(m => (
                <div key={m.id} className={`flex flex-col ${m.player === player ? 'items-end' : 'items-start'}`}>
                  {m.player !== player && (
                    <span className="text-[9px] font-bold mb-0.5" style={{ color: PLAYER_COLORS[m.player] || '#888' }}>{m.player}</span>
                  )}
                  <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                    m.player === player
                      ? 'bg-gold/20 text-ink-primary rounded-br-sm'
                      : 'bg-raised text-ink-primary rounded-bl-sm'
                  }`}>
                    {m.message}
                  </div>
                  <span className="text-[9px] text-ink-muted mt-0.5">{timeAgo(m.created_at)}</span>
                </div>
              ))}
            </div>

            {/* Input */}
            <form onSubmit={send} className="flex gap-2 p-3 border-t border-border">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={player ? 'Say something...' : 'Select your name to chat'}
                disabled={!player}
                className="flex-1 bg-raised border border-border rounded-xl px-3 py-2 text-xs text-ink-primary placeholder-ink-muted focus:outline-none focus:border-gold disabled:opacity-40"
              />
              <button type="submit" disabled={!player || !input.trim()}
                className="px-3 py-2 bg-gold text-black font-bold rounded-xl text-xs disabled:opacity-40 active:scale-95 transition-transform">
                →
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
