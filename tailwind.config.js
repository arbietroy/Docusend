/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#0A1628',
        navy2: '#111F3A',
        blue: '#2563EB',
        blue2: '#1D4ED8',
        green: '#10B981',
        slate: '#94A3B8',
      },
      fontFamily: { sans: ['Inter', 'sans-serif'] },
    },
  },
  plugins: [],
}
