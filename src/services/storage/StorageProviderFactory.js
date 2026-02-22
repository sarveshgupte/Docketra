const mongoose = require('mongoose');
const Firm = require('../../models/Firm.model');
const GoogleDriveOAuthProvider = require('./providers/GoogleDriveOAuthProvider');
const OneDriveProvider = require('./providers/OneDriveProvider');

/**
 * Storage Provider Factory
 * Resolves the correct provider based on firm storage configuration.
 * Storage only operates when a firm has connected their own storage (firm_connected mode).
 */
class StorageProviderFactory {
  static async getProvider(firmOrId) {
    if (!firmOrId) {
      throw new Error('Firm context is required to resolve storage provider');
    }

    let firm = firmOrId;

    if (typeof firmOrId === 'string') {
      const isObjectId = mongoose.Types.ObjectId.isValid(firmOrId);
      if (isObjectId) {
        firm = await Firm.findById(firmOrId);
      } else {
        firm = await Firm.findOne({ firmId: firmOrId });
      }
    }

    const storage = firm?.storage || {};
    const mode = storage.mode;

    if (mode === 'firm_connected') {
      switch (storage.provider) {
        case 'google_drive':
          return new GoogleDriveOAuthProvider(storage.google || {});
        case 'onedrive':
          return new OneDriveProvider(storage.onedrive || {});
        default:
          throw new Error('Storage provider is required when mode is firm_connected');
      }
    }

    throw new Error('Storage is only available when a firm has connected their own storage (firm_connected mode)');
  }
}

module.exports = { StorageProviderFactory };
