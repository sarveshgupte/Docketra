const { z, nonEmptyString } = require('./common');

module.exports = {
  'GET /me': {
    query: z.object({}).strip(),
  },
  'GET /core-work': {
    query: z.object({}).strip(),
  },
  'POST /complete-profile': {
    body: z.object({
      name: nonEmptyString.optional(),
      firmName: nonEmptyString,
      phone: z.string().trim().regex(/^\d{10}$/, 'phone must be exactly 10 digits'),
    }).strip(),
  },
};
