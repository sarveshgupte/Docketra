const Team = require('../models/Team.model');

const listTeams = async (req, res) => {
  try {
    const teams = await Team.find({ firmId: req.user?.firmId }).sort({ name: 1 }).lean();
    return res.json({ success: true, data: teams });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch teams' });
  }
};

module.exports = {
  listTeams,
};
