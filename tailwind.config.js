/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/frontend/**/*.{js,jsx,ts,tsx}",
    "./src/frontend/index.html",
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          850: '#1a202e',
          950: '#0d1117',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
