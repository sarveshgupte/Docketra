const { z, nonEmptyString, objectIdString } = require('./common');

module.exports = {
  'POST /forms/:id/submit': {
    params: z.object({ id: objectIdString }).strict(),
    body: z.object({
      name: nonEmptyString.max(200),
      email: z.string().trim().email().max(254).optional(),
      phone: z.string().trim().max(30).optional(),
    }).strict(),
  },
  'POST /signup': {
    body: z.object({
      firmName: nonEmptyString,
      practiceType: z.enum(['CA', 'CS', 'Law']),
      teamMembers: z.coerce.number().int().min(1),
      currentWorkflowSystem: nonEmptyString,
      compliancePainPoint: nonEmptyString,
      goLiveTimeline: nonEmptyString,
    }),
  },
  'GET /upload/:token/meta': {
    params: z.object({ token: z.string().trim().min(8).max(128) }).strict(),
  },
  'POST /upload/:token': {
    params: z.object({ token: z.string().trim().min(8).max(128) }).strict(),
    body: z.object({
      pin: z.string().trim().regex(/^\d{4}$/).optional(),
    }).passthrough(),
  },
  'POST /upload/:token/request-pin': {
    params: z.object({ token: z.string().trim().min(8).max(128) }).strict(),
    body: z.object({}).passthrough(),
  },
};
