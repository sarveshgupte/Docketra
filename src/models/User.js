const mongoose = require('mongoose');

/**
 * User Model
 * Represents users who can be assigned to tasks and cases
 * Includes audit trail fields
 */

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
  },
  role: {
    type: String,
    enum: ['admin', 'manager', 'consultant', 'client'],
    default: 'consultant',
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  // Audit trail fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
});

// Indexes for performance
// Note: email already has unique index from schema definition
userSchema.index({ isActive: 1 });

// Instance method to get safe user data (without sensitive info)
userSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  return {
    id: obj._id,
    name: obj.name,
    email: obj.email,
    role: obj.role,
    isActive: obj.isActive,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

module.exports = mongoose.model('User', userSchema);
