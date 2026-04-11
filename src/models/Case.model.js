const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const CaseStatus = require('../domain/case/caseStatus');
const { DocketLifecycle, deriveLifecycle, normalizeLifecycle } = require('../domain/docketLifecycle');
const softDeletePlugin = require('../utils/softDelete.plugin');
const { tenantScopeGuardPlugin } = require('./plugins/tenantScopeGuard.plugin');
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Case Model for Docketra Case Management System
 * 
 * Represents a core case/matter with auto-generated human-readable IDs.
 * This model tracks the lifecycle of legal cases or business matters through
 * various statuses with proper validation and audit trails.
 * 
 * Key Features:
 * - Auto-incrementing caseId (DCK-0001, DCK-0002, etc.)
 * - Status-based validation (pendingUntil required for Pending status)
 * - Read-only protection for Closed/Filed cases
 * - Comprehensive indexing for performance
 */

const caseSchema = new mongoose.Schema({
  /**
   * ✅ INTERNAL CASE IDENTIFIER - TRUE DATABASE KEY ✅
   * 
   * Opaque, non-guessable internal identifier used for all database operations
   * Auto-generated ObjectId ensures uniqueness and prevents enumeration attacks
   * 
   * MANDATORY - Never editable
   * FIRM-SCOPED via indexes
   * 
   * ⚠️ CRITICAL: This is the ONLY identifier for:
   * - Internal DB queries: findOne({ caseInternalId })
   * - Authorization checks
   * - Cross-collection references
   * - API internal routing
   * 
   * 🚫 NEVER expose this in URLs or to end users
   * 
   * PR: Case Identifier Semantics - Separates internal IDs from display IDs
   */
  caseInternalId: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId(),
    immutable: true,
  },
  
  /**
   * 📋 HUMAN-READABLE CASE NUMBER - DISPLAY ONLY 📋
   * 
   * Human-readable case identifier for display purposes ONLY
   * Format: CASE-YYYYMMDD-XXXXX (e.g., CASE-20260108-00012)
   * Generated via pre-save hook with daily sequence reset
   * 
   * MANDATORY - Never editable
   * FIRM-SCOPED - Case numbers reset per firm
   * 
   * ✅ USE THIS FOR:
   * - UI display in tables and lists
   * - Emails and PDFs
   * - User-facing reports
   * - Search by case number (with conversion to internal ID)
   * 
   * 🚫 NEVER use for:
   * - Authorization decisions
   * - Internal database queries (use caseInternalId)
   * - Direct lookups without conversion
   * 
   * PR: Case Identifier Semantics - Renamed from caseId for clarity
   */
  caseNumber: {
    type: String,
    required: true,
    trim: true,
    immutable: true,
    index: true,
  },
  
  /**
   * ⚠️ DEPRECATED - BACKWARD COMPATIBILITY ONLY ⚠️
   * 
   * Legacy field maintained for backward compatibility during transition
   * Will be removed in future release after migration period
   * 
   * DO NOT USE in new code - use caseNumber for display, caseInternalId for queries
   * 
   * This field is populated with the same value as caseNumber to maintain
   * backward compatibility with existing code during the transition period
   */
  caseId: {
    type: String,
    trim: true,
    immutable: true,
  },
  
  // Firm/Organization ID for multi-tenancy
  firmId: {
    type: String,
    required: [true, 'Firm ID is required'],
    index: true,
  },
  
  /**
   * Deterministic case name - DISPLAY ONLY
   * Format: caseYYYYMMDDxxxxx (e.g., case2026010700001)
   * Generated automatically at case creation
   * Unique within firm, immutable, resets daily
   * FIRM-SCOPED - Case names reset per firm
   * 
   * ⚠️ DISPLAY ONLY: Use only for human-readable display in tables/lists
   * 🚫 NEVER use for URLs, routes, queries, or navigation
   * 
   * PART E - Deterministic Case Naming
   */
  caseName: {
    type: String,
    required: true,
    trim: true,
    immutable: true,
  },

  publicEmailToken: {
    type: String,
    trim: true,
    immutable: true,
    validate: {
      validator: (value) => !value || UUID_V4_REGEX.test(value),
      message: 'publicEmailToken must be a valid UUID v4',
    },
  },
  
  /**
   * Optional idempotency key to make case creation replay-safe
   * Firm-scoped to prevent cross-tenant collisions
   */
  idempotencyKey: {
    type: String,
    trim: true,
    lowercase: true,
  },

  // Marks a case as a reusable template for blueprint automation
  isTemplate: {
    type: Boolean,
    default: false,
    index: true,
  },
  
  /**
   * Brief description of the case/matter
   * MANDATORY field - provides clear case identification
   */
  title: {
    type: String,
    required: [true, 'Case title is required'],
    trim: true,
  },
  
  /**
   * Detailed information about the case
   * MANDATORY field - provides comprehensive case context
   */
  description: {
    type: String,
    required: [true, 'Case description is required'],
    trim: true,
    // Encrypted payloads have significant overhead (v1:iv:authTag:ciphertext).
    // Allow ample room so encrypted descriptions are not truncated at rest.
    maxlength: [5000, 'Case description cannot exceed 5000 characters'],
  },
  
  /**
   * Classification for access control and organization
   * Used to determine which users can access this case
   * Legacy field - kept for backward compatibility
   */
  category: {
    type: String,
    trim: true,
  },
  
  /**
   * Primary case category - drives all workflows
   * Legacy field - kept for backward compatibility
   * Examples: 'Client - New', 'Client - Edit', 'Client - Delete', 'Sales', etc.
   */
  caseCategory: {
    type: String,
    trim: true,
  },
  
  /**
   * Legacy sub-category field
   * Kept for backward compatibility
   */
  caseSubCategory: {
    type: String,
    trim: true,
  },
  subcategory: {
    type: String,
    trim: true,
  },
  
  /**
   * Category ID - Reference to Category model
   * MANDATORY field for case classification
   * References admin-managed categories
   */
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required'],
  },
  
  /**
   * Subcategory ID - Reference to subcategory within Category
   * MANDATORY field for detailed case classification
   */
  subcategoryId: {
    type: String,
    required: [true, 'Subcategory is required'],
    trim: true,
  },

  /**
   * Optional work type taxonomy (firm-admin managed).
   * If provided, this must point to a work type within the same firm.
   */
  workTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkType',
    default: null,
  },

  /**
   * Optional sub work type linked to workTypeId.
   */
  subWorkTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubWorkType',
    default: null,
  },

  /**
   * TAT snapshot captured when case is created.
   * Ensures audit-friendly deadlines even if master data changes later.
   */
  tatDaysSnapshot: {
    type: Number,
    min: 0,
    default: 0,
  },
  
  /**
   * Current lifecycle status of the case
   * 
   * ✅ CANONICAL LIFECYCLE STATES (New System):
   * - UNASSIGNED: Newly created case in global worklist, not yet assigned
   * - OPEN: Active case being worked on (appears in My Worklist)
   * - PENDING: Temporarily paused, waiting for external input (does NOT appear in My Worklist)
 * - QC_PENDING: Awaiting quality control review
 * - QC_FAILED: Failed QC and sent back for rework
 * - QC_CORRECTED: Corrected during QC before final resolution
   * - RESOLVED: Case completed successfully
   * - FILED: Case archived and finalized (read-only, admin-visible only)
   * 
   * Additional workflow states:
   * - DRAFT: Being edited by creator
   * - SUBMITTED: Locked, awaiting review
   * - UNDER_REVIEW: Being reviewed by admin/approver
   * - APPROVED: Changes written to DB (for client cases)
   * - REJECTED: Declined, no DB mutation
   * - CLOSED: Completed and resolved
   * 
   * Legacy states (for backward compatibility):
   * - Open: Active and being worked on (use OPEN instead)
   * - Reviewed: Ready for Admin approval (used for client cases)
   * - Pending: Waiting for external input/decision (use PENDING instead)
   * - Filed: Archived and finalized (use FILED instead)
   * - Archived: Historical record (read-only)
   * 
   * PR: Case Lifecycle & Dashboard Logic
   * - OPEN cases: Appear in "My Open Cases" dashboard and "My Worklist"
   * - PENDING cases: Appear only in "My Pending Cases" dashboard (not in worklist)
   * - FILED cases: Hidden from employees, visible only to admins
   */
  status: {
    type: String,
    enum: {
      values: Object.values(CaseStatus),
      message: '{VALUE} is not a valid status',
    },
    default: 'OPEN',
    required: true,
  },
  version: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  /**
   * Priority level for task prioritization and resource allocation
   */
  priority: {
    type: String,
    enum: {
      values: ['low', 'medium', 'high', 'urgent'],
      message: '{VALUE} is not a valid priority',
    },
    default: 'medium',
    required: true,
  },
  
  /**
   * Target completion date for the case
   * Optional to allow flexibility in case management
   */
  dueDate: {
    type: Date,
  },
  slaDays: {
    type: Number,
    min: 0,
    default: 0,
  },
  lifecycle: {
    type: String,
    enum: Object.values(DocketLifecycle),
    default: DocketLifecycle.WL,
    required: true,
    set: (value) => normalizeLifecycle(value),
  },

  // Budget estimates used for reporting variance
  estimatedBudget: {
    type: Number,
    min: 0,
    default: 0,
  },
  actualCost: {
    type: Number,
    min: 0,
    default: 0,
  },
  
  /**
   * Date when a Pending case should be reviewed
   * REQUIRED when status is 'Pending' (validated via custom validator)
   * Helps track cases waiting for external input
   */
  pendingUntil: {
    type: Date,
  },
  reopenAt: {
    type: Date,
  },
  duplicateOf: {
    type: String,
    trim: true,
  },
  forceQc: {
    type: Boolean,
    default: false,
  },
  qcStatus: {
    type: String,
    enum: ['REQUESTED', 'APPROVED', 'FAILED', 'CORRECTED', 'REJECTED'],
    default: null,
  },
  qcBy: {
    type: String,
    trim: true,
    uppercase: true,
    default: null,
  },
  qcAt: {
    type: Date,
    default: null,
  },
  qc: {
    requestedBy: { type: String, trim: true, uppercase: true },
    handledBy: { type: String, trim: true, uppercase: true },
    status: { type: String, enum: ['REQUESTED', 'APPROVED', 'FAILED', 'CORRECTED', 'SKIPPED'], default: null },
    attempts: { type: Number, min: 0, default: 0 },
    comment: { type: String, trim: true, default: null },
    requestedAt: { type: Date },
    handledAt: { type: Date },
    originalAssigneeXID: { type: String, trim: true, uppercase: true },
  },

  // Timestamp when case was transitioned to RESOLVED
  resolvedAt: {
    type: Date,
  },
  filedAt: {
    type: Date,
  },

  filedReason: {
    type: String,
    enum: ['duplicate', 'invalid', 'not_required', 'other'],
  },
  filedNote: {
    type: String,
    trim: true,
  },
  pendingReason: {
    type: String,
    enum: ['waiting_client', 'waiting_internal', 'blocked', 'other'],
  },
  completionType: {
    type: String,
    enum: ['resolved', 'filed'],
  },
  
  slaDueAt: {
    type: Date,
    required: [true, 'SLA Due At is required'],
  },
  tatTotalMinutes: {
    type: Number,
    min: 0,
    default: 0,
  },
  tatPaused: {
    type: Boolean,
    default: false,
  },
  tatLastStartedAt: {
    type: Date,
  },
  tatAccumulatedMinutes: {
    type: Number,
    min: 0,
    default: 0,
  },
  slaConfigSnapshot: {
    tatDurationMinutes: { type: Number, min: 0 },
    businessStartTime: { type: String, trim: true },
    businessEndTime: { type: String, trim: true },
    workingDays: { type: [Number] },
    timezone: { type: String, trim: true },
  },
  
  /**
   * xID of user who created the case
   * 
   * ✅ CANONICAL IDENTIFIER - MANDATORY ✅
   * 
   * This is the ONLY field that should be used for:
   * - Case ownership logic
   * - Authorization checks
   * - Creator identification
   * - Audit trails
   * 
   * MANDATORY field - derived from auth context (req.user.xID)
   * Format: X123456
   * Immutable after creation
   * 
   * NEVER infer this from email - it must come from authenticated user context.
   */
  createdByXID: {
    type: String,
    required: [true, 'Creator xID is required'],
    uppercase: true,
    trim: true,
    immutable: true,
  },


  ownerTeamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null,
    index: true,
    immutable: true,
  },
  routedToTeamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null,
    index: true,
  },
  routedByUserId: {
    type: String,
    trim: true,
    uppercase: true,
    default: null,
  },
  routedAt: {
    type: Date,
    default: null,
  },
  routingNote: {
    type: String,
    trim: true,
    default: null,
  },
  
  /**
   * Email of user who created the case
   * 
   * ⚠️ DEPRECATED - FOR DISPLAY PURPOSES ONLY ⚠️
   * 
   * NEVER use this field for:
   * - Ownership logic
   * - Authorization checks
   * - Case queries
   * - Assignment operations
   * 
   * ALWAYS use createdByXID instead for all ownership and authorization logic.
   * This field is kept only for backward compatibility and display purposes.
   * 
   * Email must never be used as an ownership or attribution identifier.
   */
  createdBy: {
    type: String,
    lowercase: true,
    trim: true,
  },
  
  /**
   * xID of currently assigned user
   * 
   * ✅ CANONICAL IDENTIFIER - REQUIRED FOR ASSIGNMENT ✅
   * 
   * This is the ONLY field that should be used for:
   * - Case assignment operations
   * - Ownership queries
   * - Authorization checks
   * - Worklist filtering
   * 
   * CANONICAL IDENTIFIER: Stores user's xID (e.g., X123456), NOT email
   * Null when unassigned, tracks current ownership
   * 
   * PR #42: Standardized to use xID as the canonical identifier
   * PR #44: Enforced with guardrails - email-based assignment is blocked
   * PR: xID Canonicalization - Renamed to assignedToXID, assignedTo deprecated
   * 
   * - Assignment operations MUST store xID
   * - Query operations MUST filter by xID
   * - Display operations MUST resolve xID → user info
   * 
   * NEVER use email for assignment or ownership logic.
   */
  assignedToXID: {
    type: String,
    uppercase: true,
    trim: true,
  },
  
  /**
   * ⚠️ DEPRECATED - DO NOT USE ⚠️
   * 
   * Legacy field kept for backward compatibility during migration.
   * Use assignedToXID instead for all ownership operations.
   * 
   * This field will be removed in a future release.
   */
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },

  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  
  /**
   * Timestamp when case was assigned to current user
   * Tracks when case was pulled from global worklist or assigned
   */
  assignedAt: {
    type: Date,
  },
  
  /**
   * Queue Type - CANONICAL field for case visibility
   * 
   * Determines which worklist the case appears in:
   * - GLOBAL: Case is in the global worklist (unassigned cases)
   * - PERSONAL: Case is in someone's personal worklist (assigned cases)
   * 
   * This field is critical for the worklist/dashboard mismatch fix.
   * 
   * Rules:
   * - New cases start as GLOBAL (with status UNASSIGNED)
   * - Pulling a case sets queueType = PERSONAL and assigns to user
   * - Filing a case removes it from all worklists
   * 
   * PR: Fix Dashboard/Worklist Mismatch
   */
  queueType: {
    type: String,
    enum: {
      values: ['GLOBAL', 'PERSONAL'],
      message: '{VALUE} is not a valid queue type',
    },
    default: 'GLOBAL',
  },
  
  /**
   * xID of user who pended this case
   * 
   * ✅ CANONICAL IDENTIFIER - MANDATORY FOR PENDING CASES ✅
   * 
   * Tracks who put the case into PENDING status.
   * Used for:
   * - "My Pending Cases" dashboard queries
   * - Audit trail for pending actions
   * - Auto-reopen attribution
   * 
   * Format: X123456
   * Must be set when status changes to PENDING
   * 
   * PR: Case Lifecycle & Dashboard Logic
   */
  pendedByXID: {
    type: String,
    uppercase: true,
    trim: true,
  },
  
  /**
   * xID of user who performed the last action
   * 
   * ✅ CANONICAL IDENTIFIER - AUDIT TRAIL ✅
   * 
   * Tracks the last person who modified the case status.
   * Used for:
   * - Audit logs
   * - Case timeline
   * - Attribution of all case actions
   * 
   * Format: X123456
   * Updated on every status change action
   * 
   * PR: Case Lifecycle & Dashboard Logic
   */
  lastActionByXID: {
    type: String,
    uppercase: true,
    trim: true,
  },
  
  /**
   * Timestamp of last case action
   * 
   * Tracks when the last action was performed on the case.
   * Used for:
   * - Case timeline
   * - Audit trail
   * - Sorting by recent activity
   * 
   * Updated on every status change action
   * 
   * PR: Case Lifecycle & Dashboard Logic
   */
  lastActionAt: {
    type: Date,
  },
  
  /**
   * Case locking mechanism for concurrency control
   * Prevents multiple users from modifying the same case simultaneously
   * Includes inactivity tracking for auto-unlock after 2 hours
   */
  lockStatus: {
    isLocked: {
      type: Boolean,
      default: false,
    },
    activeUserEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    activeUserXID: {
      type: String,
      trim: true,
      uppercase: true,
    },
    activeUserDisplayName: {
      type: String,
      trim: true,
    },
    lockedAt: {
      type: Date,
    },
    lastActivityAt: {
      type: Date,
    },
  },
  
  /**
   * Client ID - MANDATORY
   * References a client by their immutable clientId (C123456 format)
   * EVERY case MUST have a client - either a real client or the organization client
   * 
   * Format: String clientId (e.g., "C123456", "C654321")
   * NOT an ObjectId reference - uses immutable client identifier
   */
  clientId: {
    type: String,
    required: [true, 'Client ID is required - every case must have a client'],
    trim: true,
  },
  
  /**
   * Snapshot of client data at case creation
   * Stores immutable client information for audit trail
   * Even if client data changes later, this preserves the original state
   * Automatically populated via pre-save hook when clientId is provided
   */
  clientSnapshot: {
    clientId: String,           // C123456 format
    businessName: String,        // Client name at time of case creation
    primaryContactNumber: String, // Primary contact at time of case creation
    businessEmail: String,
    businessAddress: String,
    PAN: String,
    GST: String,
    CIN: String,
  },
  
  /**
   * Payload for client governance cases
   * Stores proposed client changes that will be applied upon approval
   * Used for Client - New, Client - Edit, Client - Delete cases
   * 
   * Structure for "Client - New":
   * {
   *   action: "NEW",
   *   clientData: { businessName: "...", businessAddress: "...", ... }
   * }
   * 
   * Structure for "Client - Edit":
   * {
   *   action: "EDIT",
   *   clientId: "C123457",
   *   updates: { primaryContactNumber: "...", businessEmail: "...", ... }
   * }
   * 
   * Structure for "Client - Delete":
   * {
   *   action: "DELETE",
   *   clientId: "C123457"
   * }
   */
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  
  /**
   * Workflow metadata - submission tracking
   */
  submittedAt: {
    type: Date,
  },
  
  submittedBy: {
    type: String,
    lowercase: true,
    trim: true,
  },
  
  /**
   * Workflow metadata - approval tracking
   */
  approvedAt: {
    type: Date,
  },
  
  approvedBy: {
    type: String,
    lowercase: true,
    trim: true,
  },
  
  /**
   * Admin decision comments for approval/rejection
   */
  decisionComments: {
    type: String,
    trim: true,
  },
  
  /**
   * Google Drive folder structure for CFS (Case File System)
   * 
   * Stores the Google Drive folder IDs for this case's file structure.
   * Created automatically during case creation via pre-save hook.
   * 
   * Structure:
   * - firmRootFolderId: firm_<firmId> folder
   * - cfsRootFolderId: cfs_<caseId> folder
   * - attachmentsFolderId: attachments/ subfolder
   * - documentsFolderId: documents/ subfolder
   * - evidenceFolderId: evidence/ subfolder
   * - internalFolderId: internal/ subfolder
   * 
   * Security:
   * - Folder IDs are authoritative for file access
   * - Never rely on folder names for authorization
   * - All file operations must use these IDs
   */
  drive: {
    firmRootFolderId: {
      type: String,
      trim: true,
    },
    cfsRootFolderId: {
      type: String,
      trim: true,
    },
    attachmentsFolderId: {
      type: String,
      trim: true,
    },
    documentsFolderId: {
      type: String,
      trim: true,
    },
    evidenceFolderId: {
      type: String,
      trim: true,
    },
    internalFolderId: {
      type: String,
      trim: true,
    },
  },

  /**
   * Active storage provider context used for new case attachments.
   * Legacy attachments continue to rely on driveFileId for compatibility.
   */
  storage: {
    provider: {
      type: String,
      enum: ['google-drive'],
      default: 'google-drive',
      trim: true,
    },
    rootFolderId: {
      type: String,
      trim: true,
    },
  },
}, {
  // Automatic timestamp management for audit trail
  timestamps: true,
});
// Use Mongoose __v optimistic locking for document-save flows; status transitions
// also include explicit expected status/tat guards at repository update filter level.
caseSchema.set('optimisticConcurrency', true);

/**
 * Custom Validator: Pending status requires pendingUntil date
 * Ensures cases in PENDING status have a review date set
 */
caseSchema.path('status').validate(function(value) {
  if (value === 'PENDING' && !this.pendingReason) {
    return false;
  }
  return true;
}, 'pendingReason is required when status is PENDING');


caseSchema.pre('validate', function enforceAssignedUserForWorklistLifecycle(next) {
  const lifecycle = normalizeLifecycle(this.lifecycle);
  if (lifecycle !== DocketLifecycle.WL) return next();

  if (!this.assignedToXID) {
    this.invalidate('assignedToXID', 'WL docket must have assignedToXID');
  }

  return next();
});

caseSchema.pre('save', function enforceAssignedUserForWlOnSave(next) {
  const lifecycle = normalizeLifecycle(this.lifecycle);
  if (lifecycle === DocketLifecycle.WL && !this.assignedToXID) {
    return next(new Error('WL docket must have assignedToXID'));
  }
  return next();
});

/**
 * Virtual Property: isReadOnly
 * Returns true if case is in a finalized state (Closed, Filed, or FILED)
 * Used by UI/API to prevent modifications to finalized cases
 * 
 * PR: Updated to support new FILED status
 */
caseSchema.virtual('isReadOnly').get(function() {
  return this.status === 'Closed' || this.status === 'Filed' || this.status === 'FILED';
});

/**
 * Pre-save Hook: Auto-generate case identifiers
 * 
 * PR: Case Identifier Semantics - Updated to generate both internal and display IDs
 * 
 * Generates:
 * 1. caseInternalId: Opaque ObjectId for internal use (auto-generated by schema default)
 * 2. caseNumber: Human-readable CASE-YYYYMMDD-XXXXX for display
 * 3. caseName: Legacy caseYYYYMMDDxxxxx format for backward compatibility
 * 4. caseId: Deprecated field populated with caseNumber value for transition period
 * 
 * PR 2: Atomic Counter Implementation
 * - Uses MongoDB atomic counters to eliminate race conditions
 * - Firm-scoped counters for multi-tenancy
 * - Daily sequence reset (counter name includes date)
 * 
 * Algorithm for caseNumber:
 * 1. Get current date (YYYYMMDD)
 * 2. Atomically increment firm-scoped counter for today
 * 3. Format as CASE- + YYYYMMDD + - + 5-digit zero-padded sequence
 * 
 * Algorithm for caseName:
 * 1. Get current date (YYYYMMDD)
 * 2. Atomically increment firm-scoped counter for today
 * 3. Format as case + YYYYMMDD + 5-digit zero-padded sequence
 * 
 * Note: This runs before validation, so IDs are available for unique constraint check
 * 
 * CONCURRENCY-SAFE: Uses atomic counters to prevent race conditions
 */
caseSchema.pre('validate', async function() {
  this.lifecycle = deriveLifecycle({
    assignedToXID: this.assignedToXID,
    lifecycle: this.lifecycle,
    status: this.status,
  });

  if (!this.dueDate && Number(this.slaDays) > 0 && this.createdAt) {
    const due = new Date(this.createdAt);
    due.setUTCDate(due.getUTCDate() + Number(this.slaDays));
    this.dueDate = due;
  }

  // Ensure firmId is set before generating IDs
  // This is fail-fast validation at the model level (checks existence)
  // counter.service.js performs defensive validation (checks type and existence)
  if (!this.firmId) {
    throw new Error('Firm ID is required for case creation');
  }
  
  // caseInternalId is auto-generated by schema default (ObjectId)
  // No explicit generation needed here
  
  const session = typeof this.$session === 'function' ? this.$session() : undefined;

  // Only generate case number if not already set (for new documents)
  if (!this.caseNumber) {
    const { generateDocketId, generateCaseId } = require('../services/caseIdGenerator');

    try {
      // If a workTypeId is set, look up its prefix and use the new docket ID format
      if (this.workTypeId) {
        const WorkType = mongoose.model('WorkType');
        const wtQuery = WorkType.findById(this.workTypeId);
        if (session) {
          wtQuery.session(session);
        }
        const wt = await wtQuery.lean();
        if (wt && wt.prefix) {
          // Generate docket ID with work-type prefix.
          // The unique index on caseNumber enforces uniqueness; use saveWithRetry()
          // on new Case documents to automatically retry on E11000 collisions.
          this.caseNumber = generateDocketId(this.firmId, wt.prefix);
        } else {
          this.caseNumber = await generateCaseId(this.firmId, { session });
        }
      } else {
        this.caseNumber = await generateCaseId(this.firmId, { session });
      }
    } catch (error) {
      throw new Error(
        `Failed to generate docket/case ID for workTypeId=${this.workTypeId}, firmId=${this.firmId}: ${error.message}`
      );
    }
  }
  
  // Generate caseName if not set
  if (!this.caseName) {
    const { generateCaseName } = require('../services/caseNameGenerator');
    this.caseName = await generateCaseName(this.firmId, { session });
  }
  
  // Populate deprecated caseId field with caseNumber for backward compatibility
  if (!this.caseId && this.caseNumber) {
    this.caseId = this.caseNumber;
  }

  if (!this.publicEmailToken) {
    this.publicEmailToken = randomUUID();
  }
  
  // If this is a new case and clientId is provided, fetch and snapshot the client
  // This preserves client data at the time of case creation for audit trail
  if (this.isNew && this.clientId && !this.clientSnapshot) {
    const Client = mongoose.model('Client');
    const clientQuery = Client.findOne({ clientId: this.clientId, firmId: this.firmId });
    if (session) {
      clientQuery.session(session);
    }
    const client = await clientQuery.lean();
    if (client) {
      this.clientSnapshot = {
        clientId: client.clientId,
        businessName: client.businessName,
        primaryContactNumber: client.primaryContactNumber,
        businessEmail: client.businessEmail,
        businessAddress: client.businessAddress,
        PAN: client.PAN,
        GST: client.GST,
        CIN: client.CIN,
      };
    }
  }
  
  // Enqueue async storage job to create CFS folder structure for new cases.
  // Folder creation is handled by the storage worker via BYOS queue.
  if (this.isNew && !this.drive?.cfsRootFolderId) {
    const { enqueueStorageJob } = require('../queues/storage.queue');
    await enqueueStorageJob('CREATE_CASE_FOLDER', {
      firmId: this.firmId,
      provider: 'google',
      caseId: this.caseNumber,
    });
  }
});

/**
 * Performance Indexes
 * 
 * CRITICAL: Internal ID and firm-scoped unique indexes
 * - caseInternalId: Primary internal lookup index (unique across all firms)
 * - (firmId, caseInternalId): Firm-scoped internal ID lookup
 * - (firmId, caseNumber): Case numbers reset per firm (display only)
 * - (firmId, caseName): Case names reset per firm (display only)
 * - (firmId, caseId): DEPRECATED - backward compatibility during transition
 * 
 * Other indexes:
 * - status + priority: Common filter combination for listing cases
 * - category: Access control and filtering by case type
 * - createdBy: DEPRECATED - kept for backward compatibility only
 * - createdByXID: CANONICAL - find cases created by specific user (xID)
 * - assignedToXID: CANONICAL - find cases assigned to specific user (xID)
 * - assignedTo: DEPRECATED - kept for backward compatibility during migration
 * - clientId: Find cases associated with a specific client
 * - Additional indexes for global search and worklists:
 *   - status: Filter by status for worklists
 *   - createdAt: Sort by creation date
 *   - assignedToXID + status: Employee worklist queries (xID-based)
 *   - queueType + status: Queue-based worklist queries (GLOBAL vs PERSONAL)
 *   - pendedByXID + status: Pending cases dashboard queries (xID-based)
 *   - pendingUntil: Auto-reopen scheduler queries
 * 
 * PR #44: Added createdByXID index for xID-based ownership queries
 * PR: Case Lifecycle - Added queueType, pendedByXID, pendingUntil indexes
 * PR: xID Canonicalization - Migrated from assignedTo to assignedToXID
 * PR: Firm-Scoped Identity - Added firm-scoped unique indexes
 * PR: Case Identifier Semantics - Added caseInternalId indexes, made caseNumber display-only
 * Note: Email-based ownership queries are not supported
 */
// CRITICAL: Internal ID indexes for true database lookups
caseSchema.index({ caseInternalId: 1 }, { unique: true });
caseSchema.index({ firmId: 1, caseInternalId: 1 });

// MANDATORY: Firm-scoped unique indexes for display identifiers
caseSchema.index({ firmId: 1, caseNumber: 1 }, { unique: true });
caseSchema.index({ firmId: 1, caseName: 1 }, { unique: true });
caseSchema.index({ firmId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
caseSchema.index({ publicEmailToken: 1 }, { unique: true, sparse: true });

// DEPRECATED DISPLAY ID FIELD, but tenant-scoped uniqueness is still required for safety.
caseSchema.index({ firmId: 1, caseId: 1 }, { unique: true });
caseSchema.index({ title: 'text', description: 'text' });

caseSchema.index({ status: 1, priority: 1 });
caseSchema.index({ category: 1 });
caseSchema.index({ createdBy: 1 }); // DEPRECATED - kept for backward compatibility
caseSchema.index({ createdByXID: 1 }); // CANONICAL - xID-based creator queries
caseSchema.index({ assignedToXID: 1 }); // CANONICAL - xID-based assignment queries
caseSchema.index({ assignedTo: 1 }); // Assignment owner lookup
caseSchema.index({ assignedBy: 1 }); // Assignment actor lookup
caseSchema.index({ clientId: 1 });
caseSchema.index({ status: 1 });
caseSchema.index({ createdAt: -1 });
caseSchema.index({ assignedToXID: 1, status: 1 }); // CANONICAL - xID-based worklist queries
caseSchema.index({ firmId: 1, caseId: 1, status: 1, assignedToXID: 1, assignedTo: 1 }); // Atomic workbasket pull filter index
caseSchema.index({ queueType: 1, status: 1 }); // Queue-based worklist queries
caseSchema.index({ pendedByXID: 1, status: 1 }); // Pending cases dashboard queries
caseSchema.index({ pendingUntil: 1 }); // Auto-reopen scheduler queries
caseSchema.index({ firmId: 1, slaDueAt: 1 }); // Firm-scoped SLA due lookups
// REMOVED: { firmId: 1 } - redundant with compound indexes above (firmId, caseInternalId), (firmId, caseNumber), etc.
caseSchema.index({ firmId: 1, status: 1 }); // Firm-scoped status queries
caseSchema.index({ firmId: 1, assignedToXID: 1 }); // Firm-scoped assignment queries
caseSchema.index({ firmId: 1, assignedToXID: 1, status: 1 }); // Firm-scoped assignment + status workbasket queries
caseSchema.index({ firmId: 1, ownerTeamId: 1, routedToTeamId: 1, status: 1 });
caseSchema.index({ firmId: 1, routedToTeamId: 1, status: 1 });
caseSchema.index({ firmId: 1, dueDate: 1, status: 1 }); // Firm-scoped overdue metrics queries
caseSchema.index({ firmId: 1, status: 1, dueDate: 1 }); // Firm-scoped status-filtered due-date ordering queries
caseSchema.index({ firmId: 1, resolvedAt: 1 }); // Firm-scoped resolution metrics queries
caseSchema.index({ firmId: 1, createdAt: 1 }); // Firm-scoped daily creation metrics queries
caseSchema.index({ firmId: 1, status: 1, createdAt: -1 }); // Firm-scoped status dashboards sorted by recency
caseSchema.index({ firmId: 1, createdAt: -1 });
caseSchema.index({ firmId: 1, clientId: 1 });

caseSchema.plugin(softDeletePlugin);
caseSchema.plugin(tenantScopeGuardPlugin);

// ============================================================
// TRANSPARENT FIELD ENCRYPTION — AES-256-GCM envelope model
// ============================================================
// Sensitive Case fields are encrypted at rest.  Encryption happens at the
// model layer (pre-save hook).  DECRYPTION happens at the repository layer
// (CaseRepository.js) so that role-based restrictions can be enforced before
// any plaintext is returned to callers.
//
// Encrypted fields:
//   - description
//
// The pre-save hook calls ensureTenantKey() which auto-generates the
// per-tenant DEK on first use (envelope encryption — see encryption.service.js).

const { looksEncrypted: _caseIsEncryptedValue } = require('../security/encryption.utils');

/** Fields that must be encrypted before persisting. */
const _CASE_SENSITIVE_FIELDS = ['description'];

/**
 * Lazy-cached reference to the encryption service.
 * Using a lazy require avoids potential circular-dependency issues during
 * module initialisation while still benefiting from Node's module cache
 * (the require() call after the first load is a simple hash-map lookup).
 */
let _caseEncService;
function _getCaseEncService() {
  if (!_caseEncService) _caseEncService = require('../security/encryption.service');
  return _caseEncService;
}

/**
 * Encrypt sensitive fields on a Case document before saving.
 * No-op when MASTER_ENCRYPTION_KEY is not configured.
 */
caseSchema.pre('save', async function () {
  if (!process.env.MASTER_ENCRYPTION_KEY || !this.firmId) return;
  const { encrypt: _enc, ensureTenantKey: _ensure } = _getCaseEncService();
  const tenantId = String(this.firmId);
  const session = typeof this.$session === 'function' ? this.$session() : undefined;
  await _ensure(tenantId, { session });
  for (const field of _CASE_SENSITIVE_FIELDS) {
    if (this[field] != null && !_caseIsEncryptedValue(this[field])) {
      this[field] = await _enc(String(this[field]), tenantId, { session });
    }
  }
});

/**
 * Save a new Case document with automatic retry on docket ID collisions.
 *
 * When using the prefix-based docket ID format (PREFIXYYYYMMDDNNNN), the
 * 4-digit random suffix gives ~9000 possibilities per prefix per day.  Under
 * high concurrency a duplicate-key error (E11000) on caseNumber is possible.
 * This method retries up to `maxAttempts` times, resetting caseNumber before
 * each retry so the pre-validate hook regenerates a fresh random suffix.
 *
 * Only retries for E11000 errors on caseNumber; all other errors propagate
 * immediately.  The legacy generateCaseId() path is unaffected because it
 * uses an atomic counter and cannot produce duplicates.
 *
 * @param {object} [saveOptions={}]  Options forwarded to Mongoose save() (e.g. { session })
 * @param {number} [maxAttempts=5]   Maximum save attempts before giving up
 * @returns {Promise<this>}          The saved document
 * @throws {Error}                   After maxAttempts exhausted, or on non-collision errors
 */
caseSchema.methods.saveWithRetry = async function (saveOptions = {}, maxAttempts = 5) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await this.save(saveOptions);
    } catch (err) {
      const isDuplicateCaseNumber =
        err.code === 11000 &&
        err.message &&
        err.message.includes('caseNumber');

      if (isDuplicateCaseNumber && attempt < maxAttempts - 1) {
        // Reset caseNumber (and its deprecated alias) so the pre-validate
        // hook generates a new random suffix on the next attempt.
        this.caseNumber = undefined;
        this.caseId = undefined;
      } else if (isDuplicateCaseNumber) {
        throw new Error(
          `Failed to generate a unique docket ID after ${maxAttempts} attempts. Please try again.`
        );
      } else {
        throw err;
      }
    }
  }
};

// VALIDATION: Strict schema enforcement
caseSchema.set('strict', true);

module.exports = mongoose.model('Case', caseSchema);
