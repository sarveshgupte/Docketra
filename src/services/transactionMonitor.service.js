let sessionStartFailures = 0;
let unavailableResponses = 0;

const recordTransactionFailure = (type = 'start') => {
  if (type === 'start') {
    sessionStartFailures += 1;
  } else if (type === 'unavailable') {
    unavailableResponses += 1;
  }
};

const getTransactionMetrics = () => ({
  sessionStartFailures,
  unavailableResponses,
});

module.exports = {
  recordTransactionFailure,
  getTransactionMetrics,
};
