const TaskRepository = require('../repositories/TaskRepository');

const toInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const buildTaskQuery = ({ status, priority, assignedTo, case: caseId }) => {
  const query = {};
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (assignedTo) query.assignedTo = assignedTo;
  if (caseId) query.case = caseId;
  return query;
};

const getTasks = async (firmId, queryParams = {}) => {
  const page = toInt(queryParams.page, 1);
  const limit = toInt(queryParams.limit, 20);
  const query = buildTaskQuery(queryParams);

  const tasks = await TaskRepository.find(firmId, query, { page, limit });
  const total = await TaskRepository.count(firmId, query);

  return {
    tasks,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

const getTaskById = (firmId, taskId) => TaskRepository.findById(firmId, taskId);

const createTask = async (firmId, payload) => {
  const task = await TaskRepository.create(firmId, payload);
  await task.populate('assignedTo', 'name email');
  return task;
};

const updateTask = async (firmId, taskId, payload) => {
  const task = await TaskRepository.findById(firmId, taskId);
  if (!task) return null;

  const {
    title,
    description,
    status,
    priority,
    assignedTo,
    dueDate,
    estimatedHours,
    actualHours,
    tags,
    updatedBy,
  } = payload;

  if (title) task.title = title;
  if (description !== undefined) task.description = description;
  if (status) task.status = status;
  if (priority) task.priority = priority;
  if (assignedTo !== undefined) task.assignedTo = assignedTo;
  if (dueDate !== undefined) task.dueDate = dueDate;
  if (estimatedHours !== undefined) task.estimatedHours = estimatedHours;
  if (actualHours !== undefined) task.actualHours = actualHours;
  if (tags) task.tags = tags;
  task.updatedBy = updatedBy;

  await task.save();
  await task.populate('assignedTo', 'name email');
  return task;
};

const deleteTask = (firmId, taskId, req, reason) => TaskRepository.softDeleteById(firmId, taskId, req, reason);

const getTaskStats = async (firmId) => {
  const [byStatus, byPriority] = await Promise.all([
    TaskRepository.aggregateByStatus(firmId),
    TaskRepository.aggregateByPriority(firmId),
  ]);

  return { byStatus, byPriority };
};

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  getTaskStats,
};
