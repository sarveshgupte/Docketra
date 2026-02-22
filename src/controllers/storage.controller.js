const FirmStorage = require('../models/FirmStorage.model');

/**
 * GET /api/storage/status
 *
 * Returns the BYOS storage connection state for the requesting firm.
 * Raw tokens are never included in the response.
 */
const getStorageStatus = async (req, res) => {
  const firmId = req.firmId;

  try {
    const record = await FirmStorage.findOne({ firmId }).select(
      'provider status -_id'
    );

    if (!record) {
      return res.json({ connected: false, provider: null, status: null });
    }

    return res.json({
      // TODO (future PR): also validate tokenExpiry and rootFolderId presence
      // before marking a provider as truly "connected".
      connected: record.status === 'active',
      provider: record.provider,
      status: record.status,
    });
  } catch (err) {
    console.error('[Storage] Failed to query FirmStorage:', { firmId, message: err.message });
    return res.status(500).json({ error: 'Failed to retrieve storage status' });
  }
};

module.exports = { getStorageStatus };
