export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./views/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    borderRadius: {
      none: '0px',
      xs: '1px',
      sm: '2px',
      DEFAULT: '2px',
      md: '4px',
      lg: '6px',
      xl: '8px',
      full: '9999px',
    },
    extend: {
      spacing: {
        section: '2rem',
        sectionLegacy: '4rem',
        dense: '0.25rem',
      },
      maxWidth: {
        container: '72rem',
      },
      fontSize: {
        pageTitle: '28px',
        sectionTitle: '18px',
        '2xs': ['10px', { lineHeight: '13px' }],
        xs: ['11px', { lineHeight: '15px' }],
        sm: ['12px', { lineHeight: '16px' }],
        base: ['13px', { lineHeight: '18px' }],
        md: ['14px', { lineHeight: '20px' }],
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        dropdown: '0 4px 12px 0 rgba(15, 23, 42, 0.06), 0 1px 2px 0 rgba(15, 23, 42, 0.04)',
        modal: '0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.06)',
      },
      colors: {
        primary: '#0f172a',
        accent: '#2563eb',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        border: '#e2e8f0',
        textMain: '#0f172a',
        textMuted: '#64748b',
        slate900: '#0f172a',
        canvas: '#ffffff',
        surface: {
          DEFAULT: '#ffffff',
          subtle: '#f8fafc',
          muted: '#f1f5f9',
        },
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.divider-subtle': {
          'border-top': '1px solid rgba(226, 232, 240, 0.7)',
        },
        '.divider-subtle-b': {
          'border-bottom': '1px solid rgba(226, 232, 240, 0.7)',
        },
      });
    },
  ],
};
