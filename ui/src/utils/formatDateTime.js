export const BUSINESS_TIMEZONE = 'Asia/Kolkata';

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  timeZone: BUSINESS_TIMEZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' });

const toDate = (input) => {
  if (!input) return null;
  const value = input instanceof Date ? input : new Date(input);
  return Number.isNaN(value.getTime()) ? null : value;
};

const getDateParts = (date, timezone = BUSINESS_TIMEZONE) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  return {
    year: parts.find((part) => part.type === 'year')?.value || '',
    month: parts.find((part) => part.type === 'month')?.value || '',
    day: parts.find((part) => part.type === 'day')?.value || '',
  };
};

export const getISODateInTimezone = (input = new Date(), timezone = BUSINESS_TIMEZONE) => {
  const date = toDate(input);
  if (!date) return '';
  const { year, month, day } = getDateParts(date, timezone);
  if (!year || !month || !day) return '';
  return `${year}-${month}-${day}`;
};

export const formatDateOnly = (input, timezone = BUSINESS_TIMEZONE) => {
  const date = toDate(input);
  if (!date) return 'N/A';
  const { year, month, day } = getDateParts(date, timezone);
  if (!year || !month || !day) return 'N/A';
  return `${day}/${month}/${year}`;
};

export const formatTimeOnly = (input, timezone = BUSINESS_TIMEZONE) => {
  const date = toDate(input);
  if (!date) return 'N/A';
  const value = new Intl.DateTimeFormat('en-IN', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
  return value.replace(/\b(am|pm)\b/i, (token) => token.toUpperCase());
};

export const formatDateTime = (input) => {
  const date = toDate(input);
  if (!date) return 'N/A';

  const formatted = DATE_TIME_FORMATTER.format(date).replace(/\b(am|pm)\b/i, (token) => token.toUpperCase());
  return `${formatted} IST`;
};

export const formatRelativeTime = (input) => {
  const date = toDate(input);
  if (!date) return '';

  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);

  if (Math.abs(diffMinutes) < 60) return RELATIVE_FORMATTER.format(diffMinutes, 'minute');

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return RELATIVE_FORMATTER.format(diffHours, 'hour');

  const diffDays = Math.round(diffHours / 24);
  return RELATIVE_FORMATTER.format(diffDays, 'day');
};

export const formatAuditStamp = ({ actor, timestamp, prefix = 'Updated by' } = {}) => {
  const formattedTime = formatDateTime(timestamp);
  if (actor && formattedTime !== 'N/A') return `${prefix} ${actor} • ${formattedTime}`;
  if (formattedTime !== 'N/A') return formattedTime;
  return actor ? `${prefix} ${actor}` : 'N/A';
};
