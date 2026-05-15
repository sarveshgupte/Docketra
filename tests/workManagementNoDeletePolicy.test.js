const adminSchemas = require('../src/schemas/admin.routes.schema');

describe('work management no-delete policy', () => {
  test('admin category delete routes are not exposed in admin schema', () => {
    expect(adminSchemas['DELETE /categories/:id']).toBeUndefined();
    expect(adminSchemas['DELETE /categories/:id/subcategories/:subcategoryId']).toBeUndefined();
  });

  test('work management mutation schemas are strict', () => {
    expect(() => adminSchemas['POST /categories'].body.parse({ name: 'Tax', firmId: 'x' })).toThrow();
    expect(() => adminSchemas['POST /workbaskets'].body.parse({ name: 'GST', createdBy: 'x' })).toThrow();
  });
});
