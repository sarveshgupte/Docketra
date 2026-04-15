const { z, nonEmptyString, objectIdString, slugString } = require('./common');

module.exports = {
  'POST /': {
    body: z.object({
      title: nonEmptyString.max(200),
      slug: slugString,
      description: z.string().trim().max(500).optional(),
      formId: objectIdString,
      headerText: z.string().trim().max(300).optional(),
      subText: z.string().trim().max(500).optional(),
    }).strict(),
  },
  'GET /:id': {
    params: z.object({ id: objectIdString }).strict(),
  },
  'GET /': {
    query: z.object({
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }).passthrough(),
  },
};
