const mongoose = require('mongoose');
const User = require('./src/models/User.model.js');

async function run() {
  const admin = new User({
    xID: 'X000123',
    name: 'Admin Missing Context',
    email: 'admin-missing@test.com',
    role: 'Admin',
  });

  try {
    await admin.validate();
    console.log("Validation passed unexpectedly");
  } catch (err) {
    console.log("Validation failed as expected:", err.message);
  }
}
run();
