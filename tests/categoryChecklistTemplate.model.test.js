const assert = require('assert');
const Category = require('../src/models/Category.model');

(async () => {
  const category = new Category({
    firmId: '507f1f77bcf86cd799439011',
    name: 'Tax',
    subcategories: [{ id: 'sub-1', name: 'GSTR-1', workbasketId: '507f1f77bcf86cd799439012' }],
  });

  assert.deepStrictEqual(category.subcategories[0].checklistTemplate, []);

  category.subcategories[0].checklistTemplate = [
    { id: 'a', title: 'Collect data', dueOffsetDays: 2 },
    { id: 'b', title: 'Review' },
  ];
  category.subcategories[0].deadlineRule = { mode: 'TAT_DAYS', tatDays: 5, allowManualOverride: false };

  await category.validate();
  assert.strictEqual(category.subcategories[0].checklistTemplate[0].sortOrder, 0);
  assert.strictEqual(category.subcategories[0].checklistTemplate[1].sortOrder, 1);
  assert.strictEqual(category.subcategories[0].deadlineRule.mode, 'TAT_DAYS');
  assert.strictEqual(category.subcategories[0].deadlineRule.tatDays, 5);
  console.log('ok');
})();
