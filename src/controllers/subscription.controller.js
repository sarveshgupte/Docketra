const subscriptionService = require('../services/subscriptionPayment.service');
const log = require('../utils/log');

/**
 * Controller for Firm Subscriptions and UPI Payments
 */

const getSubscriptionOverview = async (req, res, next) => {
  try {
    const firmId = req.firmId || req.user?.firmId;
    const overview = await subscriptionService.getCurrentSubscription({ firmId });
    return res.status(200).json({
      success: true,
      data: overview,
    });
  } catch (error) {
    log.error('[SUBSCRIPTION_GET_OVERVIEW_ERROR]', error);
    return next(error);
  }
};

const createOrder = async (req, res, next) => {
  try {
    const firmId = req.firmId || req.user?.firmId;
    const userId = req.user?._id || req.user?.id;
    const { plan, billingCycle } = req.body;

    const order = await subscriptionService.createSubscriptionOrder({
      firmId,
      userId,
      plan,
      billingCycle,
    });

    return res.status(201).json({
      success: true,
      message: 'Subscription order created successfully',
      data: order,
    });
  } catch (error) {
    log.error('[SUBSCRIPTION_CREATE_ORDER_ERROR]', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to create subscription order',
    });
  }
};

const getOrder = async (req, res, next) => {
  try {
    const firmId = req.firmId || req.user?.firmId;
    const { orderId } = req.params;

    const order = await subscriptionService.getOrderStatus({ orderId, firmId });
    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    log.error('[SUBSCRIPTION_GET_ORDER_ERROR]', error);
    return res.status(404).json({
      success: false,
      message: error.message || 'Order not found',
    });
  }
};

const verifyUtr = async (req, res, next) => {
  try {
    const firmId = req.firmId || req.user?.firmId;
    const userId = req.user?._id || req.user?.id;
    const { orderId } = req.params;
    const { utr } = req.body;

    const result = await subscriptionService.verifyUtrAndActivate({
      orderId,
      firmId,
      utr,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    log.error('[SUBSCRIPTION_VERIFY_UTR_ERROR]', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to verify UTR and activate plan',
    });
  }
};

const webhook = async (req, res, next) => {
  try {
    const { orderId, utr, amount } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    const result = await subscriptionService.handleGatewayWebhook({
      orderId,
      utr,
      amount,
    });

    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      data: result,
    });
  } catch (error) {
    log.error('[SUBSCRIPTION_WEBHOOK_ERROR]', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to process webhook',
    });
  }
};

module.exports = {
  getSubscriptionOverview,
  createOrder,
  getOrder,
  verifyUtr,
  webhook,
};
