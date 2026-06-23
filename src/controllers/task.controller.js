const wrapWriteHandler = require('../middleware/wrapWriteHandler');
const taskService = require('../services/task.service');
const log = require('../utils/log');

/**
 * Task Controller
 * Handles all task-related business logic
 */

/**
 * Get all tasks with filtering and pagination
 */
const getTasks = async (req, res) => {
  try {
    const firmId = req.firmId || req.user?.firmId;
    const { tasks, pagination } = await taskService.getTasks(firmId, req.query);
    
    res.json({
      success: true,
      data: tasks,
      pagination,
    });
  } catch (error) {
    log.error('[task.controller] Error fetching tasks', { error });
    res.status(500).json({
      success: false,
      error: 'Error fetching tasks',
      message: 'An internal error occurred while fetching tasks',
    });
  }
};

/**
 * Get single task by ID
 */
const getTaskById = async (req, res) => {
  try {
    const firmId = req.firmId || req.user?.firmId;
    const task = await taskService.getTaskById(firmId, req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }
    
    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    log.error('[task.controller] Error fetching task', { taskId: req.params.id, error });
    res.status(500).json({
      success: false,
      error: 'Error fetching task',
      message: 'An internal error occurred while fetching the task',
    });
  }
};

/**
 * Create new task
 */
const createTask = async (req, res) => {
  try {
    const firmId = req.firmId || req.user?.firmId;
    const task = await taskService.createTask(firmId, req.body);
    
    res.status(201).json({
      success: true,
      data: task,
      message: 'Task created successfully',
    });
  } catch (error) {
    log.error('[task.controller] Error creating task', { error });
    res.status(400).json({
      success: false,
      error: 'Error creating task',
      message: 'An internal error occurred while creating the task',
    });
  }
};

/**
 * Update task
 */
const updateTask = async (req, res) => {
  try {
    const firmId = req.firmId || req.user?.firmId;
    const task = await taskService.updateTask(firmId, req.params.id, req.body);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }
    
    res.json({
      success: true,
      data: task,
      message: 'Task updated successfully',
    });
  } catch (error) {
    log.error('[task.controller] Error updating task', { taskId: req.params.id, error });
    res.status(400).json({
      success: false,
      error: 'Error updating task',
      message: 'An internal error occurred while updating the task',
    });
  }
};

/**
 * Delete task
 */
const deleteTask = async (req, res) => {
  try {
    const firmId = req.firmId || req.user?.firmId;
    const task = await taskService.deleteTask(firmId, req.params.id, req, req.body?.reason || 'Task deleted');
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }
    
    res.json({
      success: true,
      message: 'Task soft deleted successfully',
    });
  } catch (error) {
    log.error('[task.controller] Error deleting task', { taskId: req.params.id, error });
    res.status(500).json({
      success: false,
      error: 'Error deleting task',
      message: 'An internal error occurred while deleting the task',
    });
  }
};

/**
 * Get task statistics
 */
const getTaskStats = async (req, res) => {
  try {
    const firmId = req.firmId || req.user?.firmId;
    const stats = await taskService.getTaskStats(firmId);
    
    res.json({
      success: true,
      data: {
        byStatus: stats.byStatus,
        byPriority: stats.byPriority,
      },
    });
  } catch (error) {
    log.error('[task.controller] Error fetching task statistics', { error });
    res.status(500).json({
      success: false,
      error: 'Error fetching task statistics',
      message: 'An internal error occurred while fetching task statistics',
    });
  }
};

module.exports = {
  getTasks,
  getTaskById,
  createTask: wrapWriteHandler(createTask),
  updateTask: wrapWriteHandler(updateTask),
  deleteTask: wrapWriteHandler(deleteTask),
  getTaskStats,
};
