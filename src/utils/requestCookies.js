const parseCookieHeader = (cookieHeader) => {
  if (!cookieHeader) {
    return {};
  }

  return String(cookieHeader)
    .split(';')
    .reduce((cookies, entry) => {
      const cookie = entry.trim();
      if (!cookie) {
        return cookies;
      }

      const separatorIndex = cookie.indexOf('=');
      const key = (separatorIndex === -1 ? cookie : cookie.slice(0, separatorIndex)).trim();
      if (!key || Object.prototype.hasOwnProperty.call(cookies, key)) {
        return cookies;
      }

      const rawValue = (separatorIndex === -1 ? '' : cookie.slice(separatorIndex + 1)).trim();
      try {
        cookies[key] = decodeURIComponent(rawValue);
      } catch (_) {
        cookies[key] = rawValue;
      }

      return cookies;
    }, {});
};

const getCookieValue = (cookieHeader, name) => {
  if (!name) {
    return null;
  }

  const cookies = parseCookieHeader(cookieHeader);
  return Object.prototype.hasOwnProperty.call(cookies, name) ? cookies[name] : null;
};

module.exports = {
  parseCookieHeader,
  getCookieValue,
};
