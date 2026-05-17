const adminSchemas = require('../src/schemas/admin.routes.schema');

describe('work management deactivate-only compatibility policy', () => {
  test('admin category delete routes remain exposed as soft-delete compatibility endpoints', () => {
    expect(adminSchemas['DELETE /categories/:id']).toBeDefined();
    expect(adminSchemas['DELETE /categories/:id/subcategories/:subcategoryId']).toBeDefined();
  });

  test('work management mutation schemas are strict', () => {
    expect(() => adminSchemas['POST /categories'].body.parse({ name: 'Tax', firmId: 'x' })).toThrow();
    expect(() => adminSchemas['POST /workbaskets'].body.parse({ name: 'GST', createdBy: 'x' })).toThrow();
  });
});
