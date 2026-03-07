export const getCaseListRecords = (payload) => {
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.cases)) {
    return payload.cases;
  }

  return [];
};
