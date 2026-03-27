const { z, nonEmptyString } = require('./common');

module.exports = {
  'POST /complete-profile': {
    body: z.object({
      name: nonEmptyString.optional(),
      firmName: nonEmptyString,
      phoneNumber: nonEmptyString,
    }).strip(),
  },
};
