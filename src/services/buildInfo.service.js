const log = require('../utils/log');
const getBuildMetadata = () => {
  return {
    version: process.env.BUILD_VERSION || 'unknown',
    commit: process.env.GIT_COMMIT || 'unknown',
    buildTimestamp: process.env.BUILD_TIMESTAMP || process.env.BUILD_TIME || 'unknown',
  };
};

const logBuildMetadata = () => {
  const meta = getBuildMetadata();
  log.info('[BUILD] Metadata', meta);
};

module.exports = {
  getBuildMetadata,
  logBuildMetadata,
};
