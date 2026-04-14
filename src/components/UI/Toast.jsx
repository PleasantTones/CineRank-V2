import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

let toastFn = null
export function showToast(msg, type = 'default') {
  if (toastFn) toastFn(msg, type)
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    toastFn = (msg, type) => {
      const id = Date.now()
      setToasts(t => [...t, { id, msg, type }])
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2800)
    }
    return () => { toastFn = null }
  }, [])

  return (
    <div className="fixed top-20 left-0 right-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg border max-w-xs text-center ${
              t.type === 'success' ? 'bg-win/15 border-win/30 text-win' :
              t.type === 'gold'    ? 'bg-gold/15 border-gold/30 text-gold' :
              'bg-surface border-border text-ink-primary'
            }`}
          >
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
