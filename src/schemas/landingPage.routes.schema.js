const { z, nonEmptyString, objectIdString } = require('./common');

const slugString = z.string().trim().toLowerCase().min(1).max(100).regex(
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  'slug must be lowercase alphanumeric with hyphens only',
);

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
