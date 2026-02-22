const mongoose = require('mongoose');

/**
 * TenantKey — stores the wrapped (encrypted) Data Encryption Key for each tenant.
 *
 * Envelope encryption model:
 *  - A random 32-byte DEK is generated per tenant.
 *  - The DEK is encrypted with the application's MASTER_ENCRYPTION_KEY (KEK).
 *  - Only the encrypted DEK (encryptedDek) is persisted here.
 *  - The plaintext DEK never touches persistent storage.
 *
 * This prevents the superadmin (who has DB access) from decrypting tenant data
 * because the KEK lives outside the database (in the environment / KMS).
 */
const tenantKeySchema = new mongoose.Schema({
  /**
   * Tenant (firm) identifier — matches firmId used across the application.
   * Stored as String to be consistent with the firmId type used in Case / Client models.
   */
  tenantId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  /**
   * DEK encrypted with the KEK (MASTER_ENCRYPTION_KEY).
   * Format: iv:authTag:ciphertext (base64 segments joined by ':')
   */
  encryptedDek: {
    type: String,
    required: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  /** Populated when the DEK is rotated. */
  rotatedAt: {
    type: Date,
  },
});

module.exports = mongoose.model('TenantKey', tenantKeySchema);
