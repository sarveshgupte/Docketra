const { ensureDefaultRoutingForFirm } = require('../src/services/defaultRouting.service');
const User = require('../src/models/User.model');

jest.mock('../src/models/User.model', () => ({
  updateMany: jest.fn(),
  updateOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

describe('default routing membership safety', () => {
  test('default routing service does not mutate user workbasket memberships', async () => {
    await ensureDefaultRoutingForFirm(null);
    expect(User.updateMany).not.toHaveBeenCalled();
    expect(User.updateOne).not.toHaveBeenCalled();
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
