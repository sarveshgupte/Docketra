const Attachment = require('../models/Attachment.model');

class AttachmentRepository {
  static async findByClientSource(firmId, clientId, source = 'client_cfs') {
    return Attachment.find({
      firmId,
      clientId,
      source,
      deletedAt: { $exists: false },
    }).sort({ createdAt: -1 });
  }
}

module.exports = AttachmentRepository;
