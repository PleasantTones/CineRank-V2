import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('react-router')) {
            return 'vendor-react'
          }
          if (id.includes('framer-motion')) return 'vendor-motion'
          if (id.includes('zustand') || id.includes('supabase')) return 'vendor-data'
          if (id.includes('src/lib/movies')) return 'movies-data'
        }
      }
    }
  }
})
