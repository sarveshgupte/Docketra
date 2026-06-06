const assert = require('assert');
const { validateRequest } = require('../src/middleware/requestValidation.middleware');
const routeSchemas = require('../src/schemas/complianceCalendar.routes.schema');

function createMockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

(function testCreateSchemaAcceptsNullRecurrencePattern() {
  const middleware = validateRequest(routeSchemas['POST /']);
  const req = {
    body: {
      title: 'Annual filing reminder',
      dueDate: '2026-06-06T00:00:00.000Z',
      reminderDaysBefore: 3,
      recurrencePattern: null,
    },
    params: {},
    query: {},
  };
  const res = createMockResponse();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true, 'POST / should accept a null recurrencePattern');
  assert.strictEqual(res.statusCode, 200, 'validation should pass for a null recurrencePattern');
  assert.deepStrictEqual(req.body.recurrencePattern, null);
})();

console.log('complianceCalendarRouteSchema.test.js passed');
