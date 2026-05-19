function toStringOrNull(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s || null;
}

function serializeDocketDetailDto({ caseObject = {}, client = null, ownerTeam = null, routedTeam = null, assignedUser = null, attachments = [], timeline = [] } = {}) {
  const assigneeXid = toStringOrNull(caseObject.assignedToXID || assignedUser?.xID);
  return {
    docketId: toStringOrNull(caseObject.caseId || caseObject.caseNumber || caseObject._id),
    title: toStringOrNull(caseObject.title || caseObject.caseName),
    description: toStringOrNull(caseObject.description),
    client: client ? {
      id: toStringOrNull(client._id),
      clientId: toStringOrNull(client.clientId),
      name: toStringOrNull(client.businessName || client.name),
      email: toStringOrNull(client.businessEmail || client.email),
      contact: toStringOrNull(client.primaryContactNumber || client.contact),
      isInternal: Boolean(caseObject.isInternal),
    } : null,
    category: (caseObject.category || caseObject.caseCategory) ? {
      id: toStringOrNull(caseObject.categoryId),
      name: toStringOrNull(caseObject.category || caseObject.caseCategory),
    } : null,
    subcategory: (caseObject.subcategory || caseObject.caseSubCategory) ? {
      id: toStringOrNull(caseObject.subcategoryId),
      name: toStringOrNull(caseObject.subcategory || caseObject.caseSubCategory),
    } : null,
    lifecycle: toStringOrNull(caseObject.lifecycle),
    statusLabel: toStringOrNull(caseObject.status),
    assignee: assigneeXid ? { xID: assigneeXid, name: toStringOrNull(assignedUser?.name || caseObject.assignedToName || assigneeXid) } : null,
    workbasket: (ownerTeam || routedTeam) ? {
      id: toStringOrNull(routedTeam?._id || ownerTeam?._id),
      name: toStringOrNull(routedTeam?.name || ownerTeam?.name),
    } : null,
    dates: {
      createdAt: caseObject.createdAt || null,
      updatedAt: caseObject.updatedAt || null,
      dueDate: caseObject.dueDate || null,
      slaDueAt: caseObject.slaDueAt || null,
      pendingUntil: caseObject.pendingUntil || null,
      resolvedAt: caseObject.resolvedAt || null,
      filedAt: caseObject.filedAt || null,
    },
    permissions: caseObject.accessMode || null,
    availableActions: Array.isArray(caseObject.availableActions) ? caseObject.availableActions : undefined,
    attachmentsSummary: {
      total: Array.isArray(attachments) ? attachments.length : 0,
      latestAt: Array.isArray(attachments) && attachments.length ? attachments[attachments.length - 1]?.createdAt || null : null,
    },
    timelineSummary: {
      total: Array.isArray(timeline) ? timeline.length : 0,
      latestAt: Array.isArray(timeline) && timeline.length ? timeline[0]?.timestamp || timeline[0]?.createdAt || null : null,
    },
    sop: caseObject.sopSnapshot ? {
      title: toStringOrNull(caseObject.sopSnapshot.title) || '',
      body: toStringOrNull(caseObject.sopSnapshot.body) || '',
      format: toStringOrNull(caseObject.sopSnapshot.format) || 'plain_text',
      capturedAt: caseObject.sopSnapshot.capturedAt || null,
    } : null,
    checklist: Array.isArray(caseObject.checklist) ? caseObject.checklist.map((item) => ({
      id: toStringOrNull(item?.id),
      title: toStringOrNull(item?.title),
      required: Boolean(item?.required),
      completed: Boolean(item?.completed),
      sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : 0,
    })) : [],
  };
}

module.exports = { serializeDocketDetailDto };
