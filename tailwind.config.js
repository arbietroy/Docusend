/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Brand colours. Don't redefine `blue`, `green` or `slate` here: a single
      // value would replace Tailwind's whole scale and break classes like bg-blue-600.
      colors: {
        navy: '#0A1628',
        navy2: '#111F3A',
      },
      // Extra steps for subtle borders/fills used across the UI (e.g. border-white/8)
      opacity: { 2: '0.02', 3: '0.03', 4: '0.04', 6: '0.06', 8: '0.08', 9: '0.09', 12: '0.12' },
      fontFamily: { sans: ['Inter', 'sans-serif'] },
    },
  },
  plugins: [],
}
