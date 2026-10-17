/**
 * WhatsApp Helper Utilities for Docketra
 * Formats Indian phone numbers and generates wa.me links with clean, polite copy.
 */

export function formatIndianPhoneNumber(phone = '') {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';

  // 10-digit standard Indian mobile (e.g. 9820012345 -> 919820012345)
  if (digits.length === 10) {
    return `91${digits}`;
  }
  // 11-digit with leading zero (e.g. 09820012345 -> 919820012345)
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }
  // 12-digit already including 91 (e.g. 919820012345)
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  return digits;
}

export function getValidityLabel(validity = '7d') {
  const map = {
    '24h': '24 Hours',
    '48h': '48 Hours',
    '7d': '7 Days',
    '14d': '14 Days',
    '30d': '30 Days',
  };
  return map[validity] || '7 Days';
}

export function calculateValidityDate(validity = '7d') {
  const daysMap = {
    '24h': 1,
    '48h': 2,
    '7d': 7,
    '14d': 14,
    '30d': 30,
  };
  const days = daysMap[validity] || 7;
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + days);

  return targetDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function buildWhatsAppDocumentRequestMessage({
  clientName = '',
  docketTitle = '',
  docketNumber = '',
  uploadLink = '',
  validity = '7d',
  pin = null,
  firmName = '',
}) {
  const titleText = docketTitle || (docketNumber ? `Docket #${docketNumber}` : 'your compliance matter');
  const validityText = getValidityLabel(validity);
  const dueDateStr = calculateValidityDate(validity);
  const greeting = clientName && clientName !== '—' && clientName !== 'Unnamed client'
    ? `Namaste ${clientName},`
    : 'Namaste,';

  let msg = `${greeting}\n\nPlease upload the requested documents for *${titleText}* using this link:\n${uploadLink}\n\nLink Validity: ${validityText} (Valid until ${dueDateStr})`;
  if (pin) {
    msg += `\nVerification PIN: ${pin}`;
  }
  if (firmName && firmName !== '—') {
    msg += `\n\nRegards,\n${firmName}`;
  }
  return msg;
}

export function buildWhatsAppShareUrl({ phone = '', text = '' }) {
  const cleanPhone = formatIndianPhoneNumber(phone);
  const encodedText = encodeURIComponent(text || '');
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}
