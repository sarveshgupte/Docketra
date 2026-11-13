'use strict';

const { z, nonEmptyString, objectIdString } = require('./common');

const syncPayloadSchema = z.object({
  cinOrLlpin: nonEmptyString,
  clientId: z.string().trim().optional(),
  runSynchronous: z.boolean().optional(),
}).passthrough();

const filingDraftPayloadSchema = z.object({
  cinOrLlpin: nonEmptyString,
  formType: z.enum(['AOC_4', 'MGT_7', 'MGT_7A', 'AOC-4', 'MGT-7', 'MGT-7A']),
  financialYear: nonEmptyString,
  clientId: z.string().trim().optional(),
  caseId: z.string().trim().optional(),
  filingData: z.record(z.any()).optional(),
  attachments: z.array(z.record(z.any())).optional(),
}).passthrough();

const statutoryDraftPayloadSchema = z.object({
  cinOrLlpin: nonEmptyString,
  documentType: z.enum(['BOARDS_REPORT', 'AOC_1', 'AOC_2', 'MGT_9']),
  financialYear: nonEmptyString,
  title: z.string().trim().optional(),
  inputParameters: z.record(z.any()).optional(),
  caseId: z.string().trim().optional(),
  clientId: z.string().trim().optional(),
}).passthrough();

const statutorySignoffPayloadSchema = z.object({
  approverEmail: z.string().email().optional(),
  approverXID: z.string().trim().optional(),
  approvalType: z.string().trim().optional(),
  caseId: z.string().trim().optional(),
}).passthrough();

module.exports = {
  'POST /sync': {
    body: syncPayloadSchema,
  },
  'GET /records': {
    query: z.object({
      status: z.string().trim().optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }).passthrough(),
  },
  'GET /records/:cin': {
    params: z.object({
      cin: nonEmptyString,
    }),
  },
  'GET /alerts': {
    query: z.object({
      dscThresholdDays: z.coerce.number().int().min(1).max(365).optional(),
    }).passthrough(),
  },
  'POST /filings/draft': {
    body: filingDraftPayloadSchema,
  },
  'GET /filings/:id/review': {
    params: z.object({
      id: objectIdString,
    }),
  },
  'POST /filings/:id/export': {
    params: z.object({
      id: objectIdString,
    }),
  },
  'POST /statutory/draft': {
    body: statutoryDraftPayloadSchema,
  },
  'POST /statutory/:id/signoff': {
    params: z.object({
      id: objectIdString,
    }),
    body: statutorySignoffPayloadSchema,
  },
};
