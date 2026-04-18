const DocketSession = require('../models/DocketSession.model');

async function getDocketTimeSpent(docketId) {
  const result = await DocketSession.aggregate([
    { $match: { docketId } },
    {
      $group: {
        _id: '$docketId',
        totalTime: { $sum: '$activeSeconds' },
      },
    },
  ]);

  return result[0]?.totalTime || 0;
}

module.exports = {
  getDocketTimeSpent,
};
