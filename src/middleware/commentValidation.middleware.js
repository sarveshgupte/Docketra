const validateCaseCommentPayload = (req, res, next) => {
  const { text } = req.body || {};

  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Invalid comment payload',
      details: 'Comment text is required',
    });
  }

  req.body.text = text.trim();
  return next();
};

module.exports = {
  validateCaseCommentPayload,
};
