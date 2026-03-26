/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      spacing: {
        section: '4rem',
      },
      maxWidth: {
        container: '72rem',
      },
      colors: {
        primary: '#2563eb',
      },
    },
  },
};
