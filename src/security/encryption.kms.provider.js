const EncryptionProvider = require('./encryption.interface');

/**
 * KmsEncryptionProvider — stub for future Google Cloud KMS integration.
 *
 * All methods throw to make it obvious when the stub is invoked unintentionally.
 * Replace this implementation with a real KMS client when ready.
 *
 * To activate: set ENCRYPTION_PROVIDER=kms in your environment.
 */
class KmsEncryptionProvider extends EncryptionProvider {
  async generateTenantKey(_tenantId) {
    throw new Error('KMS provider not implemented');
  }

  async encrypt(_plaintext, _tenantId) {
    throw new Error('KMS provider not implemented');
  }

  async decrypt(_ciphertext, _tenantId) {
    throw new Error('KMS provider not implemented');
  }

  async generateEncryptedDek() {
    throw new Error('KMS provider not implemented');
  }
}

module.exports = KmsEncryptionProvider;
