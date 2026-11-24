#!/usr/bin/env node
'use strict';

const assert = require('assert');
const emailBudgetService = require('../src/services/emailBudget.service');
const emailService = require('../src/services/email.service');

async function runTests() {
  console.log('=== Running Email Daily Budget Circuit Breaker Test Suite ===\n');

  const todayKey = new Date().toISOString().slice(0, 10);
  const originalEnvCap = process.env.EMAIL_DAILY_BUDGET_CAP;

  try {
    // -------------------------------------------------------------------------
    // Test 1: Initial state & Default Cap
    // -------------------------------------------------------------------------
    console.log('--- Test 1: Initial Status & Default Cap ---');
    delete process.env.EMAIL_DAILY_BUDGET_CAP;
    await emailBudgetService.resetDailyEmailBudget(todayKey);

    assert.strictEqual(emailBudgetService.getDailyCap(), 250, 'Default daily cap should be 250');

    const initialStatus = await emailBudgetService.getDailyEmailBudgetStatus();
    assert.strictEqual(initialStatus.date, todayKey);
    assert.strictEqual(initialStatus.count, 0);
    assert.strictEqual(initialStatus.cap, 250);
    assert.strictEqual(initialStatus.remaining, 250);
    assert.strictEqual(initialStatus.isCapped, false);

    console.log('  ✓ Initial budget starts at 0 with 250 remaining');

    // -------------------------------------------------------------------------
    // Test 2: Sequential Reservations & Decrement of Remaining
    // -------------------------------------------------------------------------
    console.log('--- Test 2: Sequential Reservations ---');

    const res1 = await emailBudgetService.checkAndIncrementEmailBudget();
    assert.strictEqual(res1.allowed, true);
    assert.strictEqual(res1.count, 1);
    assert.strictEqual(res1.remaining, 249);

    const res2 = await emailBudgetService.checkAndIncrementEmailBudget();
    assert.strictEqual(res2.allowed, true);
    assert.strictEqual(res2.count, 2);
    assert.strictEqual(res2.remaining, 248);

    const midStatus = await emailBudgetService.getDailyEmailBudgetStatus();
    assert.strictEqual(midStatus.count, 2);
    assert.strictEqual(midStatus.remaining, 248);

    console.log('  ✓ Budget reservation increments count and calculates remaining');

    // -------------------------------------------------------------------------
    // Test 3: Rollback on Delivery Failure
    // -------------------------------------------------------------------------
    console.log('--- Test 3: Rollback on Failure ---');

    await emailBudgetService.rollbackEmailBudget();
    const afterRollback = await emailBudgetService.getDailyEmailBudgetStatus();
    assert.strictEqual(afterRollback.count, 1, 'Rollback should decrement count by 1');
    assert.strictEqual(afterRollback.remaining, 249);

    console.log('  ✓ Rollback correctly restores quota reservation on failed delivery');

    // -------------------------------------------------------------------------
    // Test 4: Hard Cap Enforcement & Circuit Breaker Trigger
    // -------------------------------------------------------------------------
    console.log('--- Test 4: Hard Cap Enforcement ---');

    // Set custom low cap for test (e.g. cap = 3)
    process.env.EMAIL_DAILY_BUDGET_CAP = '3';
    await emailBudgetService.resetDailyEmailBudget(todayKey);
    assert.strictEqual(emailBudgetService.getDailyCap(), 3);

    // Reserve 1, 2, 3 (allowed)
    const b1 = await emailBudgetService.checkAndIncrementEmailBudget();
    const b2 = await emailBudgetService.checkAndIncrementEmailBudget();
    const b3 = await emailBudgetService.checkAndIncrementEmailBudget();
    assert.strictEqual(b1.allowed, true);
    assert.strictEqual(b2.allowed, true);
    assert.strictEqual(b3.allowed, true);
    assert.strictEqual(b3.remaining, 0);

    // 4th attempt must be blocked!
    const b4 = await emailBudgetService.checkAndIncrementEmailBudget();
    assert.strictEqual(b4.allowed, false, '4th attempt must be rejected');
    assert.strictEqual(b4.remaining, 0);
    assert.strictEqual(b4.count, 3, 'Count should not exceed cap');

    const cappedStatus = await emailBudgetService.getDailyEmailBudgetStatus();
    assert.strictEqual(cappedStatus.isCapped, true);
    assert.strictEqual(cappedStatus.remaining, 0);

    console.log('  ✓ Circuit breaker cleanly blocks attempts exceeding cap');

    // -------------------------------------------------------------------------
    // Test 5: Integration with sendTransactionalEmail
    // -------------------------------------------------------------------------
    console.log('--- Test 5: Integration with sendTransactionalEmail ---');

    process.env.BREVO_API_KEY = 'mock-key';
    process.env.MAIL_FROM = 'Docketra <noreply@docketra.in>';

    // Because cap of 3 is reached, sendTransactionalEmail must throw EMAIL_DAILY_BUDGET_EXCEEDED
    await assert.rejects(
      () => emailService.sendTransactionalEmail({
        to: 'victim@example.com',
        subject: 'Spam test',
        text: 'Blocked content',
      }),
      /EMAIL_DAILY_BUDGET_EXCEEDED/
    );

    console.log('  ✓ sendTransactionalEmail throws EMAIL_DAILY_BUDGET_EXCEEDED to protect Brevo free tier');

    console.log('\n✅ All Email Daily Budget Circuit Breaker tests passed successfully!\n');
  } finally {
    if (originalEnvCap !== undefined) {
      process.env.EMAIL_DAILY_BUDGET_CAP = originalEnvCap;
    } else {
      delete process.env.EMAIL_DAILY_BUDGET_CAP;
    }
    await emailBudgetService.resetDailyEmailBudget(todayKey);
  }
}

runTests().catch((err) => {
  console.error('❌ Email budget test failed:', err);
  process.exit(1);
});
