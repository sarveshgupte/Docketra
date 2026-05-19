const assert = require('assert');
const categorySchemas = require('../src/schemas/category.routes.schema');

(() => {
  const schema = categorySchemas['PUT /:id/subcategories/:subcategoryId'].body;
  assert.throws(() => schema.parse({ checklistTemplate: [{ id: '1', title: '', dueOffsetDays: -1 }] }));
  schema.parse({ checklistTemplate: [{ id: '1', title: 'Valid', dueOffsetDays: 0 }] });
  console.log('ok');
})();
