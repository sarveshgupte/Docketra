const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcrypt');

async function run() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  console.log("MONGO_URI=" + uri);

  await mongoose.connect(uri);
  const Firm = require('./src/models/Firm.model.js');
  const User = require('./src/models/User.model.js');
  const UserProfile = require('./src/models/UserProfile.model.js');
  const Client = require('./src/models/Client.model.js');

  const firmId = new mongoose.Types.ObjectId();
  const defaultClientId = new mongoose.Types.ObjectId();

  const firm = new Firm({
    _id: firmId,
    firmId: 'F000000',
    name: 'Test Firm',
    firmSlug: 'test-firm',
    status: 'ACTIVE'
  });
  await firm.save();

  const client = new Client({
    _id: defaultClientId,
    firmId: firmId,
    clientId: 'C000000',
    name: 'Default Client'
  });
  await client.save();

  const hash = await bcrypt.hash('password123', 10);
  const user = new User({
    xid: 'X000001',
    firmId: firmId,
    email: 'test@example.com',
    primary_email: 'test@example.com',
    name: 'Test User',
    role: 'Admin',
    authProviders: {
      local: { passwordHash: hash }
    },
    passwordHash: hash,
    status: 'active',
    isActive: true,
    mustSetPassword: false,
    defaultClientId: defaultClientId
  });
  await user.save();

  const profile = new UserProfile({
    xID: 'X000001',
    hasCompletedTutorial: false
  });
  await profile.save();

  console.log("Db setup complete.");
  return mongod;
}
run().then(m => {
  const fs = require('fs');
  fs.writeFileSync('mongo_uri.txt', m.getUri());
  // keep alive
  setInterval(() => {}, 1000);
});
