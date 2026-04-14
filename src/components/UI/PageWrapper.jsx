import React from 'react'
import { motion } from 'framer-motion'

const variants = {
  initial:  { opacity: 0, y: 12 },
  animate:  { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.25, 0.1, 0.25, 1] } },
  exit:     { opacity: 0, y: -8, transition: { duration: 0.15, ease: 'easeIn' } },
}

export default function PageWrapper({ children, className = '' }) {
  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={`h-full overflow-y-auto overscroll-contain no-scrollbar ${className}`}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {children}
    </motion.div>
  )
}
