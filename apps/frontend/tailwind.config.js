/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#254AA5',
          dark: '#1d3d8a',
        },
      },
    },
  },
  plugins: [],
};
