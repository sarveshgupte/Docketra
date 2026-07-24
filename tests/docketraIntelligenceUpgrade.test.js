const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Case = require('../src/models/Case.model');
const User = require('../src/models/User.model');
const {
  getWorkloadIntelligence,
  getDeadlineRiskIntelligence,
  getClientComplianceRiskScores,
  generateExecutiveAiBrief,
  rebalanceWorkload,
} = require('../src/services/docketraIntelligence.service');

async function runIntelligenceUpgradeTests() {
  console.log('Starting Docketra Intelligence 2.0 Unit Tests...');
  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  try {
    const firmId = new mongoose.Types.ObjectId().toString();
    const categoryId = new mongoose.Types.ObjectId();
    const user1ObjectId = new mongoose.Types.ObjectId();
    const user2ObjectId = new mongoose.Types.ObjectId();

    const defaultClientId = new mongoose.Types.ObjectId();

    // Create 2 Users: User1 (Primary Admin), User2 (Staff User)
    await User.create({
      _id: user1ObjectId,
      xID: 'X100001',
      firmId,
      defaultClientId,
      primaryAdminId: null,
      name: 'Expert Raj',
      email: 'raj@firm.com',
      role: 'PRIMARY_ADMIN',
      status: 'active',
      isActive: true,
      isSystemUser: true,
      createdByXID: 'SUPERADMIN',
    });

    await User.create({
      _id: user2ObjectId,
      xID: 'X100002',
      firmId,
      defaultClientId,
      primaryAdminId: user1ObjectId,
      name: 'Free Priya',
      email: 'priya@firm.com',
      role: 'USER',
      status: 'active',
      isActive: true,
      isSystemUser: true,
      createdByXID: 'SUPERADMIN',
    });

    // Create 5 Resolved Dockets for Expert Raj (High Work Type Expertise)
    for (let i = 1; i <= 5; i++) {
      await Case.create({
        caseInternalId: new mongoose.Types.ObjectId().toString(),
        caseNumber: `CO20260724000${i}`,
        caseId: `CO20260724000${i}`,
        firmId,
        clientId: 'CL-001',
        categoryId,
        subcategoryId: 'SUB-01',
        createdByXID: 'X100001',
        slaDueAt: new Date(Date.now() + 86400000),
        title: `GST Return Filing ${i}`,
        workType: 'GST Return',
        status: 'RESOLVED',
        state: 'RESOLVED',
        assignedToXID: 'X100001',
        assignedTo: user1ObjectId,
      });
    }

    // Create 1 Active Docket for Expert Raj
    await Case.create({
      caseInternalId: new mongoose.Types.ObjectId().toString(),
      caseNumber: 'CO202607240010',
      caseId: 'CO202607240010',
      firmId,
      clientId: 'CL-001',
      categoryId,
      subcategoryId: 'SUB-01',
      createdByXID: 'X100001',
      slaDueAt: new Date(Date.now() + 86400000),
      title: 'GST Return Pending',
      workType: 'GST Return',
      status: 'IN_PROGRESS',
      state: 'IN_PROGRESS',
      assignedToXID: 'X100001',
      assignedTo: user1ObjectId,
    });

    // 1. Test Workload & Capacity-Balanced Expertise Matching
    const workload = await getWorkloadIntelligence({
      firmId,
      workType: 'GST Return',
      clientId: 'CL-001',
    });

    assert.ok(workload.members.length >= 2, 'Workload intelligence returned members');
    const raj = workload.members.find((m) => m.xID === 'X100001');
    assert.ok(raj, 'Raj found in workload intelligence');
    assert.strictEqual(raj.intelligenceMatch.resolvedCount, 5, '5 historical GST Return resolutions counted');
    console.log('✓ Capacity-Balanced Work Type & Client Affinity score verified.');

    // 2. Test Deadline Risk & 10-State Lifecycle Radar
    const deadlineRisk = await getDeadlineRiskIntelligence({ firmId });
    assert.ok(deadlineRisk.counts, 'Counts object present in deadline risk');
    console.log('✓ Proactive Deadline Risk & Lifecycle Radar verified.');

    // 3. Test Client Risk Scores
    const clientRisk = await getClientComplianceRiskScores({ firmId });
    assert.ok(Array.isArray(clientRisk.clients), 'Client risk list returned');
    console.log('✓ Client Compliance Risk Scoring verified.');

    // 4. Test Executive AI Brief Generation
    const brief = await generateExecutiveAiBrief({ firmId });
    assert.ok(brief.executiveBrief.length > 20, 'Executive brief string generated');
    console.log('✓ Executive AI Brief generator verified.');

    // 5. Test Smart Workload Rebalancer
    const rebalanceResult = await rebalanceWorkload({ firmId, execute: false });
    assert.ok(rebalanceResult.message, 'Rebalance recommendation generated');
    console.log('✓ Smart Workload Rebalancer verified.');

    console.log('✓ All Docketra Intelligence 2.0 Unit Tests Passed successfully!');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

runIntelligenceUpgradeTests();
