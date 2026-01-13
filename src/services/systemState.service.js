const STATES = {
  NORMAL: 'NORMAL',
  DEGRADED: 'DEGRADED',
};

let state = STATES.NORMAL;
let reasons = [];

const resetState = () => {
  state = STATES.NORMAL;
  reasons = [];
};

const markDegraded = (reason, details) => {
  state = STATES.DEGRADED;
  if (reasons.some((r) => r.reason === reason)) {
    return;
  }
  reasons.push({
    reason,
    details,
    at: new Date().toISOString(),
  });
};

const setState = (nextState) => {
  state = nextState;
  if (nextState === STATES.NORMAL) {
    reasons = [];
  }
};

const getState = () => ({
  state,
  reasons: [...reasons],
});

const isDegraded = () => state === STATES.DEGRADED;

module.exports = {
  STATES,
  getState,
  isDegraded,
  markDegraded,
  resetState,
  setState,
};
