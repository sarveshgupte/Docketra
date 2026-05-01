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
  label: 'mb-1.5 block text-sm font-medium text-[var(--dt-text-secondary)]',
  inputBase:
    'min-h-11 w-full rounded-[var(--dt-radius-control)] border border-[var(--dt-border)] bg-[var(--dt-surface)] px-3.5 py-2.5 text-sm leading-5 text-[var(--dt-text)] shadow-[var(--dt-shadow-control)] transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[var(--dt-text-muted)] hover:border-[var(--dt-border-strong)] focus:border-[var(--dt-focus)] focus:bg-[var(--dt-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--dt-focus)]/20 disabled:cursor-not-allowed disabled:border-[var(--dt-border-whisper)] disabled:bg-[var(--dt-surface-muted)] disabled:text-[var(--dt-text-disabled)]',
  inputError:
    'border-[var(--dt-error)] bg-[var(--dt-error-subtle)] text-[var(--dt-error)] placeholder:text-[var(--dt-error)]/70 focus:border-[var(--dt-error)] focus:ring-[var(--dt-error)]/20',
  inputSuccess:
    'border-[var(--dt-success)] bg-[var(--dt-success-subtle)] text-[var(--dt-success)] focus:border-[var(--dt-success)] focus:ring-[var(--dt-success)]/20',
  textareaBase:
    'w-full rounded-[var(--dt-radius-control)] border border-[var(--dt-border)] bg-[var(--dt-surface)] px-3.5 py-2.5 text-sm leading-5 text-[var(--dt-text)] shadow-[var(--dt-shadow-control)] transition-colors hover:border-[var(--dt-border-strong)] focus:border-[var(--dt-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--dt-focus)]/20 disabled:cursor-not-allowed disabled:bg-[var(--dt-surface-muted)] disabled:text-[var(--dt-text-disabled)]',
  errorText: `${spacingClasses.formMessageSpacing} text-sm text-[var(--dt-error)]`,
  successText: `${spacingClasses.formMessageSpacing} flex items-center gap-1 text-sm text-[var(--dt-success)]`,
  helpText: `${spacingClasses.formMessageSpacing} text-xs leading-5 text-[var(--dt-text-muted)]`,
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
  card: `bg-[var(--dt-surface)] border border-[var(--dt-border-whisper)] rounded-[var(--dt-radius-card)] shadow-[var(--dt-shadow-card)] overflow-hidden ${spacingClasses.cardPadding}`,
  tableWrapper: 'bg-[var(--dt-surface)] border border-[var(--dt-border-whisper)] rounded-[var(--dt-radius-card)] overflow-hidden shadow-[var(--dt-shadow-card)]',
};
