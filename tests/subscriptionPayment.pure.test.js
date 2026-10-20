#!/usr/bin/env node
const assert = require('assert');
const { SUBSCRIPTION_PLANS, PAYMENT_GATEWAY_CONFIG } = require('../src/constants/subscriptionPlans');

console.log('Running subscriptionPayment.pure.test.js...');

// 1. Validate pricing configurations match founder-pricing and Pricing.jsx
assert.strictEqual(SUBSCRIPTION_PLANS.starter.pricing.annual, 12990, 'Starter annual must be 12990');
assert.strictEqual(SUBSCRIPTION_PLANS.starter.pricing.monthly, 1999, 'Starter monthly must be 1999');
assert.strictEqual(SUBSCRIPTION_PLANS.starter.maxUsers, 5, 'Starter maxUsers must be 5');

assert.strictEqual(SUBSCRIPTION_PLANS.growth.pricing.annual, 21990, 'Growth annual must be 21990');
assert.strictEqual(SUBSCRIPTION_PLANS.growth.pricing.monthly, 2499, 'Growth monthly must be 2499');
assert.strictEqual(SUBSCRIPTION_PLANS.growth.maxUsers, 12, 'Growth maxUsers must be 12');

assert.strictEqual(SUBSCRIPTION_PLANS.pro.pricing.annual, 59990, 'Pro annual must be 59990');
assert.strictEqual(SUBSCRIPTION_PLANS.pro.pricing.monthly, 5999, 'Pro monthly must be 5999');
assert.strictEqual(SUBSCRIPTION_PLANS.pro.maxUsers, 25, 'Pro maxUsers must be 25');

assert.strictEqual(PAYMENT_GATEWAY_CONFIG.defaultUpiVpa, 'sarveshgupte@oksbi', 'Default VPA must match');
assert.strictEqual(PAYMENT_GATEWAY_CONFIG.defaultPayeeName, 'Sarvesh Anand Gupte', 'Default Payee must match');

// 2. Validate Mocked Service Workflow
const Module = require('module');
const originalLoad = Module._load;

const mockOrders = new Map();
let mockFirm = {
  _id: '507f1f77bcf86cd799439011',
  firmId: 'FIRM001',
  firmSlug: 'acme-cs',
  name: 'Acme CS & Associates',
  plan: 'pilot',
  maxUsers: 2,
  subscriptionStatus: 'trial',
  billingStatus: 'pending',
  save: async function () { return this; },
};

Module._load = function (request, parent, isMain) {
  if (request === '../models/Firm.model') {
    return {
      findById: (id) => ({
        lean: async () => mockFirm,
        then: (resolve) => Promise.resolve(resolve(mockFirm)),
      }),
    };
  }
  if (request === '../models/User.model') {
    return {
      countDocuments: async () => 2,
    };
  }
  if (request === '../models/Client.model') {
    return {
      countDocuments: async () => 4,
    };
  }
  if (request === '../models/SubscriptionOrder.model') {
    return {
      create: async (data) => {
        const doc = {
          ...data,
          _id: '507f1f77bcf86cd799439099',
          save: async function () { return this; },
        };
        mockOrders.set(data.orderId, doc);
        return doc;
      },
      findOne: (query) => {
        let result = null;
        if (query.utr && query.status === 'COMPLETED') {
          for (const ord of mockOrders.values()) {
            if (ord.utr === query.utr && ord.status === 'COMPLETED' && ord.orderId !== query.orderId?.$ne) {
              result = ord;
              break;
            }
          }
        } else {
          result = mockOrders.get(query.orderId) || null;
        }
        return {
          lean: async () => result,
          then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
        };
      },
      find: () => ({
        sort: () => ({
          limit: () => ({
            lean: async () => Array.from(mockOrders.values()),
          }),
        }),
      }),
    };
  }
  return originalLoad(request, parent, isMain);
};

const subscriptionService = require('../src/services/subscriptionPayment.service');

(async () => {
  // Test A: Get current overview
  const overview = await subscriptionService.getCurrentSubscription({ firmId: mockFirm._id });
  assert.strictEqual(overview.firm.plan, 'pilot');
  assert.strictEqual(overview.usage.activeUsers, 2);
  assert.strictEqual(overview.gateway.payeeVpa, 'sarveshgupte@oksbi');

  // Test B: Create order for Starter Annual (Pioneer rate ₹12,990)
  const order = await subscriptionService.createSubscriptionOrder({
    firmId: mockFirm._id,
    userId: '507f1f77bcf86cd799439022',
    plan: 'starter',
    billingCycle: 'annual',
  });

  assert.strictEqual(order.amount, 12990);
  assert.strictEqual(order.plan, 'starter');
  assert.strictEqual(order.status, 'PENDING');
  assert.ok(order.upiUri.includes('sarveshgupte%40oksbi') || order.upiUri.includes('sarveshgupte@oksbi'));
  assert.ok(order.upiUri.includes('12990.00'));

  // Test C: Verify order status
  const fetched = await subscriptionService.getOrderStatus({ orderId: order.orderId, firmId: mockFirm._id });
  assert.strictEqual(fetched.status, 'PENDING');
  assert.strictEqual(fetched.amount, 12990);

  // Test D: Invalid UTR rejected
  await assert.rejects(
    async () => {
      await subscriptionService.verifyUtrAndActivate({
        orderId: order.orderId,
        firmId: mockFirm._id,
        utr: '123', // too short
      });
    },
    /Invalid UTR format/
  );

  // Test E: Valid 12-digit UTR activates Starter plan & 5 seats
  const activation = await subscriptionService.verifyUtrAndActivate({
    orderId: order.orderId,
    firmId: mockFirm._id,
    utr: '428819283741',
  });

  assert.strictEqual(activation.success, true);
  assert.strictEqual(activation.order.status, 'COMPLETED');
  assert.strictEqual(mockFirm.plan, 'starter');
  assert.strictEqual(mockFirm.maxUsers, 5);
  assert.strictEqual(mockFirm.subscriptionStatus, 'active');

  // Test F: Duplicate UTR on another order is rejected
  const order2 = await subscriptionService.createSubscriptionOrder({
    firmId: mockFirm._id,
    userId: '507f1f77bcf86cd799439022',
    plan: 'growth',
    billingCycle: 'annual',
  });

  await assert.rejects(
    async () => {
      await subscriptionService.verifyUtrAndActivate({
        orderId: order2.orderId,
        firmId: mockFirm._id,
        utr: '428819283741', // already used
      });
    },
    /already been claimed/
  );

  // Test G: Generate subscription invoice for completed order
  const invoice = await subscriptionService.generateSubscriptionInvoice({
    orderId: order.orderId,
    firmId: mockFirm._id,
  });
  assert.strictEqual(invoice.status, 'PAID');
  assert.strictEqual(invoice.totalAmount, 12990);
  assert.strictEqual(invoice.seller.vpa, 'sarveshgupte@oksbi');
  assert.strictEqual(invoice.paymentDetails.utr, '428819283741');
  assert.ok(invoice.invoiceNumber.startsWith('INV-'));

  console.log('✓ All subscription pure tests passed successfully!');
  process.exit(0);
})().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
