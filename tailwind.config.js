/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4fb',
          100: '#d9e6f5',
          500: '#48688a',
          600: '#3a5470',
          700: '#2c3f54',
        },
      },
    },
  },
  plugins: [],
}
