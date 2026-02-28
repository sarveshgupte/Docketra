const EnterpriseInquiry = require('../models/EnterpriseInquiry.model');
const emailService = require('../services/email.service');

const submitEnterpriseInquiry = async (req, res) => {
  const {
    name,
    email,
    firmName,
    numberOfUsers,
    phone,
    requirements,
  } = req.body || {};

  if (!name || !email || !firmName || !numberOfUsers || !phone || !requirements) {
    return res.status(400).json({
      success: false,
      message: 'name, email, firmName, numberOfUsers, phone and requirements are required.',
    });
  }

  const parsedUsers = Number(numberOfUsers);
  if (!Number.isFinite(parsedUsers) || parsedUsers < 1) {
    return res.status(400).json({ success: false, message: 'numberOfUsers must be a positive number.' });
  }

  const inquiry = await EnterpriseInquiry.create({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    firmName: firmName.trim(),
    numberOfUsers: parsedUsers,
    phone: phone.trim(),
    requirements: requirements.trim(),
  });

  try {
    await emailService.sendEnterpriseInquiryNotification({
      name: inquiry.name,
      email: inquiry.email,
      firmName: inquiry.firmName,
      numberOfUsers: inquiry.numberOfUsers,
      phone: inquiry.phone,
      requirements: inquiry.requirements,
    });
  } catch (error) {
    console.warn('[CONTACT] Failed to send enterprise inquiry notification:', error.message);
  }

  return res.status(201).json({ success: true, message: 'Inquiry received. Our enterprise team will contact you soon.' });
};

module.exports = {
  submitEnterpriseInquiry,
};
