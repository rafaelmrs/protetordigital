/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#00e676',
          'green-dim': '#00c853',
          cyan: '#00e5ff',
          red: '#ff1744',
          orange: '#ff6d00',
          yellow: '#ffd600',
        },
        dark: {
          bg:      '#07090d',
          bg2:     '#0c1018',
          surface: '#111620',
          surface2:'#171f2e',
          border:  '#1c2535',
          border2: '#243040',
        },
        light: {
          bg:      '#f0f4f8',
          bg2:     '#ffffff',
          surface: '#ffffff',
          surface2:'#f8fafc',
          border:  '#e2e8f0',
          border2: '#cbd5e1',
        },
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        sans:    ['Plus Jakarta Sans', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow':  'pulse 4s ease-in-out infinite',
        'slide-up':    'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)',
        'fade-in':     'fadeIn 0.5s ease-out',
        'scan':        'scan 3s linear infinite',
        'glow-pulse':  'glowPulse 2s ease-in-out infinite',
        'float':       'float 6s ease-in-out infinite',
      },
      keyframes: {
        slideUp:   { '0%': { transform: 'translateY(16px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        scan:      { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(100vh)' } },
        glowPulse: { '0%,100%': { opacity: '0.4' }, '50%': { opacity: '1' } },
        float:     { '0%,100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-8px)' } },
      },
    },
  },
  plugins: [],
};
