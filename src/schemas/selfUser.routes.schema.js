const { z, nonEmptyString } = require('./common');

module.exports = {
  'GET /me': {
    query: z.object({}).strip(),
  },
  'POST /complete-profile': {
    body: z.object({
      name: nonEmptyString.optional(),
      firmName: nonEmptyString,
      phone: nonEmptyString,
    }).strip(),
  },
};
