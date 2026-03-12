const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');
const { encrypt: encryptProtectedValue, isEncrypted } = require('../utils/encryption');

const isEncryptedStorageConfig = (value) => (
  !!value
  && typeof value === 'object'
  && value.encrypted === true
  && typeof value.value === 'string'
  && isEncrypted(value.value)
);

/**
 * Client Model for Docketra Case Management System
 * 
 * Enterprise-grade immutable client identity system with audit-safe management.
 * Clients are immutable after creation - edits must happen through "Client - Edit" cases.
 * 
 * Key Features:
 * - Auto-incrementing clientId (C123456 format)
 * - Immutable clientId (enforced at schema level)
 * - System client flag for default organization client
 * - Comprehensive business and regulatory information
 * - Soft delete mechanism (no hard deletes)
 * - All edits require Admin approval through case workflow
 * 
 * REQUIRED FIELDS:
 * - clientId (auto-generated server-side)
 * - businessName
 * - businessAddress
 * - businessEmail
 * - primaryContactNumber
 * - createdByXid (set from authenticated user)
 * 
 * OPTIONAL FIELDS:
 * - secondaryContactNumber
 * - PAN, TAN, GST, CIN (tax/regulatory identifiers)
 */

const clientSchema = new mongoose.Schema({
  /**
   * Auto-generated immutable client identifier
   * Format: C000001, C000002, etc. (firm-scoped)
   * Generated via pre-save hook by finding highest existing number and incrementing
   * IMMUTABLE - Cannot be changed after creation
   * FIRM-SCOPED - Each firm starts with C000001
   */
  clientId: {
    type: String,
    required: true,
    trim: true,
    immutable: true, // Schema-level immutability enforcement
  },
  
  // Organization/Tenant ID for multi-tenancy.
  // For the default (system) client this equals the client's own _id.
  // For regular clients this equals the _id of the organization's default client.
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'Firm ID is required'],
    immutable: true, // Client cannot be moved between organizations
  },
  
  /**
   * Business/Client name
   * Required field for client identification
   * 
   * PROTECTED - Can only be changed via dedicated "Change Legal Name" endpoint
   * All changes are tracked in previousBusinessNames array
   */
  businessName: {
    type: String,
    required: [true, 'Business name is required'],
    trim: true,
  },
  
  /**
   * Client Fact Sheet - Description
   * Admin-managed context about the client
   * Read-only reference visible in all cases for this client
   * Used for providing client background, notes, guidelines
   * Rich text field for detailed client information
   */
  clientFactSheet: {
    basicInfo: {
      clientName: { type: String, trim: true, default: '' },
      entityType: { type: String, trim: true, default: '' },
      PAN: { type: String, trim: true, uppercase: true, default: '' },
      CIN: { type: String, trim: true, uppercase: true, default: '' },
      GSTIN: { type: String, trim: true, uppercase: true, default: '' },
      address: { type: String, trim: true, default: '' },
      contactPerson: { type: String, trim: true, default: '' },
      email: { type: String, trim: true, lowercase: true, default: '' },
      phone: { type: String, trim: true, default: '' },
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    /**
     * Client Fact Sheet - Internal Notes
     * Admin-only internal notes about the client
     * Used for internal context, guidelines, or sensitive information
     * Rich text field
     */
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    /**
     * Internal initialization flag
     * Tracks whether fact sheet has been initialized (for accurate audit logging)
     * Not exposed via APIs
     */
    _initialized: {
      type: Boolean,
      default: false,
      select: false, // Don't include in query results by default
    },
    /**
     * Client Fact Sheet - Files
     * Array of file references attached at client level
     * Admin-managed, visible as read-only in all cases
     * Not copied into individual cases
     * 
     * Each file contains:
     * - fileId: MongoDB ObjectId for the file
     * - fileName: Original file name
     * - mimeType: File MIME type
     * - storagePath: Path to file in storage
     * - uploadedBy: xID of user who uploaded
     * - uploadedAt: Timestamp
     */
    files: [{
      fileId: {
        type: mongoose.Schema.Types.ObjectId,
        default: () => new mongoose.Types.ObjectId(),
      },
      fileName: {
        type: String,
        required: true,
        trim: true,
      },
      mimeType: {
        type: String,
        required: true,
        trim: true,
      },
      storagePath: {
        type: String,
        required: true,
        trim: true,
      },
      checksum: {
        type: String,
        trim: true,
      },
      uploadedByXID: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
      },
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    }],
    // Compatibility view for downstream consumers expecting document object structure
    documents: [{
      fileName: { type: String, trim: true },
      fileUrl: { type: String, trim: true },
      uploadedBy: { type: String, trim: true, uppercase: true },
      uploadedAt: { type: Date, default: Date.now },
    }],
  },
  
  /**
   * DEPRECATED: Legacy description field
   * Kept for backward compatibility
   * Use clientFactSheet.description instead
   */
  description: {
    type: String,
    trim: true,
    default: '',
  },
  
  /**
   * DEPRECATED: Legacy documents field
   * Kept for backward compatibility
   * Use clientFactSheet.files instead
   */
  documents: [{
    name: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    uploadedByXid: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
  }],
  
  /**
   * Google Drive folder structure for Client CFS (Client File System)
   * 
   * Stores the Google Drive folder IDs for this client's file structure.
   * Created automatically during client creation.
   * 
   * Structure:
   * - clientRootFolderId: client_<clientId> folder
   * - cfsRootFolderId: cfs/ subfolder
   * - documentsFolderId: documents/ subfolder
   * - contractsFolderId: contracts/ subfolder
   * - identityFolderId: identity/ subfolder
   * - financialsFolderId: financials/ subfolder
   * - internalFolderId: internal/ subfolder
   * 
   * Security:
   * - Folder IDs are authoritative for file access
   * - Never rely on folder names for authorization
   * - All file operations must use these IDs
   * - Only Admin users can add/remove documents
   * - Cases can reference these documents (read-only)
   */
  drive: {
    clientRootFolderId: {
      type: String,
      trim: true,
    },
    cfsRootFolderId: {
      type: String,
      trim: true,
    },
    documentsFolderId: {
      type: String,
      trim: true,
    },
    contractsFolderId: {
      type: String,
      trim: true,
    },
    identityFolderId: {
      type: String,
      trim: true,
    },
    financialsFolderId: {
      type: String,
      trim: true,
    },
    internalFolderId: {
      type: String,
      trim: true,
    },
  },
  
  /**
   * Previous business names history
   * Tracks all legal name changes for audit compliance
   * Each entry captures: old name, change date, who changed it, and reason
   */
  previousBusinessNames: [{
    name: {
      type: String,
      required: true,
      trim: true,
    },
    changedOn: {
      type: Date,
      required: true,
      default: Date.now,
    },
    changedByXid: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    }
  }],
  
  /**
   * Business physical address
   * Required for regulatory and contact purposes
   */
  businessAddress: {
    type: String,
    required: [true, 'Business address is required'],
    trim: true,
  },
  
  /**
   * Primary contact phone number
   * Required for communication
   */
  primaryContactNumber: {
    type: String,
    required: [true, 'Primary contact number is required'],
    trim: true,
  },
  
  /**
   * Secondary contact phone number
   * Optional additional contact
   */
  secondaryContactNumber: {
    type: String,
    trim: true,
  },
  
  /**
   * Business contact email
   * Required for communication
   */
  businessEmail: {
    type: String,
    required: [true, 'Business email is required'],
    trim: true,
  },
  
  /**
   * PAN (Permanent Account Number)
   * Indian tax identifier
   * IMMUTABLE - Cannot be changed after creation
   */
  PAN: {
    type: String,
    trim: true,
    uppercase: true,
    immutable: true,
  },
  
  /**
   * TAN (Tax Deduction and Collection Account Number)
   * Indian tax identifier for TDS
   * IMMUTABLE - Cannot be changed after creation
   */
  TAN: {
    type: String,
    trim: true,
    uppercase: true,
    immutable: true,
  },
  
  /**
   * GST (Goods and Services Tax) Number
   * Indian tax registration number
   */
  GST: {
    type: String,
    trim: true,
    uppercase: true,
  },
  
  /**
   * CIN (Corporate Identification Number)
   * Indian company registration number
   * IMMUTABLE - Cannot be changed after creation
   */
  CIN: {
    type: String,
    trim: true,
    uppercase: true,
    immutable: true,
  },
  
  /**
   * System client flag
   * TRUE only for the default organization client (C123456)
   * System clients cannot be deleted or edited directly
   */
  isSystemClient: {
    type: Boolean,
    default: false,
    immutable: true, // Cannot change after creation
  },

  /**
   * Internal client flag - represents the firm itself
   * Auto-created by the system during firm creation/backfill
   */
  isInternal: {
    type: Boolean,
    default: false,
    immutable: true,
    index: true,
  },

  /**
   * Default client flag - marks this client as the organization's root account.
   * The first client created during onboarding is the default client.
   * Default clients cannot be deleted or deactivated.
   * Only one default client per organization (enforced by partial unique index).
   */
  isDefaultClient: {
    type: Boolean,
    default: false,
    immutable: true,
  },

  /**
   * URL-safe slug for the organization (only relevant for isDefaultClient=true clients).
   * Used for tenant-scoped login URLs: /f/:firmSlug/login
   */
  firmSlug: {
    type: String,
    lowercase: true,
    trim: true,
    sparse: true,
    index: true,
  },

  /**
   * System provenance for auto-created clients
   */
  createdBySystem: {
    type: Boolean,
    default: false,
    immutable: true,
  },
  
  /**
   * Client lifecycle status
   * ACTIVE: Client can be used for new cases
   * INACTIVE: Client cannot be used for new cases (soft delete)
   * Maintains data integrity and audit trail
   * System clients (isSystemClient: true) cannot be deactivated
   */
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE',
  },

  storageType: {
    type: String,
    enum: ['docketra', 'external'],
    default: 'docketra',
  },

  storageProvider: {
    type: String,
    default: null,
    validate: {
      validator: function(value) {
        return value === null || ['google', 'aws', 'azure', 'onedrive'].includes(value);
      },
      message: 'Storage provider must be google, aws, azure, or onedrive',
    },
  },

  storageConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  
  /**
   * Legacy soft delete flag - kept for backward compatibility
   * Use status field for new implementations
   * @deprecated
   */
  isActive: {
    type: Boolean,
    default: true,
  },
  
  /**
   * xID of user who created the client
   * 
   * ✅ CANONICAL IDENTIFIER - REQUIRED FOR OWNERSHIP ✅
   * 
   * This is the authoritative field for tracking who created the client.
   * Format: X123456
   * Immutable after creation
   * 
   * Set server-side from authenticated user context (req.user.xID)
   * NEVER accept this from client payload
   */
  createdByXid: {
    type: String,
    required: [true, 'Creator xID is required'],
    uppercase: true,
    trim: true,
    immutable: true,
  },
  
  /**
   * Email of user who created the client
   * 
   * ⚠️ DEPRECATED - FOR DISPLAY PURPOSES ONLY ⚠️
   * 
   * This field is kept for backward compatibility with existing client records.
   * 
   * NEVER use this field for:
   * - Ownership logic
   * - Authorization checks
   * - Client queries
   * 
   * ALWAYS use createdByXid instead for all ownership and authorization logic.
   */
  createdBy: {
    type: String,
    lowercase: true,
    trim: true,
  },
}, {
  // Automatic timestamp management for audit trail
  timestamps: true,
});

/**
 * Pre-save Hook: Auto-generate clientId (Fallback)
 * 
 * DEPRECATION NOTICE: This hook serves as a fallback only.
 * clientId generation should now happen explicitly in the controller via clientIdGenerator service.
 * 
 * Generates sequential IDs in format C000001 (no dash, 6 digits minimum)
 * Algorithm:
 * 1. Find the highest existing clientId number
 * 2. Increment by 1
 * 3. Format as C prefix + number (minimum 6 digits)
 * 
 * Note: Only runs if clientId is not already set (defensive fallback)
 * 
 * LIMITATION: This fallback implementation has a potential race condition with concurrent saves.
 * The controller should use clientIdGenerator service which uses atomic Counter operations.
 */
clientSchema.pre('save', async function() {
  // Only generate clientId if it's not already set (fallback for legacy/emergency use)
  if (!this.clientId) {
    console.warn('[Client Model] Pre-save hook generating clientId (fallback). Should be generated in controller.');
    // Find the client with the highest clientId number
    // The regex ensures we only match our format: C followed by digits
    const lastClient = await this.constructor.findOne(
      { clientId: /^C\d+$/ },
      { clientId: 1 }
    ).sort({ clientId: -1 }).lean();
    
    let nextNumber = 1; // Start with C000001 for organization client
    
    if (lastClient && lastClient.clientId) {
      // Extract the number from C000001 format
      const match = lastClient.clientId.match(/^C(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    // Format as C + 6-digit zero-padded number
    this.clientId = `C${nextNumber.toString().padStart(6, '0')}`;
  }
});

/**
 * Validation: isSystemClient integrity
 * When a client is marked as isSystemClient=true, it must be the default client for its firm.
 * This validation runs on save operations.
 */
clientSchema.pre('save', async function() {
  // Only validate if isSystemClient is true - ensure only one default/system client per org
  if (this.isSystemClient === true) {
    if (this.isDefaultClient !== true) {
      const error = new Error('System clients must also be the default client for their firm');
      error.name = 'ValidationError';
      throw error;
    }
  }

  if (this.isSystemClient === true && this.isNew && this.firmId) {
    try {
      // Prevent creating a second system client for the same organization
      const existingSystemClient = await mongoose.model('Client').findOne({
        firmId: this.firmId,
        isSystemClient: true,
        _id: { $ne: this._id },
      });
      if (existingSystemClient) {
        const error = new Error('An organization can only have one system client');
        error.name = 'ValidationError';
        throw error;
      }
    } catch (error) {
      if (error.name === 'ValidationError') {
        throw error;
      }
      console.warn('[Client Validation] Could not verify isSystemClient constraint:', error.message);
    }
  }
});

/**
 * Performance Indexes
 * 
 * CRITICAL: Organization-scoped unique index on (firmId, clientId)
 * - Each organization has its own C000001, C000002, etc.
 * - clientId is unique WITHIN an organization, not globally
 * 
 * Other indexes:
 * - businessName: For lookups and searches
 * - isActive: For filtering active vs inactive clients
 * - isSystemClient: For identifying system clients
 * - isDefaultClient: For identifying the organization root client
 * - createdByXid: For ownership queries (canonical identifier)
 * - firmId: For multi-tenancy queries
 */
// MANDATORY: Organization-scoped unique index on (firmId, clientId)
clientSchema.index({ firmId: 1, clientId: 1 }, { unique: true });

clientSchema.index({ isActive: 1 });
clientSchema.index({ firmId: 1, isActive: 1 }); // Firm-scoped active/inactive filters
clientSchema.index({ isSystemClient: 1 });
clientSchema.index({ isDefaultClient: 1 });
clientSchema.index({ businessName: 1 });
clientSchema.index({ createdByXid: 1 }); // CANONICAL - xID-based creator queries
clientSchema.index({ firmId: 1, status: 1 }); // Organization-scoped status queries
clientSchema.index({ firmId: 1 });
clientSchema.index({ firmId: 1, createdAt: -1 });
// Enforce one default client per organization - critical for onboarding integrity
clientSchema.index({ firmId: 1, isDefaultClient: 1 }, {
  unique: true,
  partialFilterExpression: { isDefaultClient: true },
  name: 'org_default_client_unique',
});
// Enforce one internal client per organization - critical for onboarding integrity
clientSchema.index({ firmId: 1, isInternal: 1 }, { 
  unique: true, 
  partialFilterExpression: { isInternal: true },
  name: 'firm_internal_client_unique'
});

clientSchema.plugin(softDeletePlugin);

// ============================================================
// TRANSPARENT FIELD ENCRYPTION — AES-256-GCM envelope model
// ============================================================
// Sensitive Client contact fields are encrypted at rest.  Encryption happens
// at the model layer (pre-save hook).  DECRYPTION happens at the repository
// layer (ClientRepository.js) so that role-based restrictions can be enforced
// before any plaintext is returned to callers.
//
// Encrypted fields:
//   - primaryContactNumber
//   - businessEmail
//
// Note: businessName is NOT encrypted because it is indexed and used for
// display queries where the plaintext must be searchable.
//
// TODO: Write migration script to encrypt existing plaintext fields.

const { looksEncrypted: _clientIsEncryptedValue } = require('../security/encryption.utils');
const { tenantScopeGuardPlugin } = require('./plugins/tenantScopeGuard.plugin');

/** Client fields that must be encrypted before persisting. */
const _CLIENT_SENSITIVE_FIELDS = ['primaryContactNumber', 'businessEmail'];

/**
 * Lazy-cached reference to the encryption service.
 * Using a lazy require avoids potential circular-dependency issues during
 * module initialisation while still benefiting from Node's module cache.
 */
let _clientEncService;
function _getClientEncService() {
  if (!_clientEncService) _clientEncService = require('../security/encryption.service');
  return _clientEncService;
}


async function _encryptClientUpdatePayload(query) {
  if (!process.env.MASTER_ENCRYPTION_KEY) return;
  const update = query.getUpdate();
  if (!update || Array.isArray(update)) return;

  const updateDoc = update;
  const directSet = {};
  for (const field of _CLIENT_SENSITIVE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(updateDoc, field)) {
      directSet[field] = updateDoc[field];
      delete updateDoc[field];
    }
  }

  const setUpdate = {
    ...(updateDoc.$set || {}),
    ...directSet,
  };

  const fieldsToEncrypt = _CLIENT_SENSITIVE_FIELDS.filter((field) => setUpdate[field] != null && !_clientIsEncryptedValue(setUpdate[field]));
  if (!fieldsToEncrypt.length) return;

  const filter = query.getFilter ? query.getFilter() : {};
  const tenantId = String(
    setUpdate.firmId ||
    filter.firmId ||
    query.getOptions()?.firmId ||
    ''
  );
  if (!tenantId) {
    throw new Error('firmId is required to encrypt sensitive client update fields');
  }

  const { encrypt: _enc, ensureTenantKey: _ensure } = _getClientEncService();
  await _ensure(tenantId, { session: query.getOptions?.().session });

  if (typeof setUpdate.businessEmail === 'string' && !_clientIsEncryptedValue(setUpdate.businessEmail)) {
    setUpdate.businessEmail = setUpdate.businessEmail.trim().toLowerCase();
  }

  if (typeof setUpdate.primaryContactNumber === 'string' && !_clientIsEncryptedValue(setUpdate.primaryContactNumber)) {
    setUpdate.primaryContactNumber = setUpdate.primaryContactNumber.trim();
  }

  for (const field of fieldsToEncrypt) {
    setUpdate[field] = await _enc(String(setUpdate[field]), tenantId, {
      session: query.getOptions?.().session,
    });
  }

  updateDoc.$set = setUpdate;
  query.setUpdate(updateDoc);
}

/**
 * Encrypt sensitive fields on a Client document before saving.
 * No-op when MASTER_ENCRYPTION_KEY is not configured.
 */
clientSchema.pre('save', async function () {
  if (this.isModified('storageConfig') && this.storageConfig && typeof this.storageConfig === 'object') {
    if (!isEncryptedStorageConfig(this.storageConfig)) {
      this.storageConfig = {
        encrypted: true,
        value: encryptProtectedValue(JSON.stringify(this.storageConfig)),
      };
    }
  }

  if (!process.env.MASTER_ENCRYPTION_KEY || !this.firmId) return;
  const { encrypt: _enc, ensureTenantKey: _ensure } = _getClientEncService();
  const tenantId = String(this.firmId);
  const session = typeof this.$session === 'function' ? this.$session() : undefined;
  await _ensure(tenantId, { session });
  if (typeof this.businessEmail === 'string' && !_clientIsEncryptedValue(this.businessEmail)) {
    this.businessEmail = this.businessEmail.trim().toLowerCase();
  }

  if (typeof this.primaryContactNumber === 'string' && !_clientIsEncryptedValue(this.primaryContactNumber)) {
    this.primaryContactNumber = this.primaryContactNumber.trim();
  }

  for (const field of _CLIENT_SENSITIVE_FIELDS) {
    if (this[field] != null && !_clientIsEncryptedValue(this[field])) {
      this[field] = await _enc(String(this[field]), tenantId, { session });
    }
  }
});


clientSchema.pre('findOneAndUpdate', async function () {
  await _encryptClientUpdatePayload(this);
});

clientSchema.pre('updateOne', async function () {
  await _encryptClientUpdatePayload(this);
});

clientSchema.pre('updateMany', async function () {
  await _encryptClientUpdatePayload(this);
});

clientSchema.plugin(tenantScopeGuardPlugin);

// VALIDATION: Strict schema enforcement
clientSchema.set('strict', true);

module.exports = mongoose.model('Client', clientSchema);
