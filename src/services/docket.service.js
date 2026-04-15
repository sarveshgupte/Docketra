const Team = require('../models/Team.model');
const User = require('../models/User.model');

// Re-export updateStatus from case.service so callers can import either file.
const { updateStatus } = require('./case.service');

const normalizeCreateInput = (body = {}) => ({
  title: typeof body.title === 'string' ? body.title.trim() : '',
  description: typeof body.description === 'string' ? body.description.trim() : '',
  categoryId: body.categoryId || null,
  subcategoryId: body.subcategoryId || null,
  workbasketId: body.workbasketId || null,
  priority: typeof body.priority === 'string' && body.priority.trim() ? body.priority.trim().toLowerCase() : 'medium',
  assignedTo: typeof body.assignedTo === 'string' && body.assignedTo.trim() ? body.assignedTo.trim().toUpperCase() : null,
});

const validateStructuredInput = ({ title, workbasketId, categoryId, subcategoryId }) => {
  if (!title) {
    const error = new Error('Title is required');
    error.statusCode = 400;
    throw error;
  }

  if (!workbasketId) {
    const error = new Error('Workbasket is required');
    error.statusCode = 400;
    throw error;
  }

  if (!categoryId && subcategoryId) {
    const error = new Error('Subcategory cannot be provided without category');
    error.statusCode = 400;
    throw error;
  }
};

const resolveAssigneeFromWorkbasketRules = async ({ firmId, workbasketId, assignedTo }) => {
  if (assignedTo) return assignedTo;

  const team = await Team.findOne({ _id: workbasketId, firmId, isActive: true }).select('managerId').lean();
  if (!team) return null;
  if (!team.managerId) return null;

  const manager = await User.findOne({ _id: team.managerId, firmId, status: { $ne: 'deleted' } }).select('xID').lean();
  return manager?.xID ? String(manager.xID).toUpperCase() : null;
};

module.exports = {
  normalizeCreateInput,
  validateStructuredInput,
  resolveAssigneeFromWorkbasketRules,
  // Docket lifecycle management
  updateStatus,
};
