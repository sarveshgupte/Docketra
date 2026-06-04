const TaskRepository = require('../repositories/TaskRepository');
const taskNarrativeStorage = require('./taskNarrativeStorage.service');

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

function buildNarrativePayload({ firmId, task, payload, updatedBy }) {
  return {
    schemaVersion: 1,
    firmId: String(firmId),
    taskId: String(task._id),
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || 'SYSTEM',
    narrativeVersion: Number(task?.taskRef?.version || 0) + 1,
    narrative: {
      description: payload?.description ?? task?.description ?? '',
      notes: payload?.notes || '',
      instructions: payload?.instructions || '',
      checklist: Array.isArray(payload?.checklist) ? payload.checklist : [],
      details: payload?.details || null,
    },
  };
}

async function persistTaskNarrative({ firmId, task, payload, updatedBy }) {
  const narrativePayload = buildNarrativePayload({ firmId, task, payload, updatedBy });
  const taskRef = await taskNarrativeStorage.uploadNarrative({ firmId, taskId: narrativePayload.taskId, payload: narrativePayload });
  task.taskRef = {
    provider: taskRef.provider,
    mode: taskRef.mode,
    fileId: taskRef.fileId,
    objectKey: taskRef.objectKey,
    checksum: taskRef.checksum,
    version: narrativePayload.narrativeVersion,
    updatedAt: new Date(),
    updatedBy: narrativePayload.updatedBy,
  };
  task.taskStorageMode = 'cloud_first';
}

const getTasks = async (firmId, queryParams = {}) => {
  const page = toInt(queryParams.page, 1);
  const limit = toInt(queryParams.limit, 20);
  const query = buildTaskQuery(queryParams);
  const [tasks, total] = await Promise.all([TaskRepository.find(firmId, query, { page, limit }), TaskRepository.count(firmId, query)]);
  return { tasks, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

const getTaskById = async (firmId, taskId) => {
  const task = await TaskRepository.findById(firmId, taskId);
  if (!task) return null;
  if (task?.taskRef?.provider) {
    try {
      const hydrated = await taskNarrativeStorage.readNarrative({ firmId, taskRef: task.taskRef });
      const narrative = hydrated?.narrative || {};
      if (Object.prototype.hasOwnProperty.call(narrative, 'description')) task.description = narrative.description;
      if (Object.prototype.hasOwnProperty.call(narrative, 'notes')) task.notes = narrative.notes;
      if (Object.prototype.hasOwnProperty.call(narrative, 'instructions')) task.instructions = narrative.instructions;
      if (Object.prototype.hasOwnProperty.call(narrative, 'checklist')) task.checklist = narrative.checklist;
      task.taskStorageMode = 'cloud_first';
    } catch (_error) {
      task.taskWarning = 'task_content_unavailable';
    }
  }
  return task;
};

const createTask = async (firmId, payload) => {
  const { description, ...restPayload } = payload || {};
  const task = await TaskRepository.create(firmId, restPayload);
  await persistTaskNarrative({ firmId, task, payload: { ...payload, description }, updatedBy: payload?.updatedBy || payload?.createdBy || 'SYSTEM' });
  task.description = undefined;
  await task.save();
  await task.populate('assignedTo', 'name email');
  return task;
};

const updateTask = async (firmId, taskId, payload) => {
  const task = await TaskRepository.findById(firmId, taskId);
  if (!task) return null;
  const { title, description, status, priority, assignedTo, dueDate, estimatedHours, actualHours, tags, updatedBy } = payload;
  if (title) task.title = title;
  if (status) task.status = status;
  if (priority) task.priority = priority;
  if (assignedTo !== undefined) task.assignedTo = assignedTo;
  if (dueDate !== undefined) task.dueDate = dueDate;
  if (estimatedHours !== undefined) task.estimatedHours = estimatedHours;
  if (actualHours !== undefined) task.actualHours = actualHours;
  if (tags) task.tags = tags;
  task.updatedBy = updatedBy;
  await persistTaskNarrative({ firmId, task, payload, updatedBy: updatedBy || 'SYSTEM' });
  task.description = undefined;
  await task.save();
  await task.populate('assignedTo', 'name email');
  return task;
};

const deleteTask = (firmId, taskId, req, reason) => TaskRepository.softDeleteById(firmId, taskId, req, reason);
const getTaskStats = async (firmId) => {
  const [byStatus, byPriority] = await Promise.all([TaskRepository.aggregateByStatus(firmId), TaskRepository.aggregateByPriority(firmId)]);
  return { byStatus, byPriority };
};

module.exports = { getTasks, getTaskById, createTask, updateTask, deleteTask, getTaskStats, persistTaskNarrative };
