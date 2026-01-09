const mongoose = require('mongoose');

/**
 * Email Metadata Model for Docketra Case Management System
 * 
 * Stores metadata for email attachments (both inbound emails and uploaded .eml/.msg files)
 * Links to the Attachment model via attachmentId
 * 
 * IMMUTABLE - NO UPDATES OR DELETES ALLOWED
 */

const emailMetadataSchema = new mongoose.Schema({
  /**
   * Reference to the attachment record
   * Links to Attachment._id
   */
  attachmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attachment',
    required: [true, 'Attachment ID is required'],
    index: true,
  },
  
  /**
   * Sender email address (from 'From' header)
   * Normalized: lowercase, trimmed
   * Used for internal vs external classification
   */
  fromEmail: {
    type: String,
    required: [true, 'Sender email is required'],
    lowercase: true,
    trim: true,
  },
  
  /**
   * Sender display name (from 'From' header)
   * Optional - may not be present in all emails
   */
  fromName: {
    type: String,
    trim: true,
  },
  
  /**
   * Email subject line
   */
  subject: {
    type: String,
    trim: true,
  },
  
  /**
   * Unique message ID from email headers
   * Used for deduplication and tracking
   */
  messageId: {
    type: String,
    trim: true,
  },
  
  /**
   * When the email was received by the mail server
   * Server-generated timestamp
   */
  receivedAt: {
    type: Date,
    required: [true, 'Received date is required'],
    default: Date.now,
  },
  
  /**
   * Raw email headers (JSON)
   * Stored for audit and debugging purposes
   */
  headers: {
    type: mongoose.Schema.Types.Mixed,
  },
  
  /**
   * Email body (plain text)
   * Optional - may be extracted for search/display
   */
  bodyText: {
    type: String,
  },
  
  /**
   * Email body (HTML)
   * Optional - may be extracted for display
   */
  bodyHtml: {
    type: String,
  },
  
  /**
   * When this metadata record was created
   * Immutable to prevent tampering
   */
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
}, {
  strict: true,
  timestamps: false,
});

/**
 * Pre-update Hooks: Prevent Updates
 */
emailMetadataSchema.pre('updateOne', function(next) {
  next(new Error('Email metadata cannot be updated. Records are immutable.'));
});

emailMetadataSchema.pre('findOneAndUpdate', function(next) {
  next(new Error('Email metadata cannot be updated. Records are immutable.'));
});

emailMetadataSchema.pre('updateMany', function(next) {
  next(new Error('Email metadata cannot be updated. Records are immutable.'));
});

/**
 * Pre-delete Hooks: Prevent Deletes
 */
emailMetadataSchema.pre('deleteOne', function(next) {
  next(new Error('Email metadata cannot be deleted. Records are immutable.'));
});

emailMetadataSchema.pre('deleteMany', function(next) {
  next(new Error('Email metadata cannot be deleted. Records are immutable.'));
});

emailMetadataSchema.pre('findOneAndDelete', function(next) {
  next(new Error('Email metadata cannot be deleted. Records are immutable.'));
});

/**
 * Performance Indexes
 */
emailMetadataSchema.index({ messageId: 1 });
emailMetadataSchema.index({ fromEmail: 1 });
emailMetadataSchema.index({ receivedAt: -1 });

module.exports = mongoose.model('EmailMetadata', emailMetadataSchema);
