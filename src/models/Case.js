const mongoose = require('mongoose');

/**
 * Case Model
 * Represents a case/project that can contain multiple tasks
 * Includes client information and comprehensive audit trail
 */

const caseSchema = new mongoose.Schema({
  caseNumber: {
    type: String,
    required: [true, 'Case number is required'],
    unique: true,
    trim: true,
  },
  title: {
    type: String,
    required: [true, 'Case title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [5000, 'Description cannot exceed 5000 characters'],
  },
  status: {
    type: String,
    enum: ['open', 'active', 'on_hold', 'closed', 'archived'],
    default: 'open',
    required: true,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    required: true,
  },
  client: {
    name: {
      type: String,
      required: [true, 'Client name is required'],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    phone: {
      type: String,
      trim: true,
    },
    organization: {
      type: String,
      trim: true,
    },
  },
  assignedTeam: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  leadConsultant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  targetCloseDate: {
    type: Date,
  },
  actualCloseDate: {
    type: Date,
  },
  estimatedBudget: {
    type: Number,
    min: [0, 'Budget cannot be negative'],
  },
  actualCost: {
    type: Number,
    min: [0, 'Cost cannot be negative'],
  },
  tags: [{
    type: String,
    trim: true,
  }],
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
  notes: [{
    content: {
      type: String,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
}, {
  timestamps: true,
});

// Indexes for performance
caseSchema.index({ status: 1, priority: -1 });
caseSchema.index({ leadConsultant: 1, status: 1 });
caseSchema.index({ 'client.name': 1 });
caseSchema.index({ targetCloseDate: 1 });

// Pre-save middleware to track status changes
caseSchema.pre('save', async function() {
  if (this.isModified('status') && !this.isNew) {
    // Only add to history if this is an update, not a new document
    this.statusHistory.push({
      status: this.status,
      changedBy: this.updatedBy || this.createdBy,
      changedAt: new Date(),
    });
  }
  
  // Set actualCloseDate when case is closed
  if (this.status === 'closed' && !this.actualCloseDate) {
    this.actualCloseDate = new Date();
  }
});

// Virtual for related tasks
caseSchema.virtual('tasks', {
  ref: 'Task',
  localField: '_id',
  foreignField: 'case',
});

module.exports = mongoose.model('Case', caseSchema);
