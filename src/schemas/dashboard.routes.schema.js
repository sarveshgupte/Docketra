const { z } = require('./common');
const { ONBOARDING_EVENT_NAMES } = require('../models/OnboardingEvent.model');

module.exports = {
  'GET /summary': {
    query: z.object({}).passthrough(),
  },
  'GET /onboarding-progress': {
    query: z.object({}).passthrough(),
  },
  'POST /onboarding-event': {
    body: z.object({
      eventName: z.enum(ONBOARDING_EVENT_NAMES),
      stepId: z.string().trim().max(120).optional().nullable(),
      source: z.enum(['detected', 'manual']).optional().nullable(),
      metadata: z.record(z.any()).optional(),
    }).passthrough(),
  },
};
