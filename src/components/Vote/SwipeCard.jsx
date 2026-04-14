import React, { useRef, useState } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'

const THRESHOLD = 90

export default function SwipeCard({ movie, onPick, onSkip, isTop, style = {} }) {
  const cardRef = useRef(null)
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 200], [-18, 18])
  const pickOpacity  = useTransform(x, [0, THRESHOLD],  [0, 1])
  const skipOpacity  = useTransform(x, [0, -THRESHOLD], [0, 1])
  const cardOpacity  = useTransform(x, [-250, 0, 250], [0.4, 1, 0.4])
  const [dragging, setDragging] = useState(false)

  async function handleDragEnd(_, info) {
    const vx = info.velocity.x
    const ox = info.offset.x
    if (ox > THRESHOLD || vx > 500) {
      await animate(x, 350, { duration: 0.25, ease: 'easeIn' })
      if (navigator.vibrate) navigator.vibrate(28)
      onPick()
    } else if (ox < -THRESHOLD || vx < -500) {
      await animate(x, -350, { duration: 0.25, ease: 'easeIn' })
      onSkip()
    } else {
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 })
    }
    setDragging(false)
  }

  return (
    <motion.div
      ref={cardRef}
      style={{ x, rotate, opacity: cardOpacity, ...style }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragStart={() => setDragging(true)}
      onDragEnd={handleDragEnd}
      className="absolute inset-0 cursor-grab active:cursor-grabbing select-none"
      whileTap={{ scale: 1.02 }}
    >
      {/* Poster — full bleed */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden bg-raised">
        <img
          src={movie.img}
          alt={movie.title}
          className="w-full h-full object-cover"
          draggable={false}
        />
        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
      </div>

      {/* PICK overlay */}
      <motion.div
        style={{ opacity: pickOpacity }}
        className="absolute inset-0 rounded-2xl flex items-center justify-center pointer-events-none"
      >
        <div className="border-4 border-win rounded-xl px-6 py-3 rotate-[-15deg]">
          <span className="text-win text-4xl font-black tracking-widest">PICK</span>
        </div>
      </motion.div>

      {/* SKIP overlay */}
      <motion.div
        style={{ opacity: skipOpacity }}
        className="absolute inset-0 rounded-2xl flex items-center justify-center pointer-events-none"
      >
        <div className="border-4 border-lose rounded-xl px-6 py-3 rotate-[15deg]">
          <span className="text-lose text-4xl font-black tracking-widest">SKIP</span>
        </div>
      </motion.div>

      {/* Title bar */}
      <div className="absolute inset-x-0 bottom-0 p-5 pointer-events-none">
        <h2 className="text-xl font-bold text-white leading-tight drop-shadow-lg line-clamp-2">
          {movie.title}
        </h2>
      </div>
    </motion.div>
  )
}
