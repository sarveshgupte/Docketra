const { z, nonEmptyString, clientIdString } = require('./common');

module.exports = {
  'GET /': { query: z.object({}).passthrough() },
  'GET /:clientId': { params: z.object({ clientId: clientIdString }), query: z.object({}).passthrough() },
  'POST /': {
    body: z.object({ name: nonEmptyString }).passthrough(),
  },
  'PUT /:clientId': {
    params: z.object({ clientId: clientIdString }),
    body: z.object({
      businessName: z.string().trim().min(1, 'Business name cannot be empty').optional(),
      businessAddress: z.string().trim().min(1, 'Business address cannot be empty').optional(),
      businessEmail: z.string().trim().min(1, 'Business email cannot be empty').optional(),
      primaryContactNumber: z.string().trim().min(1, 'Primary contact number cannot be empty').optional(),
      secondaryContactNumber: z.string().trim().nullable().optional(),
      PAN: z.never({ invalid_type_error: 'PAN, TAN, and CIN are immutable and cannot be modified after creation.' }).optional(),
      TAN: z.never({ invalid_type_error: 'PAN, TAN, and CIN are immutable and cannot be modified after creation.' }).optional(),
      CIN: z.never({ invalid_type_error: 'PAN, TAN, and CIN are immutable and cannot be modified after creation.' }).optional(),
      GST: z.never({ invalid_type_error: 'Only businessEmail, primaryContactNumber, and secondaryContactNumber can be updated.' }).optional(),
      latitude: z.never({ invalid_type_error: 'Only businessEmail, primaryContactNumber, and secondaryContactNumber can be updated.' }).optional(),
      longitude: z.never({ invalid_type_error: 'Only businessEmail, primaryContactNumber, and secondaryContactNumber can be updated.' }).optional(),
    }).strict(),
  },
  'PATCH /:clientId/status': {
    params: z.object({ clientId: clientIdString }),
    body: z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) }).passthrough(),
  },
  'POST /:clientId/change-name': {
    params: z.object({ clientId: clientIdString }),
    body: z.object({ legalName: nonEmptyString }).passthrough(),
  },
  'PUT /:clientId/fact-sheet': {
    params: z.object({ clientId: clientIdString }),
    body: z.object({}).passthrough(),
  },
  'POST /:clientId/fact-sheet/files': { params: z.object({ clientId: clientIdString }), body: z.object({}).passthrough() },
  'DELETE /:clientId/fact-sheet/files/:fileId': { params: z.object({ clientId: clientIdString, fileId: nonEmptyString }) },
  'POST /:clientId/cfs/files': { params: z.object({ clientId: clientIdString }), body: z.object({}).passthrough() },
  'POST /:clientId/cfs/files/upload-intent': {
    params: z.object({ clientId: clientIdString }),
    body: z.object({
      fileName: nonEmptyString,
      mimeType: nonEmptyString,
      size: z.coerce.number().int().positive(),
      description: z.string().trim().min(1).max(500).optional(),
      fileType: z.string().trim().optional(),
    }).strict(),
  },
  'POST /:clientId/cfs/files/finalize': {
    params: z.object({ clientId: clientIdString }),
    body: z.object({
      uploadId: nonEmptyString,
      completion: z.object({
        providerFileId: z.string().trim().optional(),
        objectKey: z.string().trim().optional(),
      }).optional(),
      checksum: z.string().trim().optional(),
    }).strict(),
  },
  'DELETE /:clientId/cfs/files/:attachmentId': { params: z.object({ clientId: clientIdString, attachmentId: nonEmptyString }) },

  'GET /:clientId/activity': { params: z.object({ clientId: clientIdString }), query: z.object({}).passthrough() },
  'GET /:clientId/cfs/comments': { params: z.object({ clientId: clientIdString }), query: z.object({}).passthrough() },
  'POST /:clientId/cfs/comments': { params: z.object({ clientId: clientIdString }), body: z.object({ commentText: nonEmptyString }).passthrough() },
  'GET /:clientId/cfs/files': { params: z.object({ clientId: clientIdString }), query: z.object({}).passthrough() },
  'GET /:clientId/cfs/files/:attachmentId/download': {
    params: z.object({ clientId: clientIdString, attachmentId: nonEmptyString }),
    query: z.object({}).passthrough(),
  },
  'GET /:clientId/dockets': {
    params: z.object({ clientId: clientIdString }),
    query: z.object({ page: z.coerce.number().int().min(1).optional(), limit: z.coerce.number().int().min(1).max(100).optional() }).passthrough(),
  },
};
