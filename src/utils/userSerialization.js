const SENSITIVE_USER_PATHS = [
  'passwordHash',
  'authProviders.local.passwordHash',
  'passwordSetupTokenHash',
  'inviteTokenHash',
  'setupTokenHash',
  'passwordResetTokenHash',
  'forgotPasswordResetTokenHash',
  'loginOtpHash',
  'forgotPasswordOtpHash',
  'twoFactorSecret',
  'passwordHistory',
  'lockUntil',
  'failedLoginAttempts',
  'signupIP',
  'signupUserAgent',
  'lastLoginIp',
  'lastLoginCountry',
  'deletedAuthSnapshot',
];

const removePath = (target, path) => {
  if (!target || typeof target !== 'object') return;
  const parts = path.split('.');
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (!cursor || typeof cursor !== 'object') return;
    cursor = cursor[parts[i]];
  }
  if (cursor && typeof cursor === 'object') {
    delete cursor[parts[parts.length - 1]];
  }
};

const sanitizeUserForOutput = (userLike) => {
  if (!userLike) return userLike;
  const source = typeof userLike.toObject === 'function'
    ? userLike.toObject({ virtuals: true, getters: true })
    : { ...userLike };

  for (const path of SENSITIVE_USER_PATHS) {
    removePath(source, path);
  }

  return source;
};

module.exports = {
  SENSITIVE_USER_PATHS,
  sanitizeUserForOutput,
};
