const { z } = require('zod');

const nonEmptyString = z.string().trim().min(1);

module.exports = {
  z,
  nonEmptyString,
};
