/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'nm-blue': {
          50: '#e6f0f9',
          100: '#cce1f3',
          200: '#99c3e7',
          300: '#66a5db',
          400: '#3387cf',
          500: '#005596', // Northwestern Mutual Primary Blue
          600: '#004477',
          700: '#003358',
          800: '#002239',
          900: '#00111a',
        },
        'nm-gold': {
          50: '#fef9e7',
          100: '#fdf3cf',
          200: '#fbe79f',
          300: '#f9db6f',
          400: '#f7cf3f',
          500: '#f5c30f',
          600: '#c49c0c',
          700: '#937509',
          800: '#624e06',
          900: '#312703',
        },
      },
      fontFamily: {
        'sans': ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      animation: {
        'fadeIn': 'fadeIn 0.3s ease-in-out',
        'slideIn': 'slideIn 0.2s ease-out',
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      transitionDuration: {
        '250': '250ms',
      },
    },
  },
  plugins: [],
}
