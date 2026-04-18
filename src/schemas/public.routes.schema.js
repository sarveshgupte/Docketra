const { z, nonEmptyString, objectIdString, slugString } = require('./common');

module.exports = {
  'GET /firms/:firmSlug': {
    params: z.object({ firmSlug: slugString }).strict(),
  },
  'GET /pages/:slug': {
    params: z.object({ slug: slugString }).strict(),
  },
  'POST /forms/:id/submit': {
    params: z.object({ id: objectIdString }).strict(),
    body: z.object({
      name: nonEmptyString.max(200),
      email: z.string().trim().email().max(254).optional(),
      phone: z.string().trim().max(30).optional(),
      message: z.string().trim().max(2000).optional(),
      service: z.string().trim().max(200).optional(),
      referrer: z.string().trim().max(1000).optional(),
      pageUrl: z.string().trim().max(1000).optional(),
      utm_source: z.string().trim().max(120).optional(),
      utm_campaign: z.string().trim().max(120).optional(),
      utm_medium: z.string().trim().max(120).optional(),
      website: z.string().trim().max(200).optional(),
      submissionMode: z.enum(['public_form', 'embedded_form']).optional(),
    }).passthrough(),
  },
  'GET /forms/:id': {
    params: z.object({ id: objectIdString }).strict(),
    query: z.object({
      embed: z.enum(['true', 'false']).optional(),
    }).passthrough(),
  },
  'POST /cms/:firmSlug/intake': {
    params: z.object({ firmSlug: slugString }).strict(),
    body: z.object({
      name: nonEmptyString.max(200),
      email: z.string().trim().email().max(254).optional(),
      phone: z.string().trim().max(30).optional(),
      source: z.string().trim().max(120).optional(),
      service: z.string().trim().max(200).optional(),
      message: z.string().trim().max(2000).optional(),
      pageUrl: z.string().trim().max(1000).optional(),
      referrer: z.string().trim().max(1000).optional(),
      utm_source: z.string().trim().max(120).optional(),
      utm_campaign: z.string().trim().max(120).optional(),
      utm_medium: z.string().trim().max(120).optional(),
      externalSubmissionId: z.string().trim().max(200).optional(),
      idempotencyKey: z.string().trim().max(200).optional(),
    }).passthrough(),
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
  'POST /contact': {
    body: z.object({
      name: nonEmptyString,
      email: z.string().trim().email(),
      company: z.string().trim().optional(),
      message: z.string().trim().min(1).max(2000),
    }).passthrough(),
  },
};
