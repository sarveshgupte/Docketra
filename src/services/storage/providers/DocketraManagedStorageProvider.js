const { google } = require('googleapis');
const GoogleDriveProvider = require('./GoogleDriveProvider');
const { StorageAccessError } = require('../errors');

function managedConfigError(firmId) {
  const error = new StorageAccessError('Managed storage backend is not configured', String(firmId || 'unknown'));
  error.code = 'MANAGED_STORAGE_NOT_CONFIGURED';
  error.statusCode = 503;
  return error;
}

class DocketraManagedStorageProvider extends GoogleDriveProvider {
  constructor({ firmId }) {
    const normalizedFirmId = String(firmId || '').trim();
    if (!normalizedFirmId) {
      throw managedConfigError('unknown');
    }

    const provider = String(process.env.MANAGED_STORAGE_PROVIDER || '').trim().toLowerCase();
    const rootFolderId = String(process.env.DRIVE_ROOT_FOLDER_ID || '').trim();
    const clientEmail = String(process.env.MANAGED_GOOGLE_CLIENT_EMAIL || '').trim();
    const privateKey = String(process.env.MANAGED_GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();

    if (provider !== 'google_drive' || !rootFolderId || !clientEmail || !privateKey) {
      throw managedConfigError(normalizedFirmId);
    }

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    super({ oauthClient: auth });
    this.providerName = 'docketra_managed';
    this.rootFolderId = rootFolderId;
    this.firmId = normalizedFirmId;
  }


  async getOrCreateFolder(parentFolderId = null, folderName) {
    const resolvedParentFolderId = parentFolderId || this.rootFolderId;
    return super.getOrCreateFolder(resolvedParentFolderId, folderName);
  }
}


module.exports = DocketraManagedStorageProvider;
