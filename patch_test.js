const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

async function run() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  console.log("MONGO_URI=" + uri);
  return uri;
}
run();
