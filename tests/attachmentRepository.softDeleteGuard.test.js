const assert = require('assert');
const AttachmentRepository = require('../src/repositories/AttachmentRepository');
const Attachment = require('../src/models/Attachment.model');

(async () => {
  const originalFind = Attachment.find;
  let capturedQuery = null;

  Attachment.find = (query) => {
    capturedQuery = query;
    return { sort: async () => [] };
  };

  await AttachmentRepository.findByClientSource('firm-1', 'C000001', 'client_cfs');

  assert.deepStrictEqual(capturedQuery, {
    firmId: 'firm-1',
    clientId: 'C000001',
    source: 'client_cfs',
  }, 'AttachmentRepository should not manually set deletedAt filters');

  Attachment.find = originalFind;
  console.log('attachmentRepository.softDeleteGuard.test passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
