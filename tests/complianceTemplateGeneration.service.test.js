const assert = require('assert');
const complianceGenerationService = require('../src/services/complianceTemplateGeneration.service');
const Case = require('../src/models/Case.model');
const Client = require('../src/models/Client.model');
const Category = require('../src/models/Category.model');
const ComplianceObligationTemplate = require('../src/models/ComplianceObligationTemplate.model');

const restore = [];
const stub = (target, key, value) => {
  const original = target[key];
  restore.push(() => { target[key] = original; });
  target[key] = value;
};
const teardown = () => {
  while (restore.length) {
    const fn = restore.pop();
    fn();
  }
};

async function run() {
  // recurrence generation (monthly between Jan-Mar should yield 3 periods)
  {
    const periods = complianceGenerationService.expandRecurringPeriods({
      recurrencePattern: { frequency: 'monthly', interval: 1 },
      rangeStart: new Date('2026-01-01T00:00:00.000Z'),
      rangeEnd: new Date('2026-03-20T00:00:00.000Z'),
    });
    assert.strictEqual(periods.length, 3);
  }

  // internal due date calculation
  {
    const statutoryDueDate = complianceGenerationService.computeStatutoryDueDate({
      periodStart: new Date('2026-05-01T00:00:00.000Z'),
      periodEnd: new Date('2026-05-31T00:00:00.000Z'),
      dueDateRule: { mode: 'day_of_next_month', dayOfMonth: 20 },
    });
    const internalDueDate = complianceGenerationService.computeInternalDueDate({
      statutoryDueDate,
      internalBufferDays: 5,
    });
    assert.strictEqual(statutoryDueDate.toISOString().slice(0, 10), '2026-06-20');
    assert.strictEqual(internalDueDate.toISOString().slice(0, 10), '2026-06-15');
  }

  // template applicability by entity type
  {
    const template = { applicableEntityTypes: ['private limited company', 'llp'] };
    assert.strictEqual(
      complianceGenerationService.isTemplateApplicableToEntityType(template, 'Private Limited Company'),
      true,
    );
    assert.strictEqual(
      complianceGenerationService.isTemplateApplicableToEntityType(template, 'proprietorship'),
      false,
    );
  }

  // duplicate prevention (preview should classify as skipped_duplicate)
  {
    const templateId = '683ae9998aa0f4c4740a7a11';
    const idempotencyKey = 'compliance:C000111:gst:2026-01';

    stub(ComplianceObligationTemplate, 'find', () => ({
      sort: () => ({
        lean: async () => ([{
          _id: templateId,
          name: 'GST Monthly',
          obligationType: 'GST',
          isActive: true,
          recurrencePattern: { frequency: 'monthly', interval: 1 },
          dueDateRule: { mode: 'day_of_next_month', dayOfMonth: 20 },
          internalBufferDays: 3,
          docketCategoryId: '683ae9998aa0f4c4740a7a20',
          docketSubcategoryId: 'sub-1',
          applicableEntityTypes: ['private limited company'],
        }]),
      }),
    }));
    stub(Client, 'find', () => ({
      select: () => ({
        lean: async () => ([{
          clientId: 'C000111',
          businessName: 'Apex Pvt Ltd',
          clientFactSheet: { basicInfo: { entityType: 'private limited company' } },
        }]),
      }),
    }));
    stub(Category, 'findOne', () => ({
      lean: async () => ({
        _id: '683ae9998aa0f4c4740a7a20',
        name: 'Compliance',
        subcategories: [{ id: 'sub-1', name: 'GST', isActive: true }],
      }),
    }));
    stub(Case, 'find', () => ({
      select: () => ({
        lean: async () => ([{ idempotencyKey }]),
      }),
    }));

    const result = await complianceGenerationService.previewOrGenerate({
      firmId: '683ae9998aa0f4c4740a7001',
      actor: { xID: 'X000999' },
      rangeStart: '2026-01-01',
      rangeEnd: '2026-01-31',
      execute: false,
    });

    assert.strictEqual(result.summary.skippedDuplicate, 1);
    assert.ok(result.items.some((item) => item.status === 'skipped_duplicate'));
    teardown();
  }

  console.log('compliance template generation service tests passed');
}

run().catch((error) => {
  teardown();
  throw error;
});
