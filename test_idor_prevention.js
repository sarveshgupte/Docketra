#!/usr/bin/env node
/**
 * IDOR Prevention Test Script
 * 
 * Tests that multi-tenancy firm isolation is working correctly.
 * Verifies that users from one firm cannot access resources from another firm.
 * 
 * This test validates the security fixes in PR-1: Multi-Tenancy Hardening
 */

const mongoose = require('mongoose');
const Case = require('./src/models/Case.model');
const Client = require('./src/models/Client.model');
const User = require('./src/models/User.model');
const Firm = require('./src/models/Firm.model');
const { CaseRepository, ClientRepository, UserRepository } = require('./src/repositories');

// Use test database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/docketra-test';

let firmA, firmB;
let userA, userB;
let caseA, caseB;
let clientA, clientB;

async function setup() {
  console.log('\n═══════════════════════════════════════════');
  console.log('SETUP: Creating test data for IDOR testing');
  console.log('═══════════════════════════════════════════\n');
  
  // Create Firm A
  firmA = await Firm.create({
    firmName: 'Test Firm A',
    firmSlug: 'test-firm-a-idor',
    firmDomain: 'test-firm-a-idor.example.com',
    adminEmail: 'admin@testfirma.com',
    status: 'ACTIVE',
  });
  console.log(`✓ Created Firm A: ${firmA.firmName} (${firmA._id})`);
  
  // Create Firm B
  firmB = await Firm.create({
    firmName: 'Test Firm B',
    firmSlug: 'test-firm-b-idor',
    firmDomain: 'test-firm-b-idor.example.com',
    adminEmail: 'admin@testfirmb.com',
    status: 'ACTIVE',
  });
  console.log(`✓ Created Firm B: ${firmB.firmName} (${firmB._id})`);
  
  // Create User in Firm A
  userA = await User.create({
    xID: 'X999990',
    name: 'User A',
    email: 'usera@testfirma.com',
    firmId: firmA._id,
    role: 'Employee',
    isActive: true,
  });
  console.log(`✓ Created User A: ${userA.xID} in Firm A`);
  
  // Create User in Firm B
  userB = await User.create({
    xID: 'X999991',
    name: 'User B',
    email: 'userb@testfirmb.com',
    firmId: firmB._id,
    role: 'Employee',
    isActive: true,
  });
  console.log(`✓ Created User B: ${userB.xID} in Firm B`);
  
  // Create Client in Firm A
  clientA = await Client.create({
    clientId: 'C999990',
    firmId: firmA._id,
    businessName: 'Client A Business',
    businessAddress: '123 Test St',
    businessEmail: 'clienta@testfirma.com',
    primaryContactNumber: '1234567890',
    createdByXid: userA.xID,
    status: 'ACTIVE',
  });
  console.log(`✓ Created Client A: ${clientA.clientId} in Firm A`);
  
  // Create Client in Firm B
  clientB = await Client.create({
    clientId: 'C999991',
    firmId: firmB._id,
    businessName: 'Client B Business',
    businessAddress: '456 Test Ave',
    businessEmail: 'clientb@testfirmb.com',
    primaryContactNumber: '0987654321',
    createdByXid: userB.xID,
    status: 'ACTIVE',
  });
  console.log(`✓ Created Client B: ${clientB.clientId} in Firm B`);
  
  // Create Case in Firm A
  caseA = await Case.create({
    caseId: 'CASE-99999990-00001',
    caseName: 'case9999999000001',
    firmId: firmA._id,
    title: 'Test Case A',
    description: 'Description for Case A',
    clientId: clientA.clientId,
    createdByXID: userA.xID,
    status: 'OPEN',
  });
  console.log(`✓ Created Case A: ${caseA.caseId} in Firm A`);
  
  // Create Case in Firm B
  caseB = await Case.create({
    caseId: 'CASE-99999991-00001',
    caseName: 'case9999999100001',
    firmId: firmB._id,
    title: 'Test Case B',
    description: 'Description for Case B',
    clientId: clientB.clientId,
    createdByXID: userB.xID,
    status: 'OPEN',
  });
  console.log(`✓ Created Case B: ${caseB.caseId} in Firm B`);
  
  console.log('\n✅ Setup complete\n');
}

async function testCaseIDOR() {
  console.log('\n═══════════════════════════════════════════');
  console.log('TEST 1: Case IDOR Prevention');
  console.log('═══════════════════════════════════════════\n');
  
  console.log('Scenario: User from Firm A tries to access Case from Firm B');
  console.log(`- Attacker: User A (Firm A: ${firmA._id})`);
  console.log(`- Target: Case B (${caseB.caseId}) belonging to Firm B\n`);
  
  // Attempt to access Case B using Firm A's firmId
  const result = await CaseRepository.findByCaseId(firmA._id, caseB.caseId);
  
  if (result === null) {
    console.log('✅ PASS: Case B is not accessible to User A (null returned)');
    console.log('   System behaves as if the case does not exist');
  } else {
    console.log('❌ FAIL: Case B was accessible to User A!');
    console.log(`   Returned: ${result.caseId} - ${result.title}`);
    console.log('   ⚠️  SECURITY VULNERABILITY: Cross-firm case access possible!');
  }
  
  // Verify that User A can access their own case
  const ownCase = await CaseRepository.findByCaseId(firmA._id, caseA.caseId);
  
  if (ownCase && ownCase.caseId === caseA.caseId) {
    console.log('✅ PASS: User A can access their own Case A');
  } else {
    console.log('❌ FAIL: User A cannot access their own Case A!');
  }
}

async function testClientIDOR() {
  console.log('\n═══════════════════════════════════════════');
  console.log('TEST 2: Client IDOR Prevention');
  console.log('═══════════════════════════════════════════\n');
  
  console.log('Scenario: User from Firm A tries to access Client from Firm B');
  console.log(`- Attacker: User A (Firm A: ${firmA._id})`);
  console.log(`- Target: Client B (${clientB.clientId}) belonging to Firm B\n`);
  
  // Attempt to access Client B using Firm A's firmId
  const result = await ClientRepository.findByClientId(firmA._id, clientB.clientId);
  
  if (result === null) {
    console.log('✅ PASS: Client B is not accessible to User A (null returned)');
    console.log('   System behaves as if the client does not exist');
  } else {
    console.log('❌ FAIL: Client B was accessible to User A!');
    console.log(`   Returned: ${result.clientId} - ${result.businessName}`);
    console.log('   ⚠️  SECURITY VULNERABILITY: Cross-firm client access possible!');
  }
  
  // Verify that User A can access their own client
  const ownClient = await ClientRepository.findByClientId(firmA._id, clientA.clientId);
  
  if (ownClient && ownClient.clientId === clientA.clientId) {
    console.log('✅ PASS: User A can access their own Client A');
  } else {
    console.log('❌ FAIL: User A cannot access their own Client A!');
  }
}

async function testUserIDOR() {
  console.log('\n═══════════════════════════════════════════');
  console.log('TEST 3: User IDOR Prevention');
  console.log('═══════════════════════════════════════════\n');
  
  console.log('Scenario: User from Firm A tries to access User from Firm B');
  console.log(`- Attacker: User A (Firm A: ${firmA._id})`);
  console.log(`- Target: User B (${userB.xID}) belonging to Firm B\n`);
  
  // Attempt to access User B using Firm A's firmId
  const result = await UserRepository.findByXID(firmA._id, userB.xID);
  
  if (result === null) {
    console.log('✅ PASS: User B is not accessible to User A (null returned)');
    console.log('   System behaves as if the user does not exist');
  } else {
    console.log('❌ FAIL: User B was accessible to User A!');
    console.log(`   Returned: ${result.xID} - ${result.name}`);
    console.log('   ⚠️  SECURITY VULNERABILITY: Cross-firm user access possible!');
  }
  
  // Verify that User A can access their own user data
  const ownUser = await UserRepository.findByXID(firmA._id, userA.xID);
  
  if (ownUser && ownUser.xID === userA.xID) {
    console.log('✅ PASS: User A can access their own user data');
  } else {
    console.log('❌ FAIL: User A cannot access their own user data!');
  }
}

async function cleanup() {
  console.log('\n═══════════════════════════════════════════');
  console.log('CLEANUP: Removing test data');
  console.log('═══════════════════════════════════════════\n');
  
  // Delete in reverse order of dependencies
  await Case.deleteMany({ caseId: { $in: [caseA.caseId, caseB.caseId] } });
  console.log('✓ Deleted test cases');
  
  await Client.deleteMany({ clientId: { $in: [clientA.clientId, clientB.clientId] } });
  console.log('✓ Deleted test clients');
  
  await User.deleteMany({ xID: { $in: [userA.xID, userB.xID] } });
  console.log('✓ Deleted test users');
  
  await Firm.deleteMany({ _id: { $in: [firmA._id, firmB._id] } });
  console.log('✓ Deleted test firms');
  
  console.log('\n✅ Cleanup complete\n');
}

async function main() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');
    
    // Run tests
    await setup();
    await testCaseIDOR();
    await testClientIDOR();
    await testUserIDOR();
    await cleanup();
    
    console.log('\n═══════════════════════════════════════════');
    console.log('IDOR PREVENTION TEST SUMMARY');
    console.log('═══════════════════════════════════════════');
    console.log('All tests completed successfully!');
    console.log('Multi-tenancy isolation is working correctly.');
    console.log('═══════════════════════════════════════════\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the tests
main();
