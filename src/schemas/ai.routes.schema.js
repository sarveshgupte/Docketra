const { z } = require('zod');

const roleAccessSchema = z.object({
  PRIMARY_ADMIN: z.boolean().optional(),
  ADMIN: z.boolean().optional(),
  MANAGER: z.boolean().optional(),
  USER: z.boolean().optional(),
}).strict().optional();

module.exports = {
  'POST /config': {
    body: z.object({
      provider: z.enum(['openai']),
      apiKey: z.string().trim().min(1).optional(),
      model: z.string().trim().min(1).max(120).optional(),
      settings: z.object({
        enabled: z.boolean().optional(),
        enabledFeatures: z.object({
          documentAnalysis: z.boolean().optional(),
          docketDrafting: z.boolean().optional(),
          routingSuggestions: z.boolean().optional(),
        }).strict().optional(),
        roleAccess: roleAccessSchema,
        retention: z.object({
          zeroRetention: z.boolean().optional(),
          savePrompts: z.boolean().optional(),
          saveOutputs: z.boolean().optional(),
        }).strict().optional(),
        privacy: z.object({
          redactErrors: z.boolean().optional(),
          verboseLogging: z.boolean().optional(),
        }).strict().optional(),
        credentialRef: z.string().trim().max(300).optional(),
        promptTemplates: z.record(z.string(), z.string()).optional(),
      }).strict().optional(),
    }).strict(),
  },
  'GET /status': {
    query: z.object({}).passthrough(),
  },
  'DELETE /config': {},
};
