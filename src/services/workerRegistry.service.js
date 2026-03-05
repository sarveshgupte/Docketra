const workerStatus = new Map();

const setWorkerStatus = (workerName, status) => {
  if (!workerName) return;
  workerStatus.set(workerName, {
    status,
    updatedAt: new Date().toISOString(),
  });
};

const getWorkerStatuses = () => {
  const snapshot = {};
  for (const [name, info] of workerStatus.entries()) {
    snapshot[name] = info;
  }
  return snapshot;
};

module.exports = {
  setWorkerStatus,
  getWorkerStatuses,
};
