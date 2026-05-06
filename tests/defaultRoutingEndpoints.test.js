jest.mock('../src/services/defaultRouting.service', () => ({
  ensureDefaultRoutingForFirm: jest.fn(async () => ({ created: true })),
}));

const { ensureDefaultRoutingForFirm } = require('../src/services/defaultRouting.service');
const workbasketController = require('../src/controllers/workbasket.controller');
const categoryController = require('../src/controllers/category.controller');

const mockRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('default routing endpoint behavior', () => {
  beforeEach(() => jest.clearAllMocks());

  test('GET categories does not auto-create defaults', async () => {
    const req = { query: {}, user: { firmId: '507f1f77bcf86cd799439011', role: 'PRIMARY_ADMIN' } };
    const res = mockRes();
    await categoryController.getCategories(req, res);
    expect(ensureDefaultRoutingForFirm).not.toHaveBeenCalled();
  });

  test('GET workbaskets does not auto-create defaults', async () => {
    const req = { query: {}, user: { firmId: '507f1f77bcf86cd799439011', role: 'PRIMARY_ADMIN' } };
    const res = mockRes();
    await workbasketController.listWorkbaskets(req, res);
    expect(ensureDefaultRoutingForFirm).not.toHaveBeenCalled();
  });

  test('POST default-routing triggers explicit setup', async () => {
    const req = { user: { firmId: '507f1f77bcf86cd799439011' } };
    const res = mockRes();
    await workbasketController.createDefaultRouting(req, res);
    expect(ensureDefaultRoutingForFirm).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
