const { z, nonEmptyString, objectIdString } = require('./common');

const formFieldSchema = z.object({
  key: nonEmptyString.max(64),
  label: z.string().trim().max(128).optional(),
  type: z.enum(['text', 'email', 'phone']).optional(),
  required: z.boolean().optional(),
}).strict();

module.exports = {
  'POST /': {
    body: z.object({
      name: nonEmptyString.max(200),
      fields: z.array(formFieldSchema).min(1).max(20).optional(),
      allowEmbed: z.boolean().optional(),
      embedTitle: z.string().trim().max(200).optional(),
      successMessage: z.string().trim().max(400).optional(),
      redirectUrl: z.string().trim().url().max(500).optional().or(z.literal('')),
      themeMode: z.enum(['light', 'dark']).optional(),
      allowedEmbedDomains: z.array(z.string().trim().min(1).max(200)).max(25).optional(),
    }).strict(),
  },
  'PATCH /:id': {
    params: z.object({ id: objectIdString }).strict(),
    body: z.object({
      name: nonEmptyString.max(200).optional(),
      fields: z.array(formFieldSchema).min(1).max(20).optional(),
      isActive: z.boolean().optional(),
      allowEmbed: z.boolean().optional(),
      embedTitle: z.string().trim().max(200).optional(),
      successMessage: z.string().trim().max(400).optional(),
      redirectUrl: z.string().trim().url().max(500).optional().or(z.literal('')),
      themeMode: z.enum(['light', 'dark']).optional(),
      allowedEmbedDomains: z.array(z.string().trim().min(1).max(200)).max(25).optional(),
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
