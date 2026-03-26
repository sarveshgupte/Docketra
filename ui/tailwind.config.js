/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      spacing: {
        section: '4rem',
        'container-x': '1.5rem',
      },
      maxWidth: {
        container: '72rem',
        content: '48rem',
        form: '32rem',
      },
      fontSize: {
        'page-title': ['1.875rem', { lineHeight: '2.25rem', fontWeight: '600' }],
        'section-title': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],
        body: ['0.875rem', { lineHeight: '1.5rem' }],
        'body-lg': ['1rem', { lineHeight: '1.75rem' }],
        meta: ['0.75rem', { lineHeight: '1rem' }],
      },
      colors: {
        primary: {
          DEFAULT: '#2563eb',
          hover: '#1d4ed8',
        },
        text: {
          primary: '#0f172a',
          secondary: '#475569',
          muted: '#94a3b8',
        },
        border: '#e2e8f0',
        surface: '#f8fafc',
      },
    },
  },
};
