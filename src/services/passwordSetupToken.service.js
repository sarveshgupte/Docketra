const jwt = require('jsonwebtoken');

const PASSWORD_SETUP_TOKEN_EXPIRY = '24h';

const generatePasswordSetupToken = ({ userId, firmId, expiresIn = PASSWORD_SETUP_TOKEN_EXPIRY }) => {
  const passwordSetupSecret = process.env.JWT_PASSWORD_SETUP_SECRET;
  if (!passwordSetupSecret) {
    throw new Error('JWT_PASSWORD_SETUP_SECRET environment variable is not configured');
  }

  return jwt.sign(
    {
      userId,
      firmId,
      type: 'PASSWORD_SETUP',
    },
    passwordSetupSecret,
    { expiresIn }
  );
};

module.exports = {
  PASSWORD_SETUP_TOKEN_EXPIRY,
  generatePasswordSetupToken,
};

