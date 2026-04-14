const assert = require('assert');
const Firm = require('../src/models/Firm.model');

const createRes = () => ({
  statusCode: 200,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.payload = body;
    return this;
  },
});

const run = async () => {
  const originalFindById = Firm.findById;

  try {
    Firm.findById = () => ({
      select: () => ({
        lean: async () => ({
          isSetupComplete: true,
          setupMetadata: {
            categories: 3,
            workbaskets: 4,
            templateKey: 'SYSTEM_DEFAULT',
          },
        }),
      }),
    });

    delete require.cache[require.resolve('../src/controllers/firm.controller')];
    const { getFirmSetupStatus } = require('../src/controllers/firm.controller');

    const res = createRes();
    await getFirmSetupStatus({ user: { firmId: '67e95f7642adf77d7f4e1834' } }, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.payload.success, true);
    assert.strictEqual(res.payload.data.isSetupComplete, true);
    assert.strictEqual(res.payload.data.lastSetup.categories, 3);
    assert.strictEqual(res.payload.data.lastSetup.workbaskets, 4);
    assert.strictEqual(res.payload.data.lastSetup.templateKey, 'SYSTEM_DEFAULT');

    console.log('✓ firm setup status returns setup observability data');
  } finally {
    Firm.findById = originalFindById;
  }
};

run().catch((error) => {
  console.error('Firm setup status controller tests failed:', error);
  process.exit(1);
});
