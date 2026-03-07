const mapAuditResponse = (auditEntry, source) => {
  if (!auditEntry) return null;

  const xid = auditEntry.xID || auditEntry.xid || auditEntry.performedByXID || auditEntry.performedBy || null;

  return {
    xid,
    xID: xid,
    action: auditEntry.action || auditEntry.actionType || null,
    userId: auditEntry.userId ? String(auditEntry.userId) : null,
    firmId: auditEntry.firmId ? String(auditEntry.firmId) : null,
    ipAddress: auditEntry.ipAddress || auditEntry.metadata?.ipAddress || null,
    timestamp: auditEntry.timestamp || null,
    source,
    metadata: auditEntry.metadata || {},
    description: auditEntry.description || null,
  };
};

module.exports = {
  mapAuditResponse,
};
