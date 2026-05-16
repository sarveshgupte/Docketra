const normalizeSupportEmail = (value) => {
  const trimmedValue = String(value || '').trim();
  if (!trimmedValue) return 'support@docketra.com';

  const mailtoValue = trimmedValue.replace(/^mailto:/i, '').trim();
  return mailtoValue || 'support@docketra.com';
};

export const SUPPORT_EMAIL = normalizeSupportEmail(import.meta.env.VITE_SUPPORT_EMAIL);
