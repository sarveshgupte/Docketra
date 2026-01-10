/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          600: '#0F172A',
          500: '#334155',
        },
        surface: {
          base: '#F8FAFC',
          card: '#FFFFFF',
        },
        border: {
          subtle: '#E2E8F0',
          strong: '#CBD5E1',
        },
        text: {
          main: '#0F172A',
          body: '#475569',
          muted: '#94A3B8',
        },
        success: '#059669',
        warning: '#D97706',
        danger: '#DC2626',
        info: '#2563EB',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'xs': '12px',
        'sm': '14px',
        'base': '14px',
        'lg': '18px',
        'xl': '24px',
      },
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
        '2xl': '48px',
      },
      borderRadius: {
        'DEFAULT': '6px',
        'sm': '4px',
        'md': '6px',
        'lg': '8px',
        'xl': '12px',
      },
      minHeight: {
        'button': '36px',
        'input': '40px',
        'click-target': '44px',
      },
      minWidth: {
        'button': '80px',
        'click-target': '44px',
      },
    },
  },
  plugins: [],
}
