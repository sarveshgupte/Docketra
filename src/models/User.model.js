const mongoose = require('mongoose');
const crypto = require('crypto');
const softDeletePlugin = require('../utils/softDelete.plugin');
const { encrypt: encryptProtectedValue, isEncrypted } = require('../utils/encryption');
const { normalizeRole } = require('../utils/role.utils');
const { getTagValidationError, normalizeId } = require('../utils/hierarchy.utils');
// NOTE: If upgrading from previous version,
// ensure MongoDB global unique index on { email: 1 } is dropped:
// db.users.dropIndex("email_1")

/**
 * User Model for Docketra Case Management System
 * Represents users with role-based access control and xID-based authentication
 * Supports Admin (full access) and Employee (category-restricted access)
 * 
 * Key Features:
 * - xID-based authentication (X123456 format)
 * - Immutable xID and name fields
 * - Password expiry and history tracking
 * - Enterprise-grade identity management
 */

const userSchema = new mongoose.Schema({
  // Enterprise employee number - PRIMARY login identifier
  // Format: X followed by 6 digits (e.g., X000001, X000002)
  // IMMUTABLE - Cannot be changed after creation
  // FIRM-SCOPED - Each firm starts with X000001
  xID: {
    type: String,
    required: [true, 'xID is required'],
    uppercase: true,
    match: [/^X\d{6}$/, 'xID must be in format X123456'],
    immutable: true,
  },

  // Internal alias retained for backward compatibility with legacy payloads/claims.
  // Always mirrors xID and must never diverge from it.
  xid: {
    type: String,
    uppercase: true,
    trim: true,
    match: [/^X\d{6}$/, 'xid must be in format X123456'],
  },

  // UUID identity key for external references
  id: {
    type: String,
    default: () => crypto.randomUUID(),
    unique: true,
    immutable: true,
    index: true,
  },
  
  // User's full name
  // IMMUTABLE - Cannot be changed after creation
  name: {
    type: String,
    required: [true, 'Name is required'],
  },

  department: {
    type: String,
    trim: true,
    default: null,
  },


  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    index: true,
    default: null,
  },
  teamIds: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Team',
    default: [],
  },
  
  // Email address - REQUIRED for password setup emails
  // Used for notifications, contact, and password setup
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
  },

  primary_email: {
    type: String,
    lowercase: true,
    trim: true,
  },

  is_verified: {
    type: Boolean,
    default: false,
  },

  emailVerified: {
    type: Boolean,
    default: false,
  },

  emailVerifiedAt: {
    type: Date,
    default: null,
  },

  verificationMethod: {
    type: String,
    enum: ['OTP', 'GOOGLE'],
    default: 'OTP',
  },

  termsAccepted: {
    type: Boolean,
    default: false,
  },

  termsAcceptedAt: {
    type: Date,
    default: Date.now,
  },

  termsVersion: {
    type: String,
    default: 'v1.0',
  },

  signupIP: {
    type: String,
    default: null,
  },

  signupUserAgent: {
    type: String,
    default: null,
  },


  phoneNumber: {
    type: String,
    default: null,
    trim: true,
  },

  isOnboarded: {
    type: Boolean,
    default: false,
    index: true,
  },
  
  // Firm/Organization ID for multi-tenancy
  // All users belong to a firm - enforces data isolation
  // IMMUTABLE - Users cannot change firms
  // NOTE: SUPER_ADMIN role has null firmId (platform-level access)
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: function() {
      // firmId is required for Admin and Employee, but not for SUPER_ADMIN
      return this.role !== 'SUPER_ADMIN' && this.isOnboarded === true;
    },
    immutable: true,
  },
  
  /**
   * Default Client ID for multi-tenancy
   * 
   * PR-2: Bootstrap Atomicity & Identity Decoupling
   * - OPTIONAL during firm bootstrap (allows admin creation before default client)
   * - Can be null temporarily during firm onboarding
   * - Must be set before admin can login (enforced in auth flow)
   * - SUPER_ADMIN always has null defaultClientId (platform-level access)
   * 
   * For Admins, this should eventually point to the Firm's default client
   * For Employees, this points to their assigned default client
   */
  defaultClientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    default: null,
    immutable: true, // Cannot change default client after creation
    index: true,
  },

  clientAccess: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Client',
    default: [],
  },
  
  // Determines access level: SUPER_ADMIN manages platform, Admin has full firm access, Employee has category-restricted access
  role: {
    type: String,
    enum: ['SUPER_ADMIN', 'PRIMARY_ADMIN', 'ADMIN', 'MANAGER', 'USER'],
    default: 'USER',
    required: true,
    set: (value) => {
      const normalized = String(value || '').trim();
      if (normalized === 'Admin') return 'ADMIN';
      if (normalized === 'Employee') return 'USER';
      return normalized;
    },
  },
  
  // Controls which case categories an Employee can access; empty array for Admin means access to all
  allowedCategories: {
    type: [String],
    default: [],
  },
  
  // Soft delete mechanism; allows disabling users without removing data
  // Also called 'active' in some contexts
  isActive: {
    type: Boolean,
    default: true,
  },
  
  // Login protection: track failed login attempts
  failedLoginAttempts: {
    type: Number,
    default: 0,
  },
  
  // Login protection: timestamp until which account is locked
  lockUntil: {
    type: Date,
    default: null,
  },

  // Last successful login details for suspicious activity monitoring
  lastLoginAt: {
    type: Date,
    default: null,
  },

  lastLoginIp: {
    type: String,
    default: null,
  },

  lastLoginCountry: {
    type: String,
    default: null,
  },

  // Product update modal tracking (latest "What's New" seen by this user)
  lastSeenUpdateId: {
    type: String,
    default: null,
  },

  // First-login tutorial completion marker
  tutorialCompletedAt: {
    type: Date,
    default: null,
  },

  // Role-aware onboarding state (completion + replay analytics)
  tutorialState: {
    seenAt: { type: Date, default: null },
    skippedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    role: { type: String, default: null },
    lastStepIndex: { type: Number, default: 0 },
  },

  // Lightweight onboarding progress snapshot to avoid duplicate analytics writes.
  onboardingTelemetry: {
    lastProgressRefreshedAt: { type: Date, default: null },
    lastProgressRole: { type: String, default: null },
    lastCompletedStepIds: { type: [String], default: [] },
    lastIncompleteStepIds: { type: [String], default: [] },
    lastProgressCompleted: { type: Number, default: 0 },
    lastProgressTotal: { type: Number, default: 0 },
  },

  /**
   * Authentication providers
   * LOCAL: password-based auth (authoritative for SuperAdmin and platform users)
   * GOOGLE: OAuth-based auth (invite-only, DB-backed users only)
   */
  authProviders: {
    local: {
      passwordHash: { type: String, default: null },
      passwordSet: { type: Boolean, default: false },
    },
    google: {
      googleId: { type: String, default: null },
      linkedAt: { type: Date, default: null },
    }
  },

  // TOTP secret for MFA (stored per user when enabled)
  twoFactorSecret: {
    type: String,
    default: null,
  },

  loginOtpHash: {
    type: String,
    default: null,
  },

  loginOtpExpiresAt: {
    type: Date,
    default: null,
  },

  loginOtpAttempts: {
    type: Number,
    default: 0,
  },

  loginOtpLastSentAt: {
    type: Date,
    default: null,
  },

  loginOtpResendCount: {
    type: Number,
    default: 0,
  },

  loginOtpLockedUntil: {
    type: Date,
    default: null,
  },

  forgotPasswordOtpHash: {
    type: String,
    default: null,
  },

  forgotPasswordOtpExpiresAt: {
    type: Date,
    default: null,
  },

  forgotPasswordOtpAttempts: {
    type: Number,
    default: 0,
  },

  forgotPasswordOtpLastSentAt: {
    type: Date,
    default: null,
  },

  forgotPasswordOtpLockedUntil: {
    type: Date,
    default: null,
  },

  forgotPasswordOtpResendCount: {
    type: Number,
    default: 0,
  },

  forgotPasswordResetTokenHash: {
    type: String,
    default: null,
  },

  forgotPasswordResetTokenExpiresAt: {
    type: Date,
    default: null,
  },

  // Bcrypt hashed password - null until user sets password via email link
  passwordHash: {
    type: String,
    default: null,
  },
  
  // Indicates if user has set their password (via email link)
  passwordSet: {
    type: Boolean,
    default: false,
  },

  // Onboarding guard: blocks access until password is explicitly set
  mustSetPassword: {
    type: Boolean,
    default: false,
  },

  // Timestamp when password was set for the first time
  passwordSetAt: {
    type: Date,
    default: null,
  },
  // NOTE:
  // mustSetPassword is the authoritative onboarding guard.
  // passwordSet is legacy and MUST NOT be used for auth decisions.
  
  // Secure token hash for password setup / invite (stored as hash, never plain text)
  // Also serves as invite token for new user onboarding
  passwordSetupTokenHash: {
    type: String,
    default: null,
  },
  
  // Alias for invite token (points to same field as passwordSetupTokenHash)
  inviteTokenHash: {
    type: String,
    default: null,
    get: function() { return this.passwordSetupTokenHash; },
    set: function(value) { this.passwordSetupTokenHash = value; },
  },
  
  // Expiry timestamp for password setup / invite token (e.g., 48 hours from creation)
  passwordSetupExpires: {
    type: Date,
    default: null,
  },
  
  // Alias for invite token expiry (points to same field as passwordSetupExpires)
  inviteTokenExpiry: {
    type: Date,
    default: null,
    get: function() { return this.passwordSetupExpires; },
    set: function(value) { this.passwordSetupExpires = value; },
  },
  
  // Timestamp of last password change
  passwordLastChangedAt: {
    type: Date,
    default: Date.now,
  },
  
  // Password expires 60 days after last change
  // Not required for invited users who haven't set password yet
  passwordExpiresAt: {
    type: Date,
    required: false,
    default: null,
  },
  
  // Store last 5 passwords to prevent reuse
  passwordHistory: [{
    hash: String,
    changedAt: Date,
  }],
  
  // Force password change on first login or after admin reset
  mustChangePassword: {
    type: Boolean,
    default: true,
  },
  
  // Flag to trigger password reset flow on successful login (for first login scenario)
  // When true, user can login but will be prompted to reset password via email
  forcePasswordReset: {
    type: Boolean,
    default: false,
  },
  
  // Token hash for password reset (for first login flow)
  passwordResetTokenHash: {
    type: String,
    default: null,
  },
  
  // Expiry timestamp for password reset token
  passwordResetExpires: {
    type: Date,
    default: null,
  },
  
  // Manager reference for hierarchical reporting structure (nullable)
  // Supports organizational hierarchy - employees can have a manager
  primaryAdminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },

  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },

  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },

  reportsToUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  
  /**
   * Client approval permission flag
   * When true, this user can approve client cases regardless of hierarchy
   * Top-most admins (managerId = null) OR users with canApproveClients = true can approve
   */
  canApproveClients: {
    type: Boolean,
    default: false,
  },
  
  /**
   * User account status for lifecycle management
   * INVITED - User created by admin, hasn't set password yet
   * ACTIVE - User has set password and can login
   * DISABLED - User account disabled by admin
   * DELETED - User soft-deleted from lifecycle operations
   */
  status: {
    type: String,
    // NOTE: "disabled" is the canonical API-facing term for suspended accounts.
    // "suspended" is retained for backward compatibility with existing records.
    enum: ['invited', 'active', 'disabled', 'suspended', 'deleted'],
    default: 'invited',
    required: true,
  },

  setupTokenHash: {
    type: String,
    default: null,
  },

  setupTokenExpiresAt: {
    type: Date,
    default: null,
  },

  setupTokenUsedAt: {
    type: Date,
    default: null,
  },
  
  /**
   * Timestamp when invite email was last sent
   * PR #48: Track when admin resends invite emails
   */
  inviteSentAt: {
    type: Date,
    default: null,
  },
  
  /**
   * System user flag - marks users created during firm onboarding
   * TRUE for the default admin user (X000001) created when a firm is onboarded
   * System users (isSystem=true) CANNOT be deleted or deactivated
   * This ensures firms always have at least one active admin
   */
  isSystem: {
    type: Boolean,
    default: false,
    immutable: true,
    index: true,
  },

  /**
   * Primary admin flag - marks the firm creator / first admin
   * TRUE for the admin created during public signup (firm onboarding)
   * Primary admin CANNOT be deactivated or deleted
   * Distinct from isSystem to allow clearer error messaging
   */
  isPrimaryAdmin: {
    type: Boolean,
    default: false,
    index: true,
  },
  
  /**
   * Client Access Restrictions (Admin-Managed Deny-List)
   * Array of client IDs (C123456 format) that this user CANNOT access
   * Default: empty array (user can access all clients)
   * Admin-only: Only admins can modify this field
   * 
   * Enforcement:
   * - Blocks case creation with restricted clients
   * - Filters restricted clients from case lists
   * - Prevents deep link access to restricted client cases
   * - Fully audited changes
   */
  restrictedClientIds: {
    type: [String],
    default: [],
    validate: {
      validator: function(arr) {
        return arr.every(id => /^C\d{6}$/.test(id));
      },
      message: 'All client IDs must be in format C123456',
    },
  },
  
  // Audit trail for user account creation
  createdAt: {
    type: Date,
    default: Date.now,
  },

  deletedAt: {
    type: Date,
    default: null,
  },

  // Snapshot of auth state captured at first soft delete for safe restoration
  deletedAuthSnapshot: {
    status: { type: String },
    isActive: { type: Boolean },
    lockUntil: { type: Date },
  },
}, {
  id: false,
  // Enable virtuals in JSON output
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true },
});

/**
 * Validation: Every non-superadmin user must have tenant context fields set.
 */
userSchema.pre('save', async function() {
  // SECURITY: MFA secrets must never be stored in plaintext at rest.
  // Preserve backward compatibility by encrypting only on mutation and leaving
  // already-encrypted values untouched.
  if (this.isModified('twoFactorSecret') && this.twoFactorSecret && !isEncrypted(this.twoFactorSecret)) {
    this.twoFactorSecret = encryptProtectedValue(this.twoFactorSecret);
  }

  // Keep legacy alias synchronized with the canonical user-facing xID.
  if (this.xID && this.xid !== this.xID) {
    this.xid = this.xID;
  }

  // GUARDRAIL: Prevent saving non-superadmin users without firm/default client context
  if (!['SUPER_ADMIN'].includes(String(this.role || '').toUpperCase())) {
    if (!this.firmId) {
      const error = new Error('Non-superadmin users must have firmId set');
      error.name = 'ValidationError';
      throw error;
    }

    if (!this.defaultClientId) {
      const error = new Error('DEFAULT_CLIENT_NOT_SET');
      error.name = 'ValidationError';
      throw error;
    }

    if (process.env.ENFORCE_TEAM_NOT_NULL === 'true' && this.isOnboarded === true && !this.teamId) {
      const error = new Error('TEAM_NOT_SET');
      error.name = 'ValidationError';
      throw error;
    }
  }

  // Keep canonical identity fields synchronized for backward compatibility
  if (this.email && !this.primary_email) {
    this.primary_email = this.email.toLowerCase();
  }
  if (this.primary_email && this.email !== this.primary_email) {
    this.email = this.primary_email;
  }
  if (this.emailVerified === true) {
    this.is_verified = true;
  }

  // Single source of truth: status drives activation state.
  if (this.isModified('status') || this.isNew) {
    // Backward compatibility: normalize legacy "suspended" writes to canonical "disabled".
    if (this.status === 'suspended') {
      this.status = 'disabled';
    }
    this.isActive = this.status === 'active';
  }

  // Keep authProviders.local in sync with legacy password fields
  if (!this.authProviders) {
    this.authProviders = { local: {}, google: {} };
  }
  if (!this.authProviders.local) {
    this.authProviders.local = {};
  }
  if (this.isModified('passwordHash')) {
    this.authProviders.local.passwordHash = this.passwordHash;
  }
  if (this.isModified('passwordSet')) {
    this.authProviders.local.passwordSet = this.passwordSet;
  }

  // Keep onboarding flags in sync: mustSetPassword is authoritative
  if (this.mustSetPassword) {
    this.passwordSet = false;
    if (this.isModified('mustSetPassword') || this.isNew) {
      this.passwordSetAt = null;
    }
  } else if (this.passwordSetAt) {
    this.passwordSet = true;
  } else {
    this.passwordSet = false;
  }

  // Keep reporting hierarchy aliases in sync
  if (this.reportsToUserId && !this.managerId) {
    this.managerId = this.reportsToUserId;
  }
  if (this.managerId && !this.reportsToUserId) {
    this.reportsToUserId = this.managerId;
  }

  const normalizedRole = normalizeRole(this.role);
  if (normalizedRole !== 'PRIMARY_ADMIN' && !normalizeId(this.primaryAdminId)) {
    const error = new Error('Invalid hierarchy: missing primaryAdminId');
    error.name = 'ValidationError';
    throw error;
  }
  const tagValidationError = getTagValidationError({
    role: normalizedRole,
    primaryAdminId: this.primaryAdminId,
    adminId: this.adminId,
    managerId: this.managerId,
  });
  if (tagValidationError) {
    const error = new Error(tagValidationError);
    error.name = 'ValidationError';
    throw error;
  }

  if (normalizeId(this._id) && normalizeId(this.primaryAdminId) && normalizeId(this._id) === normalizeId(this.primaryAdminId) && normalizedRole !== 'PRIMARY_ADMIN') {
    const error = new Error('Only PRIMARY_ADMIN may self-reference primaryAdminId');
    error.name = 'ValidationError';
    throw error;
  }

  if (normalizedRole !== 'SUPER_ADMIN') {
    const hierarchyRefs = new Map();
    const refDescriptors = [
      { field: 'primaryAdminId', expectedRole: 'PRIMARY_ADMIN' },
      { field: 'adminId', expectedRole: 'ADMIN' },
      { field: 'managerId', expectedRole: 'MANAGER' },
    ];

    for (const descriptor of refDescriptors) {
      const rawValue = this[descriptor.field];
      const normalizedValue = normalizeId(rawValue);
      if (!normalizedValue) continue;

      if (normalizeId(this._id) && normalizedValue === normalizeId(this._id)) {
        const error = new Error(`${descriptor.field} cannot reference the same user`);
        error.name = 'ValidationError';
        throw error;
      }

      // eslint-disable-next-line no-await-in-loop
      const referencedUser = await mongoose.models.User.findOne({
        _id: rawValue,
        status: { $ne: 'deleted' },
      }).select('_id firmId role primaryAdminId adminId').lean();

      if (!referencedUser) {
        const error = new Error(`${descriptor.field} references a missing user`);
        error.name = 'ValidationError';
        throw error;
      }

      if (normalizeId(referencedUser.firmId) !== normalizeId(this.firmId)) {
        const error = new Error(`${descriptor.field} must reference a user from the same firm`);
        error.name = 'ValidationError';
        throw error;
      }

      if (normalizeRole(referencedUser.role) !== descriptor.expectedRole) {
        const error = new Error(`${descriptor.field} must reference a ${descriptor.expectedRole} user`);
        error.name = 'ValidationError';
        throw error;
      }

      hierarchyRefs.set(descriptor.field, referencedUser);
    }

    const referencedAdmin = hierarchyRefs.get('adminId');
    const referencedManager = hierarchyRefs.get('managerId');

    if (referencedAdmin && normalizeId(referencedAdmin.primaryAdminId) !== normalizeId(this.primaryAdminId)) {
      const error = new Error('adminId must belong to the provided primaryAdminId');
      error.name = 'ValidationError';
      throw error;
    }

    if (referencedManager) {
      if (normalizeId(referencedManager.primaryAdminId) !== normalizeId(this.primaryAdminId)) {
        const error = new Error('managerId must belong to the provided primaryAdminId');
        error.name = 'ValidationError';
        throw error;
      }

      if (this.adminId && normalizeId(referencedManager.adminId) !== normalizeId(this.adminId)) {
        const error = new Error('managerId must belong to the provided adminId');
        error.name = 'ValidationError';
        throw error;
      }
    }
  }
});

const assertHierarchyUpdatePayload = (update = {}) => {
  const mergedSet = update.$set || {};
  const nextRole = normalizeRole(update.role ?? mergedSet.role);
  const nextPrimaryAdminId = normalizeId(update.primaryAdminId ?? mergedSet.primaryAdminId);
  const nextAdminId = normalizeId(update.adminId ?? mergedSet.adminId);
  const nextManagerId = normalizeId(update.managerId ?? mergedSet.managerId);
  const hasHierarchyField = ['role', 'primaryAdminId', 'adminId', 'managerId']
    .some((key) => Object.prototype.hasOwnProperty.call(update, key) || Object.prototype.hasOwnProperty.call(mergedSet, key));

  if (!hasHierarchyField) return;

  const tagValidationError = getTagValidationError({
    role: nextRole || 'USER',
    primaryAdminId: nextPrimaryAdminId,
    adminId: nextAdminId,
    managerId: nextManagerId,
  });
  if (tagValidationError) {
    const error = new Error(tagValidationError);
    error.name = 'ValidationError';
    throw error;
  }
};

userSchema.pre('findOneAndUpdate', function(next) {
  try {
    assertHierarchyUpdatePayload(this.getUpdate() || {});
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.pre('updateMany', function(next) {
  try {
    assertHierarchyUpdatePayload(this.getUpdate() || {});
    next();
  } catch (error) {
    next(error);
  }
});

// Indexes for performance
// CRITICAL: Firm-scoped unique index on (firmId, xID)
// - Each firm has its own X000001, X000002, etc.
// - xID is unique WITHIN a firm, not globally
// - Email uniqueness is enforced per firm for active lifecycle users
userSchema.index({ firmId: 1, xID: 1 }, { unique: true });
userSchema.index({ xid: 1 }, { unique: true, sparse: true });
userSchema.index({ primary_email: 1 }, { unique: true, sparse: true });
// Email uniqueness is enforced per firm (multi-tenant model).
// Global uniqueness is intentionally NOT enforced.
userSchema.index(
  { firmId: 1, email: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: 'deleted' } } }
);
userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isSystem: true,
      role: { $in: ['ADMIN', 'PRIMARY_ADMIN'] },
      status: { $ne: 'deleted' },
    },
    name: 'system_admin_email_unique',
  }
);
userSchema.index(
  { phoneNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isSystem: true,
      role: { $in: ['ADMIN', 'PRIMARY_ADMIN'] },
      status: { $ne: 'deleted' },
      phoneNumber: { $type: 'string' },
    },
    name: 'system_admin_phone_unique',
  }
);
userSchema.index({ isActive: 1 });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ firmId: 1, status: 1 });
userSchema.index({ firmId: 1, isActive: 1 });
// REMOVED: { firmId: 1 } - redundant with compound index (firmId, xID) above
userSchema.index({ firmId: 1, role: 1 }); // Firm-scoped role queries
userSchema.index({ firmId: 1, role: 1 }, { unique: true, partialFilterExpression: { role: 'PRIMARY_ADMIN', status: { $ne: 'deleted' } }, name: 'firm_primary_admin_role_unique' });
userSchema.index({ firmId: 1 });
userSchema.index({ firmId: 1, createdAt: -1 });
userSchema.index(
  { 'authProviders.google.googleId': 1 },
  { unique: true, sparse: true, partialFilterExpression: { 'authProviders.google.googleId': { $type: 'string' } } }
); // One Google account -> one user

// Virtual property to check if account is locked
userSchema.virtual('isLocked').get(function() {
  // Check if lockUntil exists and is in the future
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

userSchema.plugin(softDeletePlugin);

// VALIDATION: Strict schema enforcement
userSchema.set('strict', true);

module.exports = mongoose.model('User', userSchema);
