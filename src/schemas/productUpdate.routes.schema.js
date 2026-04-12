const { z, nonEmptyString } = require('./common');

module.exports = {
  'GET /latest': {
    query: z.object({}).strip(),
  },
  'GET /': {
    query: z.object({}).strip(),
  },
  'POST /': {
    body: z.object({
      title: nonEmptyString.max(160),
      content: z.array(nonEmptyString).min(1).max(5),
      isPublished: z.boolean().optional(),
      version: nonEmptyString.max(32).optional(),
      updateKey: nonEmptyString.max(64).optional(),
    }).strip(),
  },
};
