const fs = require('fs');

async function runBenchmark() {
  const NUM_CASES = 5000;
  const casesData = [];
  const usersData = [];

  for (let i = 0; i < NUM_CASES; i++) {
    const email = `user${i % 100}@example.com`; // Only 100 unique users
    usersData.push({
      xID: `X${String(i % 100).padStart(6, '0')}`,
      email,
      status: 'active',
      role: 'staff'
    });
    casesData.push({
      caseId: `C${i}`,
      assignedTo: email,
      firmId: 'firm123',
      title: `Case ${i}`,
      status: 'open',
      _id: `id${i}`
    });
  }

  const casesWithEmail = casesData;
  console.log(`Testing with ${casesWithEmail.length} cases`);

  // Mock DB Delay
  const dbDelay = () => new Promise(resolve => setTimeout(resolve, 1));

  // Mock User.findOne
  const findOne = async (query) => {
    await dbDelay();
    return usersData.find(u => u.email === query.email && u.status !== 'deleted');
  };

  // Mock Case.updateOne and CaseHistory.create
  const updateOne = async () => { await dbDelay(); };
  const create = async () => { await dbDelay(); };

  // Mock User.find
  const find = async (query) => {
    await dbDelay();
    return usersData.filter(u => query.email.$in.includes(u.email) && u.status !== 'deleted');
  };

  // Mock Case.bulkWrite and CaseHistory.insertMany
  const bulkWrite = async () => { await dbDelay(); };
  const insertMany = async () => { await dbDelay(); };

  // Original Approach (N+1)
  console.log('Running Original Approach...');
  const startOriginal = Date.now();
  let successCountOrig = 0;
  for (const caseData of casesWithEmail) {
    const email = caseData.assignedTo.trim().toLowerCase();
    const user = await findOne({ email });
    if (user) {
      await updateOne();
      await create();
      successCountOrig++;
    }
  }
  const timeOriginal = Date.now() - startOriginal;
  console.log(`Original N+1 query time: ${timeOriginal}ms`);

  // Optimized Approach
  console.log('Running Optimized Approach...');
  const startOptimized = Date.now();
  let successCountOpt = 0;
  const emailsToFetch = [...new Set(casesWithEmail.map(c => c.assignedTo.trim().toLowerCase()))];
  const users = await find({ email: { $in: emailsToFetch } });
  const userMap = new Map();
  for (const user of users) {
    userMap.set(user.email.toLowerCase(), user);
  }

  const bulkCaseUpdates = [];
  const bulkHistoryInserts = [];
  for (const caseData of casesWithEmail) {
    const email = caseData.assignedTo.trim().toLowerCase();
    const user = userMap.get(email);
    if (user) {
      bulkCaseUpdates.push({});
      bulkHistoryInserts.push({});
      successCountOpt++;
    }
  }
  if (bulkCaseUpdates.length > 0) {
    await bulkWrite(bulkCaseUpdates);
    await insertMany(bulkHistoryInserts);
  }

  const timeOptimized = Date.now() - startOptimized;
  console.log(`Optimized query time: ${timeOptimized}ms`);

  console.log(`Speedup: ${(timeOriginal / timeOptimized).toFixed(2)}x`);
}

runBenchmark().catch(console.error);
