const mongoose = require('mongoose');
const Lead = require('../models/Lead.model');
const Invoice = require('../models/Invoice.model');
const CrmClient = require('../models/CrmClient.model');
const { assertFirmContext } = require('../utils/tenantGuard');

const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const getInsightsOverview = async (req, res) => {
  try {
    assertFirmContext(req);

    const firmId = req.user.firmId;
    const fromDate = parseDate(req.query.fromDate);
    const toDate = parseDate(req.query.toDate);

    const leadDateFilter = {};
    if (fromDate) leadDateFilter.$gte = fromDate;
    if (toDate) leadDateFilter.$lte = toDate;
    const hasLeadDateFilter = Object.keys(leadDateFilter).length > 0;

    const invoiceDateFilter = {};
    if (fromDate) invoiceDateFilter.$gte = fromDate;
    if (toDate) invoiceDateFilter.$lte = toDate;
    const hasInvoiceDateFilter = Object.keys(invoiceDateFilter).length > 0;

    const leadMatch = { firmId: new mongoose.Types.ObjectId(firmId) };
    if (hasLeadDateFilter) leadMatch.createdAt = leadDateFilter;

    const invoiceMatch = { firmId: new mongoose.Types.ObjectId(firmId) };
    if (hasInvoiceDateFilter) invoiceMatch.issuedAt = invoiceDateFilter;

    const [leadAgg, invoiceAgg, revenueByClientAgg, leadSourceAgg] = await Promise.all([
      // Lead metrics: totalLeads + leadsByStatus
      Lead.aggregate([
        { $match: leadMatch },
        {
          $project: {
            lifecycle: { $ifNull: ['$stage', '$status'] },
          },
        },
        {
          $group: {
            _id: '$lifecycle',
            count: { $sum: 1 },
          },
        },
      ]),

      // Revenue metrics: totalRevenue, unpaidRevenue, totalInvoices
      Invoice.aggregate([
        { $match: invoiceMatch },
        {
          $group: {
            _id: '$status',
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),

      // Revenue by client (top 5 paid)
      Invoice.aggregate([
        { $match: { ...invoiceMatch, status: 'paid' } },
        {
          $group: {
            _id: '$clientId',
            totalPaid: { $sum: '$amount' },
          },
        },
        { $sort: { totalPaid: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'crmclients',
            localField: '_id',
            foreignField: '_id',
            as: 'client',
          },
        },
        {
          $project: {
            _id: 0,
            clientId: '$_id',
            clientName: { $ifNull: [{ $arrayElemAt: ['$client.name', 0] }, 'Unknown'] },
            totalPaid: 1,
          },
        },
      ]),

      // Lead source breakdown
      Lead.aggregate([
        { $match: leadMatch },
        {
          $group: {
            _id: '$source',
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            source: { $ifNull: ['$_id', 'unknown'] },
            count: 1,
          },
        },
      ]),
    ]);

    // Build lead metrics
    const leadsByStatus = { new: 0, contacted: 0, qualified: 0, converted: 0, lost: 0 };
    let totalLeads = 0;
    for (const bucket of leadAgg) {
      const status = bucket._id;
      if (status in leadsByStatus) {
        leadsByStatus[status] = bucket.count;
      }
      totalLeads += bucket.count;
    }
    const conversionRate = totalLeads > 0
      ? parseFloat(((leadsByStatus.converted / totalLeads) * 100).toFixed(2))
      : 0;

    // Build revenue metrics
    const revenueMap = {};
    let totalInvoices = 0;
    for (const bucket of invoiceAgg) {
      revenueMap[bucket._id] = { total: bucket.total, count: bucket.count };
      totalInvoices += bucket.count;
    }
    const totalRevenue = revenueMap.paid?.total ?? 0;
    const unpaidRevenue = revenueMap.unpaid?.total ?? 0;

    return res.json({
      success: true,
      data: {
        leads: {
          totalLeads,
          leadsByStatus,
        },
        conversion: {
          conversionRate,
        },
        revenue: {
          totalRevenue,
          unpaidRevenue,
          totalInvoices,
        },
        revenueByClient: revenueByClientAgg,
        leadSourceBreakdown: leadSourceAgg,
      },
    });
  } catch (error) {
    if (error.statusCode === 403) {
      return res.status(403).json({ success: false, message: error.message || 'Forbidden' });
    }
    return res.status(500).json({ success: false, message: 'Failed to load insights overview' });
  }
};

module.exports = { getInsightsOverview };
