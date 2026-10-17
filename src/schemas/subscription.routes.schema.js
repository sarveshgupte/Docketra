const { z, nonEmptyString } = require('./common');

module.exports = {
  'GET /': {},
  'POST /orders': {
    body: z.object({
      plan: z.enum(['starter', 'growth', 'pro']),
      billingCycle: z.enum(['monthly', 'annual']),
    }).strip(),
  },
  'GET /orders/:orderId': {
    params: z.object({
      orderId: nonEmptyString,
    }),
  },
  'POST /orders/:orderId/verify-utr': {
    params: z.object({
      orderId: nonEmptyString,
    }),
    body: z.object({
      utr: z.string().trim().min(8).max(30),
    }).strip(),
  },
  'POST /webhook': {
    body: z.object({
      orderId: nonEmptyString,
      utr: z.string().trim().optional(),
      amount: z.coerce.number().optional(),
    }).passthrough(),
  },
};
