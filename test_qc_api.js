const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

const run = async () => {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const User = require('./src/models/User.model');
  const { getCases } = require('./src/controllers/case.controller');

  // Find user Sarvesh Gupte
  const user = await User.findOne({ email: 'sarveshgupte@gmail.com' });
  console.log('Found user:', {
    _id: user._id,
    xID: user.xID,
    role: user.role,
    firmId: user.firmId,
  });

  // Mock req and res objects
  // req.user has firmId mapping as defined in our auth middleware
  const req = {
    user: {
      ...user.toObject(),
      _id: user._id.toString(),
      id: user._id.toString(),
      firmId: '69de10f8761bb7db6c320183', // legacy firmId
    },
    query: {
      status: 'IN_QC'
    }
  };

  const res = {
    status: function(code) {
      console.log('Response Status:', code);
      return this;
    },
    json: function(data) {
      console.log('Response JSON:', JSON.stringify(data, null, 2));
      return this;
    }
  };

  try {
    await getCases(req, res);
  } catch (err) {
    console.error('Controller Error:', err);
  }

  mongoose.connection.close();
};

run();
