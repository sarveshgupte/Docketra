const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

/**
 * Task Model
 * Represents individual tasks within the system
 * Can be standalone or part of a case
 * Includes comprehensive audit trail
 */

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters'],
  },
  
  // Firm/Organization ID for multi-tenancy
  firmId: {
    type: String,
    required: [true, 'Firm ID is required'],
    index: true,
  },
  
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'review', 'completed', 'blocked', 'cancelled'],
    default: 'pending',
    required: true,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    required: true,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  case: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
  },
  dueDate: {
    type: Date,
  },
  completedAt: {
    type: Date,
  },
  estimatedHours: {
    type: Number,
    min: [0, 'Estimated hours cannot be negative'],
  },
  actualHours: {
    type: Number,
    min: [0, 'Actual hours cannot be negative'],
  },
  tags: [{
    type: String,
    trim: true,
  }],
  clientId: {
    type: String,
    trim: true,
  },
  clientName: {
    type: String,
    trim: true,
  },
  categoryId: {
    type: String,
    trim: true,
  },
  categoryName: {
    type: String,
    trim: true,
  },
  linkedCaseId: {
    type: String,
    trim: true,
  },
  calendarEntryType: {
    type: String,
    enum: ['important_date', 'holiday', 'birthday', 'working_day', 'off_day', null],
    default: null,
  },
  reminderDaysBefore: {
    type: Number,
    min: 0,
    max: 30,
    default: null,
  },
  recurrencePattern: {
    frequency: {
      type: String,
      enum: ['none', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', null],
      default: null,
    },
    interval: {
      type: Number,
      min: 1,
      max: 52,
      default: null,
    },
    untilDate: {
      type: Date,
      default: null,
    },
  },
  taskRef: {
    provider: { type: String, trim: true },
    mode: { type: String, enum: ['firm_connected', 'managed_fallback'] },
    fileId: { type: String, trim: true, default: null },
    objectKey: { type: String, trim: true, default: null },
    checksum: { type: String, trim: true },
    version: { type: Number, min: 1 },
    updatedAt: { type: Date },
    updatedBy: { type: String, trim: true },
  },
  taskStorageMode: {
    type: String,
    enum: ['cloud_first', 'legacy_mongo'],
    default: 'legacy_mongo',
  },
  // Audit trail fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  statusHistory: [{
    status: {
      type: String,
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    comment: String,
  }],
}, {
  timestamps: true,
});

// Indexes for performance
taskSchema.index({ status: 1, priority: -1 });
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ case: 1 });
taskSchema.index({ dueDate: 1 });
// REMOVED: { firmId: 1 } - redundant with compound index (firmId, status) below
taskSchema.index({ firmId: 1, status: 1 }); // Firm-scoped status queries
taskSchema.index({ firmId: 1, assignedTo: 1, status: 1 }); // Firm-scoped assignment queues
taskSchema.index({ firmId: 1, createdAt: -1 });
taskSchema.index({ firmId: 1, dueDate: 1, status: 1 }); // Firm-scoped due-date ordering/reporting
taskSchema.index({ firmId: 1, clientId: 1, status: 1 }); // Firm-scoped client worklist/report filters

// Pre-save middleware to track status changes
taskSchema.pre('save', async function() {
  if (this.isModified('status') && !this.isNew) {
    // Only add to history if this is an update, not a new document
    this.statusHistory.push({
      status: this.status,
      changedBy: this.updatedBy || this.createdBy,
      changedAt: new Date(),
    });
  }
  
  // Set completedAt when task is completed
  if (this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
});

function _sensitivePersistenceError(field) {
  const error = new Error(`BYOS_SENSITIVE_FIELD_PERSISTENCE_BLOCKED:${field}`);
  error.code = 'BYOS_SENSITIVE_FIELD_PERSISTENCE_BLOCKED';
  return error;
}

taskSchema.pre('validate', function() {
  const value = this.get('description');
  if (value !== null && value !== undefined && typeof value === 'string' && value.trim() !== '') {
    throw _sensitivePersistenceError('description');
  }
});

taskSchema.plugin(softDeletePlugin);

// VALIDATION: Strict schema enforcement
taskSchema.set('strict', true);

module.exports = mongoose.model('Task', taskSchema);
