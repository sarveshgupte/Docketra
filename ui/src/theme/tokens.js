export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const spacingClasses = {
  cardPadding: 'p-6',
  tableCellPadding: 'px-6 py-4',
  tableHeaderPadding: 'px-6 py-3',
  sectionMargin: 'space-y-6',
};

export const fontSizes = {
  xs: '0.75rem',
  sm: '0.875rem',
  md: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
};

export const colors = {
  primary: '#1E3A8A',
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
  error: '#E11D48',
  success: '#059669',
};

export const surfaceClasses = {
  card: `bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden ${spacingClasses.cardPadding}`,
  tableWrapper: 'bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm',
};
