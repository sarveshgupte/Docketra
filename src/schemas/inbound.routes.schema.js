const { z } = require('./common');

module.exports = {
  'POST /email': {
    body: z.any(),
  },
};
