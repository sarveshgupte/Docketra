const emailService = require('./email.service');

const resolveFirmLoginUrl = (firmSlug) => {
  const frontendBase = String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const slug = String(firmSlug || '').trim().toLowerCase();
  if (!slug) {
    return `${frontendBase}/login`;
  }
  return `${frontendBase}/${slug}/login`;
};

const sendWelcomeEmail = async ({
  email,
  name,
  firmName,
  firmSlug,
  xid,
}) => {
  const workspaceUrl = resolveFirmLoginUrl(firmSlug);
  return emailService.sendFirmSetupEmail({
    email,
    name,
    firmName,
    workspaceUrl,
    xid,
  });
};

module.exports = {
  sendWelcomeEmail,
  resolveFirmLoginUrl,
};
