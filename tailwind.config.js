/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brandBlue: "#0f6e88",
        brandLight: "#edf8fb",
        brandInk: "#0b1f2a",
        brandNight: "#08151d",
        brandSun: "#f59e0b"
      },
      fontFamily: {
        sans: ['Manrope', 'Segoe UI', 'sans-serif'],
        display: ['Space Grotesk', 'Manrope', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
