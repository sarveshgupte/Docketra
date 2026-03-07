'use strict';

function getIpRange(ipAddress) {
  if (!ipAddress || ipAddress === 'unknown') return 'unknown';

  // Normalize IPv4-mapped IPv6 addresses so the same client collapses to one range.
  const normalizedIp = String(ipAddress).replace(/^::ffff:/, '');
  if (normalizedIp.includes(':')) {
    return normalizedIp
      .split(':')
      .filter(Boolean)
      .slice(0, 4)
      .join(':') || normalizedIp;
  }

  const octets = normalizedIp.split('.');
  return octets.length === 4 ? octets.slice(0, 3).join('.') : normalizedIp;
}

module.exports = {
  getIpRange,
};
