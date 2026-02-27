const Case = require('../models/Case.model');
const Task = require('../models/Task');

/**
 * Clone tasks from a template case into a target case
 * @param {string|ObjectId} caseId target case _id
 * @param {string|ObjectId} templateId template case _id
 */
const applyTemplate = async (caseId, templateId) => {
  const [targetCase, templateCase] = await Promise.all([
    Case.findById(caseId).lean(),
    Case.findById(templateId).lean(),
  ]);

  if (!targetCase) throw new Error('Target case not found');
  if (!templateCase || !templateCase.isTemplate) throw new Error('Template case not found');

  const templateTasks = await Task.find({ case: templateCase._id }).lean();
  if (!templateTasks.length) return [];

  const clonedTasks = templateTasks.map((task) => ({
    title: task.title,
    description: task.description,
    firmId: targetCase.firmId,
    status: 'pending',
    priority: task.priority || 'medium',
    assignedTo: task.assignedTo || undefined,
    case: targetCase._id,
    dueDate: task.dueDate || undefined,
    estimatedHours: task.estimatedHours || undefined,
    tags: task.tags || [],
    createdBy: task.createdBy,
    updatedBy: task.updatedBy || task.createdBy,
    statusHistory: [],
  }));

  return Task.insertMany(clonedTasks);
};

module.exports = { applyTemplate };
