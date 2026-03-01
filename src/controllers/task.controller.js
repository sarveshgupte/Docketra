const wrapWriteHandler = require('../middleware/wrapWriteHandler');
const taskService = require('../services/task.service');

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
    res.status(500).json({
      success: false,
      error: 'Error fetching tasks',
      message: error.message,
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
    res.status(500).json({
      success: false,
      error: 'Error fetching task',
      message: error.message,
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
    res.status(400).json({
      success: false,
      error: 'Error creating task',
      message: error.message,
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
    res.status(400).json({
      success: false,
      error: 'Error updating task',
      message: error.message,
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
    res.status(500).json({
      success: false,
      error: 'Error deleting task',
      message: error.message,
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
    res.status(500).json({
      success: false,
      error: 'Error fetching task statistics',
      message: error.message,
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
