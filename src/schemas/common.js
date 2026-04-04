const { z } = require('zod');

const nonEmptyString = z.string().trim().min(1);
// VALIDATION: Strict schema enforcement
const xidString = z.string().trim().toUpperCase().regex(/^X\d{6}$/i, 'xID must be in format X123456');
const clientIdString = z.string().trim().toUpperCase().regex(/^C\d{6}$/i, 'clientId must be in format C123456');
const caseIdString = z.string().trim().regex(/^CASE-\d{8}-\d{5}$/i, 'caseId must be in format CASE-YYYYMMDD-00001');
const objectIdString = z.string().trim().regex(/^[a-f\d]{24}$/i, 'must be a valid Mongo ObjectId');
const queryBoolean = z
  .union([z.boolean(), z.string().trim().toLowerCase()])
  .transform((value, ctx) => {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1' || value === 'yes' || value === 'on') return true;
    if (value === 'false' || value === '0' || value === 'no' || value === 'off') return false;

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'must be a boolean-like value',
    });
    return z.NEVER;
  });

module.exports = {
  z,
  nonEmptyString,
  xidString,
  clientIdString,
  caseIdString,
  objectIdString,
  queryBoolean,
};
