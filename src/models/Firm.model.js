const mongoose = require('mongoose');
const { encrypt: encryptProtectedValue, isEncrypted } = require('../utils/encryption');

/**
 * Firm Model for Multi-Tenancy
 * 
 * Represents an organization/firm in the system.
 * Each user belongs to exactly one firm (immutable).
 * Firms provide tenant isolation across the system.
 * 
 * Key Features:
 * - Immutable firmId and name
 * - Read-only visibility for users
 * - Admin-controlled only
 */

const firmSchema = new mongoose.Schema({
  /**
   * Firm identifier
   * Format: FIRM001, FIRM002, etc.
   * IMMUTABLE - Cannot be changed after creation
   */
  firmId: {
    type: String,
    required: [true, 'Firm ID is required'],
    unique: true,
    uppercase: true,
    trim: true,
    immutable: true,
    match: [/^FIRM\d{3,}$/, 'firmId must be in format FIRM001'],
  },
  
  /**
   * Firm/Organization name
   * IMMUTABLE - Cannot be changed after creation
   */
  name: {
    type: String,
    required: [true, 'Firm name is required'],
    trim: true,
    immutable: true,
  },
  
  /**
   * Firm slug - URL-safe identifier for firm-scoped login
   * Format: lowercase-with-hyphens (e.g., "teekeet-store")
   * IMMUTABLE - Cannot be changed after creation
   * GLOBALLY UNIQUE - No two firms can have the same slug
   * Used in firm login URL: /f/:firmSlug/login
   */
  firmSlug: {
    type: String,
    required: [true, 'Firm slug is required'],
    unique: true,
    lowercase: true,
    trim: true,
    immutable: true,
    match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'firmSlug must be URL-safe (lowercase letters, numbers, and hyphens only)'],
  },

  /**
   * User who created this firm.
   */
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },

  /**
   * Logical storage provider selector for onboarding.
   */
  storageProvider: {
    type: String,
    default: 'docketra',
    lowercase: true,
    trim: true,
  },
  
  /**
   * Default Client ID - represents the firm itself
   * Every firm MUST have exactly one default client
   * This client is created automatically when the firm is created
   * REQUIRED - A firm cannot exist without its default client
   */
  defaultClientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: function() {
      // Allow initial creation inside a transaction, enforce thereafter
      return !this.isNew;
    },
    index: true,
  },
  
  /**
   * Firm status for lifecycle management
   * ACTIVE - Firm is operational
   * SUSPENDED - Firm is temporarily blocked from login (Superadmin action)
   * INACTIVE - Firm is disabled (soft delete)
   */

  billingOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },

  status: {
    type: String,
    enum: ['pending_setup', 'active', 'suspended'],
    default: 'pending_setup',
  },
  source: {
    type: String,
    enum: ['SUPERADMIN', 'SELF_SERVE'],
    default: 'SUPERADMIN',
    index: true,
  },

  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    default: null,
    index: true,
  },

  subscriptionStatus: {
    type: String,
    default: null,
  },


  plan: {
    type: String,
    lowercase: true,
    enum: ['starter', 'professional', 'enterprise', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'],
    default: 'starter',
    index: true,
  },

  maxUsers: {
    type: Number,
    default: 2,
  },

  billingStatus: {
    type: String,
    default: null,
  },



  /**
   * Canonical firm-level BYOS configuration (single source of truth).
   */
  storageConfig: {
    provider: {
      type: String,
      enum: ['google_drive', 'onedrive', 's3'],
      default: null,
    },
    credentials: {
      type: String,
      default: null,
    },
  },

  /**
   * Firm-level storage configuration
   * Defaults to Docketra-managed Google Drive (service account)
   */
  storage: {
    mode: {
      type: String,
      enum: ['docketra_managed', 'firm_connected'],
      default: 'docketra_managed',
    },
    provider: {
      type: String,
      default: null,
      validate: {
        validator: function(value) {
          const allowedProviders = ['google_drive', 'onedrive', 's3'];
        if (this.storage?.mode === 'firm_connected') {
          return value && allowedProviders.includes(value);
        }
        if (value === null || value === undefined) {
          return true;
        }
        return allowedProviders.includes(value);
        },
        message: 'Storage provider must be google_drive, onedrive, or s3 (required when storage mode is firm_connected)',
      },
    },
    google: {
      rootFolderId: { type: String, trim: true },
      encryptedRefreshToken: { type: String, trim: true },
      scopes: [{ type: String }],
    },
    onedrive: {
      driveId: { type: String, trim: true },
      encryptedRefreshToken: { type: String, trim: true },
      scopes: [{ type: String }],
    },
  },

  /**
   * Firm-level BYOAI configuration.
   * API keys are always encrypted at rest.
   */
  aiConfig: {
    enabled: {
      type: Boolean,
      default: false,
    },
    provider: {
      type: String,
      enum: ['openai', 'gemini', 'claude', null],
      default: null,
      lowercase: true,
      trim: true,
    },
    apiKey: {
      type: String,
      default: null,
    },
    model: {
      type: String,
      default: null,
      trim: true,
    },
    enabledFeatures: {
      documentAnalysis: { type: Boolean, default: true },
      docketDrafting: { type: Boolean, default: true },
      routingSuggestions: { type: Boolean, default: true },
    },
    roleAccess: {
      PRIMARY_ADMIN: { type: Boolean, default: true },
      ADMIN: { type: Boolean, default: true },
      MANAGER: { type: Boolean, default: true },
      USER: { type: Boolean, default: true },
    },
    retention: {
      zeroRetention: { type: Boolean, default: true },
      savePrompts: { type: Boolean, default: false },
      saveOutputs: { type: Boolean, default: false },
    },
    privacy: {
      redactErrors: { type: Boolean, default: true },
      verboseLogging: { type: Boolean, default: false },
    },
    quotas: {
      monthlyRequestLimit: { type: Number, min: 0, default: 0 },
      monthlyTokenLimit: { type: Number, min: 0, default: 0 },
      requestsThisMonth: { type: Number, min: 0, default: 0 },
      tokensThisMonth: { type: Number, min: 0, default: 0 },
      lastResetAt: { type: Date, default: null },
    },
    rateLimit: {
      requestsPerMinute: { type: Number, min: 0, default: 0 },
      burstLimit: { type: Number, min: 0, default: 0 },
    },
    credentialProvider: {
      type: String,
      enum: ['openai', 'gemini', 'claude', null],
      default: null,
      lowercase: true,
      trim: true,
    },
    credentialRef: {
      type: String,
      default: null,
      trim: true,
    },
    promptTemplates: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },

  /**
   * Firm-level admin settings (persisted server-side).
   * These values are used to drive UI defaults and workflow behavior.
   */
  settings: {
    firm: {
      slaDefaultDays: {
        type: Number,
        min: 1,
        default: 3,
      },
      escalationInactivityThresholdHours: {
        type: Number,
        min: 1,
        default: 24,
      },
      workloadThreshold: {
        type: Number,
        min: 1,
        default: 15,
      },
      enablePerformanceView: {
        type: Boolean,
        default: true,
      },
      enableEscalationView: {
        type: Boolean,
        default: true,
      },
      enableBulkActions: {
        type: Boolean,
        default: true,
      },
      brandLogoUrl: {
        type: String,
        trim: true,
        default: '',
      },
    },
    work: {
      assignmentStrategy: {
        type: String,
        enum: ['manual', 'balanced'],
        default: 'manual',
      },
      statusWorkflowMode: {
        type: String,
        enum: ['flexible', 'strict'],
        default: 'flexible',
      },
      autoAssignmentEnabled: {
        type: Boolean,
        default: false,
      },
      highPrioritySlaDays: {
        type: Number,
        min: 1,
        default: 1,
      },
      dueSoonWarningDays: {
        type: Number,
        min: 1,
        default: 2,
      },
    },
    storageBackup: {
      enabled: {
        type: Boolean,
        default: false,
      },
      notificationRecipients: {
        type: [String],
        default: [],
      },
      deliveryPolicy: {
        type: String,
        enum: ['link_only', 'attachment'],
        default: 'link_only',
      },
      retentionDays: {
        type: Number,
        min: 1,
        max: 3650,
        default: 30,
      },
    },
  },
  
  /**
   * Bootstrap status for firm onboarding lifecycle
   * 
   * PR-2: Bootstrap Atomicity & Identity Decoupling
   * Tracks the completion state of firm initialization
   * 
   * PENDING - Firm is being created, not ready for use
   * COMPLETED - Firm fully initialized (has default client and admin)
   * FAILED - Firm creation failed, requires manual intervention
   * 
   * Admin login is blocked until bootstrapStatus = COMPLETED
   * This prevents ghost firms and ensures data integrity
   */


  isSetupComplete: {
    type: Boolean,
    default: false,
    index: true,
  },

  setupMetadata: {
    categories: { type: Number, default: 0 },
    workbaskets: { type: Number, default: 0 },
    templateKey: { type: String, default: null, trim: true },
    completedAt: { type: Date, default: null },
  },
  bootstrapStatus: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
    default: 'PENDING',
    index: true,
  },
  
  /**
   * Audit trail for firm creation
   */
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Indexes for performance
// Note: firmId and firmSlug already have unique indexes from schema definition
firmSchema.index({ status: 1 });
firmSchema.index({ createdAt: -1 });

/**
 * PRE-SAVE HOOK: Enforce firm hierarchy guardrails
 * 
 * Prevents saving firms in COMPLETED status without defaultClientId
 * This guardrail ensures data integrity and prevents incomplete firm hierarchies
 */
// IMPORTANT: Async Mongoose middleware should not use `next`; use throw/return to avoid `next is not a function` and double-callback issues
firmSchema.pre('save', async function() {
  // GUARDRAIL: Firm with COMPLETED bootstrap must have defaultClientId
  if (this.bootstrapStatus === 'COMPLETED' && !this.defaultClientId) {
    const error = new Error(
      'Cannot mark firm as COMPLETED without defaultClientId. ' +
      'Firm hierarchy requires: Firm → Default Client → Admins'
    );
    error.name = 'ValidationError';
    throw error;
  }

  if (this.aiConfig?.apiKey && !isEncrypted(this.aiConfig.apiKey)) {
    this.aiConfig.apiKey = encryptProtectedValue(this.aiConfig.apiKey);
  }
});

module.exports = mongoose.model('Firm', firmSchema);
