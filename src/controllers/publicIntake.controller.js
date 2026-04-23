const crypto = require('crypto');
const Firm = require('../models/Firm.model');
const { safeDecrypt } = require('../utils/encryption');
const { processCmsSubmission } = require('../services/cmsIntake.service');
const { REASON_CODES, logPilotEvent } = require('../services/pilotDiagnostics.service');

const INTAKE_KEY_HEADER = 'x-docketra-intake-key';

function toSha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest();
}

function safeKeyMatch(provided, configured) {
  if (!provided || !configured) return false;
  const providedHash = toSha256(provided);
  const configuredHash = toSha256(configured);
  return crypto.timingSafeEqual(providedHash, configuredHash);
}

const submitApiIntake = async (req, res) => {
  try {
    const firmSlug = String(req.params?.firmSlug || '').trim().toLowerCase();
    if (!firmSlug) {
      logPilotEvent({ event: 'api_intake_rejected', severity: 'warn', metadata: { reasonCode: REASON_CODES.FIRM_CONTEXT_MISSING } });
      return res.status(400).json({ success: false, reasonCode: REASON_CODES.FIRM_CONTEXT_MISSING, error: 'firmSlug is required' });
    }

    const firm = await Firm.findOne({ firmSlug })
      .select('_id intakeConfig.cms.intakeApiEnabled intakeConfig.cms.intakeApiKey')
      .lean();

    if (!firm) {
      return res.status(404).json({ success: false, error: 'Firm not found' });
    }

    if (!firm?.intakeConfig?.cms?.intakeApiEnabled) {
      return res.status(403).json({ success: false, error: 'API intake is not enabled for this firm' });
    }

    const providedKey = String(req.headers?.[INTAKE_KEY_HEADER] || '').trim();
    const configuredKey = safeDecrypt(firm?.intakeConfig?.cms?.intakeApiKey || null);

    if (!providedKey || !safeKeyMatch(providedKey, configuredKey)) {
      return res.status(401).json({ success: false, error: 'Invalid intake API credentials' });
    }

    const idempotencyKey = String(
      req.body?.idempotencyKey
      || req.body?.externalSubmissionId
      || req.headers?.['idempotency-key']
      || '',
    ).trim() || null;

    const result = await processCmsSubmission({
      firmId: firm._id,
      payload: req.body,
      requestMeta: {
        query: req.query,
        headers: req.headers,
        ipAddress: req.socket?.remoteAddress || req.ip || null,
        userAgent: req.get('user-agent') || null,
        receivedAt: new Date().toISOString(),
        idempotencyKey,
      },
      submissionMode: 'api_intake',
    });

    const isReplay = Boolean(result?.metadata?.idempotentReplay);

    return res.status(isReplay ? 200 : 201).json({
      success: true,
      leadId: result?.lead?._id || null,
      clientId: result?.client?.clientId || null,
      docketId: result?.docket?.caseId || null,
      warnings: result?.metadata?.warnings || [],
      warningDetails: result?.metadata?.warningDetails || [],
      workflowSteps: result?.metadata?.workflowSteps || [],
      submissionMode: 'api_intake',
      idempotentReplay: isReplay,
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

module.exports = {
  submitApiIntake,
};
