/**
 * EncryptionProvider — Abstract interface for pluggable encryption backends.
 *
 * Envelope encryption architecture:
 *  1. A per-tenant Data Encryption Key (DEK) is generated and stored in MongoDB
 *     wrapped (encrypted) by a Key Encryption Key (KEK) that lives outside the DB.
 *  2. Sensitive fields are encrypted/decrypted with the unwrapped DEK at the
 *     repository layer — never in controllers or routes.
 *
 * Concrete implementations:
 *  - LocalEncryptionProvider  (AES-256-GCM, KEK from env)
 *  - KmsEncryptionProvider    (stub — future Google Cloud KMS integration)
 */
class EncryptionProvider {
  /**
   * Generate and persist a new DEK for the given tenant.
   * The DEK is stored encrypted (envelope model); the plaintext DEK is discarded.
   *
   * @param {string} tenantId
   * @returns {Promise<void>}
   */
  // eslint-disable-next-line no-unused-vars
  async generateTenantKey(tenantId) {
    throw new Error('EncryptionProvider.generateTenantKey() must be implemented');
  }

  /**
   * Encrypt a plaintext string using the tenant's DEK.
   *
   * @param {string} plaintext
   * @param {string} tenantId
   * @returns {Promise<string>}  Encoded ciphertext (iv:authTag:ciphertext in base64)
   */
  // eslint-disable-next-line no-unused-vars
  async encrypt(plaintext, tenantId) {
    throw new Error('EncryptionProvider.encrypt() must be implemented');
  }

  /**
   * Decrypt a ciphertext string using the tenant's DEK.
   *
   * @param {string} ciphertext  Encoded as iv:authTag:ciphertext (base64)
   * @param {string} tenantId
   * @returns {Promise<string>}  Plaintext
   */
  // eslint-disable-next-line no-unused-vars
  async decrypt(ciphertext, tenantId) {
    throw new Error('EncryptionProvider.decrypt() must be implemented');
  }

  /**
   * Generate a new encrypted DEK without persisting it.
   * Used for atomic tenant key creation inside a MongoDB transaction.
   *
   * @returns {Promise<string>}  Encrypted DEK as iv:authTag:ciphertext (base64)
   */
  async generateEncryptedDek() {
    throw new Error('EncryptionProvider.generateEncryptedDek() must be implemented');
  }
}

module.exports = EncryptionProvider;
