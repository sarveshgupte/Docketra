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
      fontSize: {
        pageTitle: '28px',
        sectionTitle: '18px',
      },
      colors: {
        primary: '#1E3A8A',
        accent: '#4F46E5',
        success: '#059669',
        warning: '#D97706',
        error: '#E11D48',
        border: '#E5E7EB',
        textMain: '#111827',
        textMuted: '#6B7280',
        slate900: '#0F172A',
      },
    },
  },
};
