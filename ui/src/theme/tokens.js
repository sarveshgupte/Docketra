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
  formFieldSpacing: 'space-y-4',
  formMessageSpacing: 'mt-1',
  formActions: 'pt-5 border-t border-gray-200 flex justify-end',
  formActionsGap: 'gap-3',
};

export const formClasses = {
  label: 'block text-sm font-medium text-gray-900',
  inputBase:
    'min-h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-gray-400 hover:border-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-500',
  inputError:
    'border-red-400 bg-red-50/60 text-red-900 placeholder:text-red-400 focus:border-red-500 focus:ring-red-500/20',
  textareaBase:
    'w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
  errorText: `${spacingClasses.formMessageSpacing} text-sm text-red-500`,
  helpText: `${spacingClasses.formMessageSpacing} text-xs text-gray-500`,
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
