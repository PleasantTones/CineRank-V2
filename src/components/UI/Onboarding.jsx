import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const STEPS = [
  {
    icon: '🎬',
    title: 'Welcome to CineRank',
    body: 'You and your crew rank upcoming movies head-to-head. Every vote updates ELO ratings — like chess, but for cinema.',
  },
  {
    icon: '⚔️',
    title: 'How voting works',
    body: 'Two posters appear. Tap the one you\'d rather watch. Your personal rankings update instantly after every matchup.',
  },
  {
    icon: '🏛️',
    title: 'The Hall of Fame',
    body: 'Walk through a 3D museum showcasing your group\'s rankings. The Hall updates as you vote — your #1 all-time sits at the very end.',
  },
]

export default function Onboarding() {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!localStorage.getItem('cinerank_onboarded')) {
      const t = setTimeout(() => setVisible(true), 800)
      return () => clearTimeout(t)
    }
  }, [])

  function close() {
    localStorage.setItem('cinerank_onboarded', '1')
    setVisible(false)
  }

  const isLast = step === STEPS.length - 1

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-6" style={{ paddingTop: "max(24px, env(safe-area-inset-top))", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
          style={{ background: 'rgba(0,0,0,0.82)' }}
          onClick={e => e.target === e.currentTarget && close()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="w-full max-w-sm bg-surface border border-border rounded-3xl p-8 text-center"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-5xl mb-5">{STEPS[step].icon}</div>
                <h2 className="text-xl font-black text-ink-primary mb-3 leading-tight">
                  {STEPS[step].title}
                </h2>
                <p className="text-sm text-ink-secondary leading-relaxed mb-8">
                  {STEPS[step].body}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Dots */}
            <div className="flex justify-center gap-2 mb-6">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step ? 'w-6 bg-gold' : 'w-1.5 bg-border'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={() => isLast ? close() : setStep(s => s + 1)}
              className="w-full py-3.5 bg-gold text-black font-bold rounded-xl text-sm tracking-wide hover:bg-gold-bright transition-colors active:scale-98"
            >
              {isLast ? "Let's go 🎬" : 'Next →'}
            </button>

            {!isLast && (
              <button onClick={close} className="mt-3 text-xs text-ink-muted hover:text-ink-secondary transition-colors">
                Skip intro
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
