'use strict';

const { z } = require('zod');

const providerSchema = z.enum(['openai', 'gemini', 'anthropic', 'azure_openai', 'docketra_managed']).nullable();
const credentialModeSchema = z.enum(['none', 'encrypted_key', 'credential_ref']);

const boolObj = (shape) => z.object(shape).strip().optional();

module.exports = {
  'GET /configuration': {
    query: z.object({}).passthrough(),
  },
  'PUT /configuration': {
    body: z.object({
      enabled: z.boolean().optional(),
      provider: z.union([providerSchema, z.literal('claude')]).optional(),
      model: z.string().trim().max(200).nullable().optional(),
      credentialMode: credentialModeSchema.optional(),
      encryptedKey: z.string().trim().max(2000).optional(),
      credentialRef: z.string().trim().max(300).optional(),
      features: boolObj({
        taskDescriptionRefinement: z.boolean().optional(),
        documentSummary: z.boolean().optional(),
        docketDrafting: z.boolean().optional(),
        routingSuggestions: z.boolean().optional(),
      }),
      roleAccess: boolObj({
        PRIMARY_ADMIN: z.boolean().optional(),
        ADMIN: z.boolean().optional(),
        MANAGER: z.boolean().optional(),
        USER: z.boolean().optional(),
      }),
      retention: boolObj({
        zeroRetention: z.boolean().optional(),
        savePrompts: z.boolean().optional(),
        saveOutputs: z.boolean().optional(),
      }),
      privacy: boolObj({
        redactErrors: z.boolean().optional(),
        verboseLogging: z.boolean().optional(),
      }),
    }).strip(),
  },
  'POST /test-configuration': {
    body: z.object({}).strip().optional(),
  },
};
