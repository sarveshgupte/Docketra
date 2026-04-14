const mongoose = require('mongoose');
const Case = require('../models/Case.model');
const Client = require('../models/Client.model');
const Comment = require('../models/Comment.model');
const Attachment = require('../models/Attachment.model');
const Team = require('../models/Team.model');
const { enforceTenantScope } = require('../utils/tenantScope');
const CaseStatus = require('../domain/case/caseStatus');
const { logCaseListViewed } = require('../services/auditLog.service');
const caseActionService = require('../services/caseAction.service');

const toObjectIdStringOrNull = (value) => {
  if (!value) {
    return null;
  }

  const normalizedValue = String(value).trim();
  if (!normalizedValue || !mongoose.isValidObjectId(normalizedValue)) {
    return null;
  }

  return normalizedValue;
};

/**
 * Search Controller for Global Search and Worklists
 * PART A - READ-ONLY operations for finding cases and viewing worklists
 * 
 * PR: Hard Cutover to xID - Removed User model import (no longer needed),
 * added CaseStatus import for canonical status constants
 * PR: Fix Pended Case Visibility - Added caseActionService import for auto-reopen
 */

/**
 * Global Search
 * GET /api/search?q=term
 * 
 * Search across all cases accessible to the user
 * Search fields: caseId, clientId, clientName, category, comment text, attachment fileName
 * 
 * Visibility Rules:
 * - Admin: Can see ALL cases
 * - Employee: Can see only cases where:
 *   - They are assigned (assignedToXID matches their xID), OR
 *   - The case category is in their allowedCategories
 * 
 * PR #42: Updated to use xID for assignment matching
 * PR: Hard Cutover to xID - Removed email parameter, use req.user only
 */
const globalSearch = async (req, res) => {
  try {
    const { q } = req.query;
    
    // Get authenticated user from req.user (set by auth middleware)
    const user = req.user;
    const firmId = req.user?.firmId;
    
    if (!user || !user.xID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required - user identity not found',
      });
    }

    if (!firmId) {
      return res.status(400).json({
        success: false,
        message: 'Firm context is required for search',
      });
    }
    
    if (!q || q.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Search query parameter "q" is required',
      });
    }
    
    const searchTerm = q.trim();
    const isAdmin = user.role === 'Admin';
    
    // Escape special regex characters to prevent ReDoS (Regular Expression Denial of Service)
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Build search query
    let caseQuery = {};
    
    // Search in case fields (caseId, clientName, category)
    const caseSearchConditions = [
      { caseId: { $regex: escapedSearchTerm, $options: 'i' } },
      { clientName: { $regex: escapedSearchTerm, $options: 'i' } },
      { category: { $regex: escapedSearchTerm, $options: 'i' } },
    ];
    
    // Include clientId if it exists on the model
    if (searchTerm) {
      caseSearchConditions.push({ clientId: { $regex: escapedSearchTerm, $options: 'i' } });
    }
    
    // Find cases matching direct fields
    if (isAdmin) {
      caseQuery = { $or: caseSearchConditions };
    } else {
      // Employee: Only see assigned or allowed category cases
      // PR #42: Use xID for assignment matching
      // PR: xID Canonicalization - Use assignedToXID field
      caseQuery = {
        $and: [
          { $or: caseSearchConditions },
          {
            $or: [
              { assignedToXID: user.xID }, // CANONICAL: Match by xID in assignedToXID field
              { category: { $in: user.allowedCategories } },
            ],
          },
        ],
      };
    }
    
    const casesFromDirectSearch = await Case.find(enforceTenantScope(caseQuery, req, { source: 'search.global.direct' }))
      .select('caseId title status category clientId clientName createdAt createdBy')
      .lean();
    
    // Search in comments using text index
    let commentsWithMatches = [];
    try {
      commentsWithMatches = await Comment.find(
        enforceTenantScope({ $text: { $search: searchTerm } }, req, { source: 'search.comments.text' }),
        { score: { $meta: 'textScore' } }
      )
        .select('caseId')
        .lean();
    } catch (error) {
      // Text index might not be ready yet, fallback to regex
      commentsWithMatches = await Comment.find(
        enforceTenantScope({ text: { $regex: escapedSearchTerm, $options: 'i' } }, req, { source: 'search.comments.regex' })
      )
        .select('caseId')
        .lean();
    }
    
    // Search in attachments using text index
    let attachmentsWithMatches = [];
    try {
      attachmentsWithMatches = await Attachment.find(
        enforceTenantScope({ $text: { $search: searchTerm } }, req, { source: 'search.attachments.text' }),
        { score: { $meta: 'textScore' } }
      )
        .select('caseId')
        .lean();
    } catch (error) {
      // Text index might not be ready yet, fallback to regex
      attachmentsWithMatches = await Attachment.find(
        enforceTenantScope({ fileName: { $regex: escapedSearchTerm, $options: 'i' } }, req, { source: 'search.attachments.regex' })
      )
        .select('caseId')
        .lean();
    }
    
    // Collect unique caseIds from comments and attachments
    const caseIdsFromComments = [...new Set(commentsWithMatches.map(c => c.caseId))];
    const caseIdsFromAttachments = [...new Set(attachmentsWithMatches.map(a => a.caseId))];
    const caseIdsFromRelated = [...new Set([...caseIdsFromComments, ...caseIdsFromAttachments])];
    
    // Find cases by these caseIds with visibility rules
    let casesFromRelated = [];
    if (caseIdsFromRelated.length > 0) {
      let relatedQuery = { caseId: { $in: caseIdsFromRelated } };
      
      if (!isAdmin) {
        // Apply employee visibility rules
        // PR #42: Use xID for assignment matching
        // PR: xID Canonicalization - Use assignedToXID field
        relatedQuery = {
            $and: [
              { caseId: { $in: caseIdsFromRelated } },
            {
              $or: [
                { assignedToXID: user.xID }, // CANONICAL: Match by xID in assignedToXID field
                { category: { $in: user.allowedCategories } },
              ],
            },
          ],
        };
      }
      
      casesFromRelated = await Case.find(enforceTenantScope(relatedQuery, req, { source: 'search.global.related' }))
        .select('caseId title status category clientId clientName createdAt createdBy')
        .lean();
    }
    
    // Merge results and remove duplicates
    const allCases = [...casesFromDirectSearch, ...casesFromRelated];
    const uniqueCases = [];
    const seenCaseIds = new Set();
    
    for (const c of allCases) {
      if (!seenCaseIds.has(c.caseId)) {
        seenCaseIds.add(c.caseId);
        uniqueCases.push(c);
      }
    }
    
    // Sort by createdAt descending
    uniqueCases.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Log case list view for audit
    await logCaseListViewed({
      viewerXID: user.xID,
      filters: { searchQuery: searchTerm },
      listType: 'GLOBAL_SEARCH',
      resultCount: uniqueCases.length,
      req,
    });
    
    res.json({
      success: true,
      data: uniqueCases.map(c => ({
        caseId: c.caseId,
        title: c.title,
        status: c.status,
        category: c.category,
        clientId: c.clientId || null,
        clientName: c.clientName,
        createdAt: c.createdAt,
        createdBy: c.createdBy,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error performing search',
      error: error.message,
    });
  }
};

/**
 * Category Worklist
 * GET /api/worklists/category/:categoryId
 * 
 * Shows all cases in a specific category
 * Excludes Pending cases
 * Apply visibility rules (Admin sees all, Employee sees only allowed categories)
 * 
 * PR: Hard Cutover to xID - Removed email parameter, use req.user only
 */
const categoryWorklist = async (req, res) => {
  try {
    const { categoryId } = req.params;
    
    // Get authenticated user from req.user (set by auth middleware)
    const user = req.user;
    const firmId = req.user?.firmId || null;
    
    if (!user || !user.xID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required - user identity not found',
      });
    }
    
    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Category ID is required',
      });
    }

    if (!firmId) {
      return res.status(400).json({
        success: false,
        message: 'Firm context is required',
      });
    }
    
    const isAdmin = user.role === 'Admin';
    
    // Check if employee has access to this category
    if (!isAdmin && !user.allowedCategories.includes(categoryId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to view this category',
      });
    }
    
    // Build query: category matches and status is NOT Pending
    const query = {
      category: categoryId,
      status: { $ne: 'Pending' },
    };
    
    const cases = await Case.find(enforceTenantScope(query, req, { source: 'search.categoryWorklist' }))
      .select('caseId createdAt createdBy status clientId clientName')
      .sort({ createdAt: -1 })
      .lean();
    
    // Log case list view for audit
    await logCaseListViewed({
      viewerXID: user.xID,
      filters: { category: categoryId },
      listType: 'CATEGORY_WORKLIST',
      resultCount: cases.length,
      req,
    });
    
    res.json({
      success: true,
      data: (cases || []).map(c => ({
        caseId: c.caseId,
        createdAt: c.createdAt,
        createdBy: c.createdBy,
        status: c.status,
        clientId: c.clientId || null,
        clientName: c.clientName,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching category worklist',
      data: [],
      error: error.message,
    });
  }
};

/**
 * Employee Worklist
 * GET /api/worklists/employee/me
 * 
 * Shows all ASSIGNED/IN_PROGRESS cases assigned to the current user.
 * This is the CANONICAL "My Worklist" query.
 * 
 * Query: assignedToXID = user.xID AND status IN (ASSIGNED, IN_PROGRESS)
 * 
 * Cases shown:
 * - Assigned to this user's xID
 * - Status is ASSIGNED or IN_PROGRESS
 * 
 * Cases NOT shown:
 * - PENDING cases (these appear only in "My Pending Cases" dashboard)
 * - FILED cases (these are hidden from employees)
 * - unassigned OPEN cases (these are in global worklist)
 * 
 * Before returning results, auto-reopens any cases where pendingUntil has elapsed.
 * 
 * Dashboard "My Open Cases" count MUST use the exact same query.
 * 
 * PR #42: Updated to query by xID instead of email
 * PR: Case Lifecycle - Fixed to use status = OPEN (not != Pending)
 * PR: Hard Cutover to xID - Removed email parameter, use req.user only
 * PR: Fix Pended Case Visibility - Added auto-reopen before querying
 */
const employeeWorklist = async (req, res) => {
  try {
    const requestedLimit = Number.parseInt(req.query?.limit, 10);
    const normalizedLimit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : null;
    const requestedStatuses = Array.isArray(req.query?.status)
      ? req.query.status.flatMap((value) => String(value).split(','))
      : (typeof req.query?.status === 'string' ? req.query.status.split(',') : []);
    const normalizedRequestedStatuses = requestedStatuses
      .map((value) => String(value || '').trim().toUpperCase())
      .filter(Boolean);

    // Get authenticated user from req.user (set by auth middleware)
    const user = req.user;
    const firmId = req.user?.firmId || null;
    
    if (!user || !user.xID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required - user identity not found',
      });
    }
    
    if (!firmId) {
      return res.status(400).json({
        success: false,
        message: 'Firm context is required',
      });
    }
    
    const requestedAssignee = String(req.query?.assigneeXID || '').trim().toUpperCase();
    const isAdmin = ['ADMIN', 'Admin'].includes(String(user?.role || ''));
    const targetAssigneeXID = requestedAssignee || String(user.xID || '').trim().toUpperCase();

    if (!targetAssigneeXID) {
      return res.status(400).json({
        success: false,
        message: 'Assignee xID is required',
      });
    }

    const isViewingOwnWorklist = targetAssigneeXID === String(user.xID || '').trim().toUpperCase();
    if (!isViewingOwnWorklist && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view another user worklist',
      });
    }

    // Auto-reopen expired pending cases for this user/assignee
    try {
      await caseActionService.autoReopenExpiredPendingCases(targetAssigneeXID, firmId);
    } catch (error) {
      console.warn('[WORKLIST] Failed to auto-reopen expired pending cases:', error.message);
    }
    
    // CANONICAL QUERY: assignedToXID = xID AND status IN (ASSIGNED, IN_PROGRESS, OPEN)
    // This is the ONLY correct query for "My Worklist"
    // Dashboard counts MUST use the same query
    const worklistStatuses = [CaseStatus.ASSIGNED, CaseStatus.IN_PROGRESS, CaseStatus.OPEN, CaseStatus.QC_PENDING].filter(Boolean);
    // Legacy test/migration compatibility when only OPEN/PENDING constants are available.
    if (worklistStatuses.length <= 1 && CaseStatus.PENDING) {
      worklistStatuses.push(CaseStatus.PENDING);
    }

    const defaultStatuses = worklistStatuses.map((statusValue) => String(statusValue || '').trim().toUpperCase());
    const filteredStatuses = normalizedRequestedStatuses.length > 0
      ? defaultStatuses.filter((statusValue) => normalizedRequestedStatuses.includes(statusValue))
      : defaultStatuses;

    const query = {
      assignedToXID: targetAssigneeXID, // CANONICAL: Query by xID in assignedToXID field
      // Assignment flow writes ASSIGNED; legacy/older records may still be OPEN/IN_PROGRESS.
      // PENDING must be excluded because pending dockets are shown via /cases/my-pending.
      status: { $in: filteredStatuses },
    };
    
    const casesQuery = Case.find(enforceTenantScope(query, req, { source: 'search.employeeWorklist' }))
      .select('caseId caseNumber caseName category subcategory caseSubCategory dueDate slaDueAt createdAt createdBy updatedAt status clientId clientName assignedToXID assignedToName')
      .sort({ createdAt: -1 });

    if (normalizedLimit) {
      casesQuery.limit(normalizedLimit);
    }

    const cases = await casesQuery.lean();

    const missingClientNameIds = [...new Set(
      (cases || [])
        .filter((c) => !c?.clientName && c?.clientId)
        .map((c) => String(c.clientId).trim())
        .filter(Boolean),
    )];

    let clientNameByClientId = new Map();
    if (missingClientNameIds.length > 0) {
      const clientDocs = await Client.find(
        enforceTenantScope({ clientId: { $in: missingClientNameIds } }, req, { source: 'search.employeeWorklist.clientLookup' }),
      )
        .select('clientId businessName')
        .lean();

      clientNameByClientId = new Map(
        (clientDocs || [])
          .filter((client) => client?.clientId)
          .map((client) => [String(client.clientId).trim(), client.businessName || null]),
      );
    }
    
    // Log case list view for audit
    await logCaseListViewed({
      viewerXID: user.xID,
      filters: { status: filteredStatuses, assigneeXID: targetAssigneeXID },
      listType: isViewingOwnWorklist ? 'MY_WORKLIST' : 'TEAM_WORKLIST',
      resultCount: cases.length,
      req,
    });
    
    res.json({
      success: true,
      data: (cases || []).map(c => ({
        _id: c._id, // Include _id for UI compatibility
        caseId: c.caseId || c.caseNumber,
        caseNumber: c.caseNumber || c.caseId,
        caseName: c.caseName,
        category: c.category,
        subcategory: c.subcategory || c.caseSubCategory || null,
        dueDate: c.dueDate || c.slaDueAt || null,
        slaDueAt: c.slaDueAt || null,
        createdAt: c.createdAt,
        createdBy: c.createdBy,
        updatedAt: c.updatedAt,
        status: c.status,
        assignedToXID: c.assignedToXID || null,
        assignedToName: c.assignedToName || null,
        clientId: c.clientId || null,
        clientName: c.clientName || clientNameByClientId.get(String(c.clientId || '').trim()) || null,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching employee worklist',
      data: [],
      error: error.message,
    });
  }
};

/**
 * Global Worklist (Unassigned Cases Queue)
 * GET /api/worklists/global
 * 
 * Returns all unassigned OPEN cases
 * Supports server-side filtering and sorting
 * 
 * Query Parameters:
 * - clientId: Filter by client ID
 * - category: Filter by case category
 * - createdAtFrom: Filter by creation date (start)
 * - createdAtTo: Filter by creation date (end)
 * - slaStatus: Filter by SLA status (overdue, due_soon, on_track)
 * - sortBy: Field to sort by (clientId, category, slaDueAt/slaDueDate, createdAt)
 * - sortOrder: Sort order (asc, desc)
 * - page: Page number for pagination
 * - limit: Results per page
 * 
 * Default sort: slaDueAt ASC
 */
const globalWorklist = async (req, res) => {
  try {
    const {
      clientId,
      category,
      createdAtFrom,
      createdAtTo,
      status,
      slaStatus,
      sortBy = 'slaDueAt',
      sortOrder = 'asc',
      page = 1,
      limit = 20,
      tab = 'own',
      workbasketId = '',
    } = req.query;
    const firmId = req.user?.firmId;

    if (!firmId) {
      return res.status(400).json({
        success: false,
        message: 'Firm context is required',
      });
    }
    
    const userTeamId = toObjectIdStringOrNull(req.user?.teamId);
    const requestedWorkbasketId = toObjectIdStringOrNull(workbasketId);
    const permittedTeamIds = new Set(
      (Array.isArray(req.user?.teamIds) ? req.user.teamIds : [])
        .map((entry) => toObjectIdStringOrNull(entry))
        .filter(Boolean),
    );
    if (userTeamId) permittedTeamIds.add(userTeamId);
    const selectedTeamId = requestedWorkbasketId && permittedTeamIds.has(requestedWorkbasketId)
      ? requestedWorkbasketId
      : userTeamId;
    const normalizedTab = String(tab || 'own').toLowerCase();
    const parsedPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
    const query = {
      assignedToXID: null,
    };

    if (normalizedTab === 'routed' && selectedTeamId) {
      query.routedToTeamId = selectedTeamId;
      query.status = { $in: [CaseStatus.ROUTED, CaseStatus.IN_PROGRESS, CaseStatus.PENDING, CaseStatus.FILED] };
    } else {
      if (selectedTeamId) {
        query.ownerTeamId = selectedTeamId;
      }
      query.routedToTeamId = null;
      query.status = { $in: [CaseStatus.OPEN, CaseStatus.RETURNED, CaseStatus.UNASSIGNED] };
    }
    
    // Apply filters
    if (clientId) {
      query.clientId = clientId;
    }
    
    if (category) {
      query.category = category;
    }

    if (status) {
      query.status = status;
    }
    
    // Date range filter
    if (createdAtFrom || createdAtTo) {
      query.createdAt = {};
      if (createdAtFrom) {
        query.createdAt.$gte = new Date(createdAtFrom);
      }
      if (createdAtTo) {
        query.createdAt.$lte = new Date(createdAtTo);
      }
    }
    
    // SLA status filter (computed based on slaDueAt)
    if (slaStatus) {
      const now = new Date();
      const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      
      if (slaStatus === 'overdue') {
        // Cases where slaDueAt < now
        query.slaDueAt = { $lt: now };
      } else if (slaStatus === 'due_soon') {
        // Cases where slaDueAt is between now and 2 days from now
        query.slaDueAt = { $gte: now, $lte: twoDaysFromNow };
      } else if (slaStatus === 'on_track') {
        // Cases where slaDueAt > 2 days from now OR no slaDueAt
        query.$or = [
          { slaDueAt: { $gt: twoDaysFromNow } },
          { slaDueAt: null },
        ];
      }
    }
    
    // Build sort object
    const normalizedSortBy = sortBy === 'slaDueDate' ? 'slaDueAt' : sortBy;

    const sortFields = {
      clientId: 'clientId',
      category: 'category',
      slaDueAt: 'slaDueAt',
      createdAt: 'createdAt',
    };
    
    const sortField = sortFields[normalizedSortBy] || 'slaDueAt';
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    const sort = { [sortField]: sortDirection };
    
    // Build the base query without slaDueAt modifications for separation
    const baseQuery = { ...query };
    
    // PERFORMANCE: Execute count query concurrently with data fetch
    const totalQuery = { ...baseQuery };
    // We attach a no-op catch immediately to prevent UnhandledPromiseRejection in case of an early throw.
    // The error will still be caught when we await it later or if we want to handle it.
    const totalPromise = Case.countDocuments(enforceTenantScope(totalQuery, req, { source: 'search.globalWorklist.total' }));
    totalPromise.catch(() => {}); // prevent UnhandledPromiseRejection

    // Handle null slaDueAt - put them at the end
    let casesWithSLA = [];
    let casesWithoutSLA = [];
    
    if (normalizedSortBy === 'slaDueAt') {
      // Query for cases WITH slaDueAt (not null)
      const queryWithSLA = { ...baseQuery };
      // Don't modify if slaStatus filter is already applied
      if (!slaStatus) {
        queryWithSLA.slaDueAt = { $ne: null };
      }
      
      casesWithSLA = await Case.find(enforceTenantScope(queryWithSLA, req, { source: 'search.globalWorklist.withSLA' }))
        .select('caseId caseName clientId category status slaDueAt createdAt createdBy ownerTeamId routedToTeamId routingNote')
        .sort(sort)
        .limit(parsedLimit)
        .skip((parsedPage - 1) * parsedLimit)
        .lean();
      
      // Query for cases WITHOUT slaDueAt (null) - only if no slaStatus filter
      if (!slaStatus && casesWithSLA.length < parsedLimit) {
        const queryWithoutSLA = { ...baseQuery, slaDueAt: null };
        
        casesWithoutSLA = await Case.find(enforceTenantScope(queryWithoutSLA, req, { source: 'search.globalWorklist.withoutSLA' }))
          .select('caseId caseName clientId category status slaDueAt createdAt createdBy ownerTeamId routedToTeamId routingNote')
          .sort({ createdAt: sortDirection })
          .limit(parsedLimit - casesWithSLA.length)
          .skip(Math.max(0, (parsedPage - 1) * parsedLimit - casesWithSLA.length))
          .lean();
      }
    } else {
      // For other sort fields, just execute the query normally
      casesWithSLA = await Case.find(enforceTenantScope(baseQuery, req, { source: 'search.globalWorklist.base' }))
        .select('caseId caseName clientId category status slaDueAt createdAt createdBy ownerTeamId routedToTeamId routingNote')
        .sort(sort)
        .limit(parsedLimit)
        .skip((parsedPage - 1) * parsedLimit)
        .lean();
    }
    
    // Merge results
    const allCases = [...casesWithSLA, ...casesWithoutSLA];
    const teamIds = [...new Set(
      allCases
        .flatMap((c) => [c.ownerTeamId, c.routedToTeamId])
        .map((id) => toObjectIdStringOrNull(id))
        .filter(Boolean),
    )];
    const teams = teamIds.length > 0
      ? await Team.find({ _id: { $in: teamIds }, firmId }).select('_id name').lean()
      : [];
    const teamNameMap = new Map(teams.map((team) => [String(team._id), team.name]));
    
    // Calculate SLA days remaining for each case
    const now = new Date();
    const casesWithSLAInfo = allCases.map(c => {
      let slaDaysRemaining = null;
      if (c.slaDueAt) {
        const dueDate = new Date(c.slaDueAt);
        const diffTime = dueDate - now;
        slaDaysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
      
      return {
        caseId: c.caseId,
        caseName: c.caseName,
        clientId: c.clientId,
        status: c.status,
        category: c.category,
        slaDueAt: c.slaDueAt,
        slaDaysRemaining,
        createdAt: c.createdAt,
        createdBy: c.createdBy,
        ownerTeamId: c.ownerTeamId || null,
        ownerTeamName: c.ownerTeamId ? (teamNameMap.get(String(c.ownerTeamId)) || null) : null,
        routedToTeamId: c.routedToTeamId || null,
        routedToTeamName: c.routedToTeamId ? (teamNameMap.get(String(c.routedToTeamId)) || null) : null,
        routingNote: c.routingNote || null,
      };
    });
    
    // Await the total count
    const total = await totalPromise;
    
    // Log case list view for audit (if user is authenticated)
    if (req.user?.xID) {
      await logCaseListViewed({
        viewerXID: req.user.xID,
        filters: { 
          clientId, 
          category, 
          slaStatus,
          createdAtFrom,
          createdAtTo,
          tab: normalizedTab,
        },
        listType: 'GLOBAL_WORKLIST',
        resultCount: casesWithSLAInfo.length,
        req,
      });
    }
    
    res.json({
      success: true,
      data: casesWithSLAInfo,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching global worklist',
      error: error.message,
    });
  }
};

module.exports = {
  globalSearch,
  categoryWorklist,
  employeeWorklist,
  globalWorklist,
};
