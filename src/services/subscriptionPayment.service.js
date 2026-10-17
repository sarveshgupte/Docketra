const crypto = require('crypto');
const Firm = require('../models/Firm.model');
const User = require('../models/User.model');
const Client = require('../models/Client.model');
const SubscriptionOrder = require('../models/SubscriptionOrder.model');
const { SUBSCRIPTION_PLANS, PAYMENT_GATEWAY_CONFIG } = require('../constants/subscriptionPlans');
const log = require('../utils/log');

/**
 * Generate a cryptographically random, human-friendly order identifier.
 * Format: ORD-YYYYMMDD-<8 hex chars>
 */
const generateOrderId = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `ORD-${dateStr}-${randomSuffix}`;
};

/**
 * Construct an NPCI-compliant UPI Intent URI.
 * Spec: upi://pay?pa=<vpa>&pn=<name>&am=<amount>&cu=INR&tr=<ref>&tn=<note>
 */
const buildUpiUri = ({ vpa, name, amount, orderId, planName }) => {
  const params = new URLSearchParams({
    pa: vpa,
    pn: name,
    am: Number(amount).toFixed(2),
    cu: 'INR',
    tr: orderId,
    tn: `Docketra ${planName} Plan (${orderId})`,
  });
  return `upi://pay?${params.toString()}`;
};

/**
 * Fetch current subscription status, usage stats, and available plans for a firm.
 */
const getCurrentSubscription = async ({ firmId }) => {
  const firm = await Firm.findById(firmId).lean();
  if (!firm) {
    throw new Error('Firm not found');
  }

  const [activeUsersCount, activeClientsCount, recentOrders] = await Promise.all([
    User.countDocuments({ firmId, status: { $in: ['active', 'invited'] } }),
    Client.countDocuments({ firmId, status: 'active' }),
    SubscriptionOrder.find({ firmId }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  const currentPlanKey = String(firm.plan || 'pilot').toLowerCase();
  const currentPlanConfig = SUBSCRIPTION_PLANS[currentPlanKey] || {
    id: currentPlanKey,
    name: currentPlanKey === 'pilot' ? 'Free Pilot' : currentPlanKey.toUpperCase(),
    maxUsers: firm.maxUsers || 2,
    maxClients: 5,
  };

  return {
    firm: {
      firmId: firm.firmId,
      firmSlug: firm.firmSlug,
      name: firm.name,
      plan: currentPlanKey,
      planName: currentPlanConfig.name,
      maxUsers: firm.maxUsers || currentPlanConfig.maxUsers || 2,
      maxClients: currentPlanConfig.maxClients || null,
      subscriptionStatus: firm.subscriptionStatus || 'active',
      billingStatus: firm.billingStatus || 'active',
    },
    usage: {
      activeUsers: activeUsersCount,
      activeClients: activeClientsCount,
      userCapacityPercent: firm.maxUsers ? Math.min(100, Math.round((activeUsersCount / firm.maxUsers) * 100)) : 0,
    },
    availablePlans: SUBSCRIPTION_PLANS,
    gateway: {
      payeeVpa: PAYMENT_GATEWAY_CONFIG.defaultUpiVpa,
      payeeName: PAYMENT_GATEWAY_CONFIG.defaultPayeeName,
    },
    recentOrders,
  };
};

/**
 * Create a new subscription order with a dynamic UPI QR intent payload.
 */
const createSubscriptionOrder = async ({ firmId, userId, plan, billingCycle }) => {
  const planConfig = SUBSCRIPTION_PLANS[plan];
  if (!planConfig) {
    throw new Error(`Invalid plan: ${plan}. Allowed plans: ${Object.keys(SUBSCRIPTION_PLANS).join(', ')}`);
  }

  const cycle = String(billingCycle).toLowerCase();
  if (!['monthly', 'annual'].includes(cycle)) {
    throw new Error('Invalid billingCycle. Must be "monthly" or "annual".');
  }

  const amount = planConfig.pricing[cycle];
  if (!amount || amount <= 0) {
    throw new Error(`Pricing not configured for plan ${plan} (${cycle})`);
  }

  const orderId = generateOrderId();
  const payeeVpa = PAYMENT_GATEWAY_CONFIG.defaultUpiVpa;
  const payeeName = PAYMENT_GATEWAY_CONFIG.defaultPayeeName;

  const upiUri = buildUpiUri({
    vpa: payeeVpa,
    name: payeeName,
    amount,
    orderId,
    planName: planConfig.name,
  });

  const expiresAt = new Date(Date.now() + PAYMENT_GATEWAY_CONFIG.orderExpiryMinutes * 60 * 1000);

  const order = await SubscriptionOrder.create({
    orderId,
    firmId,
    userId,
    plan,
    billingCycle: cycle,
    amount,
    currency: 'INR',
    payeeVpa,
    payeeName,
    upiUri,
    status: 'PENDING',
    expiresAt,
    metadata: {
      planName: planConfig.name,
      maxUsers: planConfig.maxUsers,
      maxClients: planConfig.maxClients,
    },
  });

  log.info('[SUBSCRIPTION_ORDER_CREATED]', {
    orderId,
    firmId: String(firmId),
    plan,
    cycle,
    amount,
  });

  return {
    orderId: order.orderId,
    plan: order.plan,
    planName: planConfig.name,
    billingCycle: order.billingCycle,
    amount: order.amount,
    currency: order.currency,
    payeeVpa: order.payeeVpa,
    payeeName: order.payeeName,
    upiUri: order.upiUri,
    status: order.status,
    expiresAt: order.expiresAt,
    timeRemainingSeconds: Math.max(0, Math.floor((order.expiresAt.getTime() - Date.now()) / 1000)),
  };
};

/**
 * Fetch status of an existing order.
 */
const getOrderStatus = async ({ orderId, firmId }) => {
  const order = await SubscriptionOrder.findOne({ orderId, firmId });
  if (!order) {
    throw new Error('Order not found');
  }

  // Auto-expire if past expiry
  if (order.status === 'PENDING' && new Date() > order.expiresAt) {
    order.status = 'EXPIRED';
    await order.save();
  }

  return {
    orderId: order.orderId,
    plan: order.plan,
    billingCycle: order.billingCycle,
    amount: order.amount,
    currency: order.currency,
    payeeVpa: order.payeeVpa,
    payeeName: order.payeeName,
    upiUri: order.upiUri,
    status: order.status,
    utr: order.utr,
    paidAt: order.paidAt,
    expiresAt: order.expiresAt,
    timeRemainingSeconds: Math.max(0, Math.floor((order.expiresAt.getTime() - Date.now()) / 1000)),
  };
};

/**
 * Verify payment via customer 12-digit UTR submission and activate subscription.
 */
const verifyUtrAndActivate = async ({ orderId, firmId, utr, userId }) => {
  const cleanedUtr = String(utr || '').trim().toUpperCase();

  // Basic validation: Indian UPI reference numbers / UTR are typically 12 alphanumeric characters
  if (!cleanedUtr || cleanedUtr.length < 8 || cleanedUtr.length > 24) {
    throw new Error('Invalid UTR format. Please enter the valid 12-digit UPI reference number shown in your UPI app.');
  }

  const order = await SubscriptionOrder.findOne({ orderId, firmId });
  if (!order) {
    throw new Error('Order not found');
  }

  if (order.status === 'COMPLETED') {
    return {
      success: true,
      message: 'Order has already been confirmed and completed.',
      order: {
        orderId: order.orderId,
        status: order.status,
        plan: order.plan,
        utr: order.utr,
      },
    };
  }

  if (order.status === 'EXPIRED') {
    throw new Error('This payment session has expired. Please initiate a new order.');
  }

  // Prevent duplicate UTR usage across any completed orders
  const existingWithUtr = await SubscriptionOrder.findOne({
    utr: cleanedUtr,
    status: 'COMPLETED',
    orderId: { $ne: orderId },
  });

  if (existingWithUtr) {
    throw new Error('This UTR reference has already been claimed for another order.');
  }

  const planConfig = SUBSCRIPTION_PLANS[order.plan];
  if (!planConfig) {
    throw new Error(`Plan configuration not found for: ${order.plan}`);
  }

  // Upgrade firm plan & capacity
  const firm = await Firm.findById(firmId);
  if (!firm) {
    throw new Error('Firm not found');
  }

  firm.plan = order.plan;
  firm.maxUsers = planConfig.maxUsers || firm.maxUsers;
  firm.subscriptionStatus = 'active';
  firm.billingStatus = 'active';
  await firm.save();

  // Complete order
  order.status = 'COMPLETED';
  order.utr = cleanedUtr;
  order.paidAt = new Date();
  order.verifiedVia = 'UTR_SUBMISSION';
  if (userId) order.metadata.verifiedByUserId = String(userId);
  await order.save();

  log.info('[SUBSCRIPTION_UPGRADED]', {
    firmId: String(firmId),
    orderId: order.orderId,
    newPlan: order.plan,
    newMaxUsers: firm.maxUsers,
    utr: cleanedUtr,
  });

  return {
    success: true,
    message: `Plan upgraded successfully to ${planConfig.name}! You now have up to ${firm.maxUsers} team seats.`,
    order: {
      orderId: order.orderId,
      status: order.status,
      plan: order.plan,
      planName: planConfig.name,
      utr: order.utr,
      amount: order.amount,
      paidAt: order.paidAt,
    },
    firm: {
      plan: firm.plan,
      maxUsers: firm.maxUsers,
      subscriptionStatus: firm.subscriptionStatus,
    },
  };
};

/**
 * Automated Webhook handler (for YouPI-PG / Banking Observer mesh).
 */
const handleGatewayWebhook = async ({ orderId, utr, amount }) => {
  const order = await SubscriptionOrder.findOne({ orderId });
  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  if (order.status === 'COMPLETED') {
    return { success: true, message: 'Already processed' };
  }

  if (amount && Number(amount) < Number(order.amount)) {
    throw new Error(`Payment amount mismatch: expected ${order.amount}, received ${amount}`);
  }

  const planConfig = SUBSCRIPTION_PLANS[order.plan];
  const firm = await Firm.findById(order.firmId);
  if (!firm) {
    throw new Error('Firm not found for order');
  }

  firm.plan = order.plan;
  firm.maxUsers = planConfig.maxUsers || firm.maxUsers;
  firm.subscriptionStatus = 'active';
  firm.billingStatus = 'active';
  await firm.save();

  order.status = 'COMPLETED';
  order.utr = utr || order.utr || 'WEBHOOK_VERIFIED';
  order.paidAt = new Date();
  order.verifiedVia = 'YOUPI_WEBHOOK';
  await order.save();

  log.info('[SUBSCRIPTION_WEBHOOK_ACTIVATED]', {
    orderId: order.orderId,
    firmId: String(firm._id),
    plan: order.plan,
  });

  return { success: true, orderId: order.orderId, status: order.status };
};

module.exports = {
  getCurrentSubscription,
  createSubscriptionOrder,
  getOrderStatus,
  verifyUtrAndActivate,
  handleGatewayWebhook,
};
