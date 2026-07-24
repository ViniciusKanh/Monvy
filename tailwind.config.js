/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Syne', 'Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          emerald: '#10b981',
          emeraldDark: '#059669',
          navy: '#080d1f',
          navy2: '#0d1433',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)',
        soft: '0 4px 24px rgba(16,24,40,.06)',
      },
    },
  },
  plugins: [],
}
