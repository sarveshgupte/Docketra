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
};
