const bcrypt = require('bcrypt');
const crypto = require('crypto');

const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

const hashOtp = async (otp, saltRounds = 10) => bcrypt.hash(String(otp), saltRounds);

const verifyOtp = async (otp, otpHash) => bcrypt.compare(String(otp), String(otpHash || ''));

const incrementAttempts = (currentAttempts = 0, maxAttempts = 5) => {
  const attempts = Number(currentAttempts || 0) + 1;
  return {
    attempts,
    exhausted: attempts >= maxAttempts,
    remainingAttempts: Math.max(0, maxAttempts - attempts),
  };
};

module.exports = {
  generateOtp,
  hashOtp,
  verifyOtp,
  incrementAttempts,
};
