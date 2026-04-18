const { processCmsSubmission } = require('../services/cmsIntake.service');

const submitCmsIntake = async (req, res) => {
  try {
    const result = await processCmsSubmission({
      firmId: req.body?.firmId,
      payload: req.body,
      requestMeta: {
        query: req.query,
        headers: req.headers,
        ipAddress: req.socket?.remoteAddress || req.ip || null,
        userAgent: req.get('user-agent') || null,
        receivedAt: new Date().toISOString(),
      },
      actor: {
        xid: req.user?.xid || req.user?.xID || 'SYSTEM',
        role: req.user?.role || 'SYSTEM',
      },
      submissionMode: 'cms',
    });

    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

module.exports = {
  submitCmsIntake,
};
