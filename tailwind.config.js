/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#00B19D',
          dark: '#009685',
          light: '#E6F7F4',
        },
        canvas: '#F5F7FA',
        ink: '#2C3E50',
        slatebody: '#5E6D82',
        line: '#E2E8F0',
        emeraldstatus: '#10B981',
        amberstatus: '#F59E0B',
        bluestatus: '#3B82F6',
        coral: '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(44,62,80,0.06), 0 4px 12px rgba(44,62,80,0.04)',
      },
    },
  },
  plugins: [],
}
