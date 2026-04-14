const { z, nonEmptyString, objectIdString } = require('./common');

const formFieldSchema = z.object({
  key: nonEmptyString.max(64),
  label: z.string().trim().max(128).optional(),
  type: z.enum(['text', 'email', 'phone']).optional(),
}).strict();

module.exports = {
  'POST /': {
    body: z.object({
      name: nonEmptyString.max(200),
      fields: z.array(formFieldSchema).min(1).max(20).optional(),
    }).strict(),
  },
  'GET /:id': {
    params: z.object({ id: objectIdString }).strict(),
  },
};
