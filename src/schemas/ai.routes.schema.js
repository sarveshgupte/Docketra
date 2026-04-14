const { z } = require('zod');

module.exports = {
  'POST /config': {
    body: z.object({
      provider: z.enum(['openai', 'gemini', 'claude']),
      apiKey: z.string().trim().min(1),
      model: z.string().trim().min(1).max(120).optional(),
    }).strict(),
  },
};
