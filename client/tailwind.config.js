/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: {
          light: '#FBF9F5',
          cream: '#F4F1EA',
          card: '#FFFFFF',
          border: '#E5E1D8',
          borderSubtle: '#EDEAE3',
        },
        ink: {
          primary: '#1A1B1E',
          secondary: '#4A4D53',
          muted: '#71757E',
          subtle: '#9A9EA6',
        },
        night: {
          bg: '#121315',
          surface: '#181A1D',
          card: '#1F2126',
          border: '#2A2D34',
          borderSubtle: '#22252A',
        },
        nightText: {
          primary: '#ECEAE4',
          secondary: '#B5B3AC',
          muted: '#85878C',
          subtle: '#63666C',
        },
        sage: {
          50: '#F4F6F4',
          100: '#E6EAE6',
          200: '#CCD6CD',
          300: '#B0BFB1',
          500: '#5F7363',
          600: '#4D5E50',
          700: '#3D4A3F',
          800: '#2E3830',
        },
        terracotta: {
          50: '#FAF2F2',
          100: '#F4E2E2',
          500: '#BC4749',
          600: '#A43739',
          700: '#8A292B',
        },
        stoneAccent: {
          light: '#EBE7DE',
          dark: '#2B2D31',
        }
      },
      fontFamily: {
        serif: ['Newsreader', 'Georgia', 'Merriweather', 'Cambria', 'serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      boxShadow: {
        editorial: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        editorialHover: '0 4px 12px rgba(0, 0, 0, 0.06)',
        editorialDark: '0 2px 6px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
}
