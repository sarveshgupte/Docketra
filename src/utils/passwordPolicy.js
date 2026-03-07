const PASSWORD_POLICY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
const PASSWORD_POLICY_MESSAGE = 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.';

const validatePasswordStrength = (password) => PASSWORD_POLICY_REGEX.test(String(password || ''));

module.exports = {
  PASSWORD_POLICY_REGEX,
  PASSWORD_POLICY_MESSAGE,
  validatePasswordStrength,
};
