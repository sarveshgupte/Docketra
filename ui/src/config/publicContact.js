const normalizeSupportEmail = (value) => {
  const trimmedValue = String(value || '').trim();
  if (!trimmedValue) return 'help@docketra.in';

  const mailtoValue = trimmedValue.replace(/^mailto:/i, '').trim();
  return mailtoValue || 'help@docketra.in';
};

export const SUPPORT_EMAIL = normalizeSupportEmail(import.meta.env.VITE_SUPPORT_EMAIL);
