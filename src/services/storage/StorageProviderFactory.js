const { google } = require('googleapis');
const StorageConfiguration = require('../../models/StorageConfiguration.model');
const { decrypt } = require('../../storage/services/TokenEncryption.service');
const GoogleDriveProvider = require('./providers/GoogleDriveProvider');

class StorageProviderFactory {
  static async getProvider(firmId) {
    if (!firmId) throw new Error('Firm context is required to resolve storage provider');

    const config = await StorageConfiguration.findOne({ firmId, isActive: true }).lean();
    if (!config) {
      throw new Error('No active storage configuration');
    }
    if (config.provider !== 'google-drive') {
      throw new Error('Only google-drive provider is supported');
    }

    const oauthClient = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_OAUTH_REDIRECT_URI
    );
    oauthClient.setCredentials({ refresh_token: decrypt(config.credentials.googleRefreshToken) });

    return new GoogleDriveProvider({ oauthClient, driveId: config.driveId || null });
  }
}

module.exports = { StorageProviderFactory };
