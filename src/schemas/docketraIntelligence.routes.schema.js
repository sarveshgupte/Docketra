const { queryBoolean, z } = require('./common');

const capacityThreshold = z.coerce.number().int().min(1).max(100).optional();

module.exports = {
  'GET /workload': {
    query: z.object({
      workbasketId: z.string().trim().min(1).optional(),
      assigneeXID: z.string().trim().regex(/^X\d{6}$/i).optional(),
    }).strict(),
  },
  'GET /workbasket-capacity': {
    query: z.object({
      busyThreshold: capacityThreshold,
      overloadedThreshold: capacityThreshold,
      includeQc: queryBoolean.optional(),
    }).strict().refine(
      (query) => (
        query.busyThreshold == null
        || query.overloadedThreshold == null
        || query.busyThreshold < query.overloadedThreshold
      ),
      {
        path: ['busyThreshold'],
        message: 'busyThreshold must be lower than overloadedThreshold',
      },
    ),
  },
  'GET /deadline-risk': {
    query: z.object({}).strict(),
  },
};
