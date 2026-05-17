const { z, nonEmptyString, clientIdString } = require('./common');

module.exports = {
  'GET /': { query: z.object({}).passthrough() },
  'GET /:clientId': { params: z.object({ clientId: clientIdString }), query: z.object({}).passthrough() },
  'POST /': {
    body: z.object({
      businessName: nonEmptyString,
      businessEmail: z.string().trim().email(),
      primaryContactNumber: z.string().trim().min(1),
      businessAddress: z.string().trim().min(1),
      PAN: z.string().trim().optional(),
      CIN: z.string().trim().optional(),
      TAN: z.string().trim().optional(),
      GST: z.string().trim().optional(),
      city: z.string().trim().min(1),
      state: z.string().trim().min(1),
      pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, 'Invalid pincode'),
      contactPersonName: z.string().trim().min(1),
      contactPersonEmail: z.string().trim().email(),
      contactPersonPhone: z.string().trim().min(1),
    }).strict(),
  },
  'PUT /:clientId': {
    params: z.object({ clientId: clientIdString }),
    body: z.object({
      businessName: z.string().trim().min(1, 'Business name cannot be empty').optional(),
      businessAddress: z.string().trim().min(1, 'Business address cannot be empty').optional(),
      businessEmail: z.string().trim().email('Business email must be valid').optional(),
      primaryContactNumber: z.string().trim().min(1, 'Primary contact number cannot be empty').optional(),
      secondaryContactNumber: z.string().trim().nullable().optional(),
      PAN: z.string().trim().optional(),
      TAN: z.string().trim().optional(),
      CIN: z.string().trim().optional(),
      GST: z.string().trim().optional(),
      city: z.string().trim().min(1, 'City cannot be empty').optional(),
      state: z.string().trim().min(1, 'State cannot be empty').optional(),
      pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, 'Invalid pincode').optional(),
      contactPersonName: z.string().trim().min(1, 'Contact person name cannot be empty').optional(),
      contactPersonEmail: z.string().trim().email('Contact person email must be valid').optional(),
      contactPersonPhone: z.string().trim().min(1, 'Contact person phone cannot be empty').optional(),
      latitude: z.never({ invalid_type_error: 'Latitude is deprecated and cannot be modified.' }).optional(),
      longitude: z.never({ invalid_type_error: 'Longitude is deprecated and cannot be modified.' }).optional(),
    }).strict(),
  },
  'PATCH /:clientId/status': {
    params: z.object({ clientId: clientIdString }),
    body: z.object({ isActive: z.boolean() }).strict(),
  },
  'POST /:clientId/change-name': {
    params: z.object({ clientId: clientIdString }),
    body: z.object({
      newBusinessName: nonEmptyString,
      reason: nonEmptyString,
    }).strict(),
  },
  'PUT /:clientId/fact-sheet': {
    params: z.object({ clientId: clientIdString }),
    body: z.object({
      description: z.string().trim().max(5000).optional(),
      notes: z.string().trim().max(5000).optional(),
      basicInfo: z.object({
        clientName: z.string().trim().max(200).optional(),
        entityType: z.string().trim().max(120).optional(),
        PAN: z.string().trim().max(30).optional(),
        CIN: z.string().trim().max(40).optional(),
        GSTIN: z.string().trim().max(40).optional(),
        address: z.string().trim().max(500).optional(),
        contactPerson: z.string().trim().max(200).optional(),
        email: z.string().trim().email().optional(),
        phone: z.string().trim().max(40).optional(),
      }).strict().optional(),
    }).strict(),
  },
  'POST /:clientId/fact-sheet/files': { params: z.object({ clientId: clientIdString }), body: z.object({}).strict() },
  'DELETE /:clientId/fact-sheet/files/:fileId': { params: z.object({ clientId: clientIdString, fileId: nonEmptyString }) },
  'POST /:clientId/cfs/files': { params: z.object({ clientId: clientIdString }), body: z.object({}).strict() },
  'POST /:clientId/cfs/files/upload-intent': {
    params: z.object({ clientId: clientIdString }),
    body: z.object({
      fileName: nonEmptyString,
      mimeType: nonEmptyString,
      size: z.coerce.number().int().positive(),
      description: z.string().trim().min(1).max(500).optional(),
      fileType: z.string().trim().optional(),
      checksum: z.string().trim().optional(),
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
  'POST /:clientId/cfs/comments': { params: z.object({ clientId: clientIdString }), body: z.object({ commentText: nonEmptyString }).strict() },
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
