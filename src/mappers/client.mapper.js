const isEncryptedBlob = (value) => (
  !!value
  && typeof value === 'object'
  && value.encrypted === true
  && typeof value.value === 'string'
);

const sanitizeProtectedValue = (value) => {
  if (isEncryptedBlob(value)) return null;
  return value ?? null;
};

const mapClientResponse = (client) => {
  if (!client) return null;

  return {
    _id: client._id,
    id: client._id?.toString?.() || client.id || null,
    clientId: client.clientId,
    firmId: client.firmId ?? null,
    businessName: client.businessName,
    businessAddress: client.businessAddress ?? null,
    businessEmail: sanitizeProtectedValue(client.businessEmail),
    primaryContactNumber: sanitizeProtectedValue(client.primaryContactNumber),
    secondaryContactNumber: client.secondaryContactNumber ?? null,
    contactPersonName: client.contactPersonName ?? null,
    contactPersonDesignation: client.contactPersonDesignation ?? null,
    contactPersonPhoneNumber: client.contactPersonPhoneNumber ?? null,
    contactPersonEmailAddress: client.contactPersonEmailAddress ?? null,
    PAN: client.PAN ?? null,
    TAN: client.TAN ?? null,
    GST: client.GST ?? null,
    CIN: client.CIN ?? null,
    profileVersion: client.profileRef?.version ?? 0,
    profileProvider: client.profileRef?.provider ?? null,
    status: client.status,
    isActive: client.isActive,
    isSystemClient: Boolean(client.isSystemClient),
    isInternal: Boolean(client.isInternal),
    isDefaultClient: Boolean(client.isDefaultClient),
    createdAt: client.createdAt ?? null,
    updatedAt: client.updatedAt ?? null,
    createdByXid: client.createdByXid ?? null,
    createdBy: client.createdBy ?? null,
    previousBusinessNames: Array.isArray(client.previousBusinessNames) ? client.previousBusinessNames : [],
    clientFactSheet: client.clientFactSheet ?? null,
    drive: client.drive ?? null,
  };
};

module.exports = {
  mapClientResponse,
};
