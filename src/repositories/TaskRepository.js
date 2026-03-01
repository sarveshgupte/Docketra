const Task = require('../models/Task');
const { softDelete } = require('../services/softDelete.service');

const assertTenantId = (firmId) => {
  if (!firmId) {
    throw new Error('TenantId required');
  }
};

const TaskRepository = {
  find(firmId, query = {}, { page = 1, limit = 20 } = {}) {
    assertTenantId(firmId);
    return Task.find({ firmId, ...query })
      .populate('assignedTo', 'name email')
      .populate('case', 'caseNumber title')
      .populate('createdBy', 'name email')
      .limit(limit)
      .skip((page - 1) * limit)
      .sort({ priority: -1, dueDate: 1, createdAt: -1 });
  },

  count(firmId, query = {}) {
    assertTenantId(firmId);
    return Task.countDocuments({ firmId, ...query });
  },

  findById(firmId, id) {
    assertTenantId(firmId);
    if (!id) return null;
    return Task.findOne({ _id: id, firmId })
      .populate('assignedTo', 'name email role')
      .populate('case', 'caseNumber title status')
      .populate('createdBy', 'name email')
      .populate('statusHistory.changedBy', 'name email');
  },

  create(firmId, data) {
    assertTenantId(firmId);
    return Task.create({ ...data, firmId });
  },

  softDeleteById(firmId, id, req, reason) {
    assertTenantId(firmId);
    if (!id) return null;
    return softDelete({
      model: Task,
      filter: { _id: id, firmId },
      req,
      reason,
    });
  },

  aggregateByStatus(firmId) {
    assertTenantId(firmId);
    return Task.aggregate([
      { $match: { firmId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);
  },

  aggregateByPriority(firmId) {
    assertTenantId(firmId);
    return Task.aggregate([
      { $match: { firmId } },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 },
        },
      },
    ]);
  },
};

module.exports = TaskRepository;
