const DEFAULT_TURNSTILE_TIMEOUT_MS = 5000;
const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const isTurnstileEnabled = () => String(process.env.TURNSTILE_ENABLED || '').toLowerCase() === 'true';

const extractTurnstileToken = (body = {}) => {
  if (!body || typeof body !== 'object') return '';
  return String(body.turnstileToken || body['cf-turnstile-response'] || '').trim();
};

const verifyTurnstileToken = async ({ token, remoteIp, fetchImpl = global.fetch, timeoutMs = DEFAULT_TURNSTILE_TIMEOUT_MS }) => {
  if (!isTurnstileEnabled()) return { success: true, skipped: true };
  const secret = String(process.env.TURNSTILE_SECRET_KEY || '').trim();
  if (!token || !secret || typeof fetchImpl !== 'function') return { success: false };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const payload = new URLSearchParams();
    payload.set('secret', secret);
    payload.set('response', token);
    if (remoteIp) payload.set('remoteip', String(remoteIp));

    const response = await fetchImpl(TURNSTILE_SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload,
      signal: controller.signal,
    });

    if (!response?.ok) return { success: false };
    const data = await response.json();
    return { success: Boolean(data?.success) };
  } catch (_err) {
    return { success: false };
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = {
  DEFAULT_TURNSTILE_TIMEOUT_MS,
  TURNSTILE_SITEVERIFY_URL,
  isTurnstileEnabled,
  extractTurnstileToken,
  verifyTurnstileToken,
};
