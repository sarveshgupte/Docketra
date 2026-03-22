const validateCaseCommentPayload = (req, res, next) => {
  const { text } = req.body || {};

  if (typeof text !== 'string' || !text.trim()) {
    console.error('[COMMENT_PAYLOAD_VALIDATION] Invalid comment payload', {
      caseId: req.params?.caseId || req.params?.id || null,
      userId: req.user?.xID || null,
      bodyKeys: Object.keys(req.body || {}),
      textType: typeof text,
      textLength: typeof text === 'string' ? text.length : null,
    });
    return res.status(400).json({
      success: false,
      message: 'Invalid comment payload',
      details: 'Comment text is required',
    });
  }

  req.body.text = text.trim();
  console.info('[COMMENT_PAYLOAD_VALIDATION] Comment payload accepted', {
    caseId: req.params?.caseId || req.params?.id || null,
    userId: req.user?.xID || null,
    textLength: req.body.text.length,
    hasNote: Boolean(req.body?.note),
  });
  return next();
};

module.exports = {
  validateCaseCommentPayload,
};
