const ClientRepository = require('../repositories/ClientRepository');
const { clientProfileStorageService } = require('./clientProfileStorage.service');
const { CANONICAL_CLIENT_STATUSES } = require('../utils/clientStatus');

async function persistClientProfileOrRollback({
  firmId,
  client,
  actorXID,
  profileInput,
  rollbackStatus = CANONICAL_CLIENT_STATUSES.INACTIVE,
  repository = ClientRepository,
  profileService = clientProfileStorageService,
}) {
  try {
    await profileService.createClientProfile({
      firmId,
      client,
      actorXID,
      profileInput,
    });
  } catch (profileError) {
    await repository.updateById(firmId, client._id, { $set: { isActive: false, status: rollbackStatus } }).catch(() => null);
    await client.deleteOne().catch(() => null);
    throw profileError;
  }
}

module.exports = {
  persistClientProfileOrRollback,
};
