const { z, nonEmptyString } = require('./common');

module.exports = {
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
  'POST /upload/:token': {
    params: z.object({ token: z.string().trim().min(8).max(128) }).strict(),
    body: z.object({
      pin: z.string().trim().regex(/^\d{4}$/).optional(),
    }).passthrough(),
  },
};
