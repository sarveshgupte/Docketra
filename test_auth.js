const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

const run = async () => {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const User = require('./src/models/User.model');
  const { resolveRequestFirmRole, resolveFirmRole } = require('./src/services/authorization.service');

  // Find user Sarvesh Gupte
  const user = await User.findOne({ email: 'sarveshgupte@gmail.com' });
  console.log('Found user:', {
    _id: user._id,
    xID: user.xID,
    role: user.role,
    firmId: user.firmId,
  });

  // Mock req object
  const req = {
    user: user,
    userId: user._id.toString(),
    firm: {
      id: '69de10f8761bb7db6c320184', // canonical firmId
    }
  };

  const firmId = '69de10f8761bb7db6c320184';

  try {
    const result = await resolveRequestFirmRole(req, firmId);
    console.log('resolveRequestFirmRole result:', result);
  } catch (err) {
    console.error('Error:', err);
  }

  mongoose.connection.close();
};

run();
