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

  test('POST /workbaskets accepts optional managerId while remaining strict', () => {
    expect(() => adminSchemas['POST /workbaskets'].body.parse({ name: 'GST', managerId: '507f1f77bcf86cd799439011' })).not.toThrow();
    expect(() => adminSchemas['POST /workbaskets'].body.parse({ name: 'GST', managerId: '507f1f77bcf86cd799439011', createdBy: 'x' })).toThrow();
  });
});
