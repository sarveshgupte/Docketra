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

  test('POST /workbaskets accepts optional managerId while remaining strict', () => {
    expect(() => adminSchemas['POST /workbaskets'].body.parse({ name: 'GST', managerId: '507f1f77bcf86cd799439011' })).not.toThrow();
    expect(() => adminSchemas['POST /workbaskets'].body.parse({ name: 'GST', managerId: '507f1f77bcf86cd799439011', createdBy: 'x' })).toThrow();
  });
});
