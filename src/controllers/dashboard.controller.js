const userRepository = require('../repositories/user.repository');
const clientRepository = require('../repositories/client.repository');
const caseRepository = require('../repositories/case.repository');
const categoryRepository = require('../repositories/category.repository');
const { assertFirmContext } = require('../utils/tenantGuard');

const getDashboardSummary = async (req, res) => {
  try {
    assertFirmContext(req);
    const firmId = req.user.firmId;

    const [users, clients, cases, categories] = await Promise.all([
      userRepository.countUsers(firmId, { isActive: true }),
      clientRepository.countClients(firmId),
      caseRepository.countCases(firmId),
      categoryRepository.countCategories(firmId),
    ]);

    const data = {
      users: users || 0,
      clients: clients || 0,
      cases: cases || 0,
      categories: categories || 0,
    };

    return res.json({
      success: true,
      data,
      count: Object.values(data).reduce((sum, value) => sum + value, 0),
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Error fetching dashboard summary',
      data: {},
      count: 0,
    });
  }
};

module.exports = {
  getDashboardSummary,
};
