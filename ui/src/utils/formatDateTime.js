const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
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

export const formatDateTime = (input) => {
  const date = toDate(input);
  if (!date) return 'N/A';

  return `${DATE_TIME_FORMATTER.format(date).replace('am', 'AM').replace('pm', 'PM')} IST`;
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
