/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      colors: {
        base:    '#09080A',
        surface: '#111113',
        raised:  '#18181B',
        border:  '#2A2A2E',
        gold: {
          dim:     '#6A5A20',
          DEFAULT: '#C8A040',
          bright:  '#F0C048',
        },
        ink: {
          primary:   '#F0F0F0',
          secondary: '#A0A0A0',
          muted:     '#505050',
        },
        win:  '#4ADE80',
        lose: '#F87171',
      },
      boxShadow: {
        'gold-sm': '0 0 12px rgba(200,160,64,0.12)',
        'gold-md': '0 0 32px rgba(200,160,64,0.18)',
        'card':    '0 1px 0 rgba(255,255,255,0.04), 0 4px 16px rgba(0,0,0,0.5)',
      },
      animation: {
        'fade-up':  'fadeUp 0.28s ease both',
        'fade-in':  'fadeIn 0.2s ease both',
        'slide-up': 'slideUp 0.32s cubic-bezier(0.34,1.56,0.64,1) both',
        'pop':      'pop 0.22s cubic-bezier(0.34,1.56,0.64,1) both',
      },
      keyframes: {
        fadeUp:  { from: { opacity:0, transform:'translateY(10px)' }, to: { opacity:1, transform:'none' } },
        fadeIn:  { from: { opacity:0 }, to: { opacity:1 } },
        slideUp: { from: { opacity:0, transform:'translateY(20px) scale(0.97)' }, to: { opacity:1, transform:'none' } },
        pop:     { from: { opacity:0, transform:'scale(0.9)' }, to: { opacity:1, transform:'scale(1)' } },
      },
    },
  },
  plugins: [],
}
