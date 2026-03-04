const { z } = require('zod');

const nonEmptyString = z.string().trim().min(1);
// VALIDATION: Strict schema enforcement
const xidString = z.string().trim().toUpperCase().regex(/^X\d{6}$/i, 'xID must be in format X123456');
const clientIdString = z.string().trim().toUpperCase().regex(/^C\d{6}$/i, 'clientId must be in format C123456');
const caseIdString = z.string().trim().regex(/^CASE-\d{8}-\d{5}$/i, 'caseId must be in format CASE-YYYYMMDD-00001');

module.exports = {
  z,
  nonEmptyString,
  xidString,
  clientIdString,
  caseIdString,
};
