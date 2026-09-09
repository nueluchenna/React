/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Rubik', 'sans-serif'], // Makes it the default app font
        Rubik: ['Rubik', 'sans-serif'], // Allows you to keep using className="font-Rubik"
      },
    },
  },
  plugins: [],
}