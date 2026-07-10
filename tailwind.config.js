/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Warm paper / index-card catalog palette (light, low-light friendly)
        paper: {
          DEFAULT: '#f4ecd8', // aged cream page background
          card: '#fbf6e9',    // brighter card face
          deep: '#e9ddc2',    // recessed drawer / panel
        },
        ink: {
          DEFAULT: '#2b2620', // primary ink text
          soft: '#5c5346',    // secondary ink
          faint: '#8a7f6d',   // muted labels
        },
        rule: '#c9bfa6',      // ruled horizontal lines
        margin: '#c0402b',    // red margin line of an index card
        brass: {
          DEFAULT: '#a9852f', // brass/gold accent
          deep: '#7a5c2e',
          light: '#c9a75a',
        },
        felt: '#3f5c4a',      // muted green (correct)
        rust: '#a83a2a',      // muted red (wrong)
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        urdu: ['"Noto Nastaliq Urdu"', 'serif'],
      },
      boxShadow: {
        card: '0 10px 30px -8px rgba(43, 38, 32, 0.35), 0 2px 6px -2px rgba(43,38,32,0.2)',
        drawer: 'inset 0 2px 8px rgba(43,38,32,0.15)',
      },
    },
  },
  plugins: [],
}
