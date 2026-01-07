const Case = require('../models/Case.model');
const Comment = require('../models/Comment.model');
const Attachment = require('../models/Attachment.model');
const User = require('../models/User.model');

/**
 * Search Controller for Global Search and Worklists
 * PART A - READ-ONLY operations for finding cases and viewing worklists
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
 *   - They are assigned (assignedTo matches their email), OR
 *   - The case category is in their allowedCategories
 */
const globalSearch = async (req, res) => {
  try {
    const { q } = req.query;
    const userEmail = req.body.email || req.query.email || req.headers['x-user-email'];
    
    if (!q || q.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Search query parameter "q" is required',
      });
    }
    
    if (!userEmail) {
      return res.status(401).json({
        success: false,
        message: 'User email is required for authentication',
      });
    }
    
    // Get user to check role and permissions
    const user = await User.findOne({ email: userEmail.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }
    
    const searchTerm = q.trim();
    const isAdmin = user.role === 'Admin';
    
    // Build search query
    let caseQuery = {};
    
    // Search in case fields (caseId, clientName, category)
    const caseSearchConditions = [
      { caseId: { $regex: searchTerm, $options: 'i' } },
      { clientName: { $regex: searchTerm, $options: 'i' } },
      { category: { $regex: searchTerm, $options: 'i' } },
    ];
    
    // Include clientId if it exists on the model
    if (searchTerm) {
      caseSearchConditions.push({ clientId: { $regex: searchTerm, $options: 'i' } });
    }
    
    // Find cases matching direct fields
    if (isAdmin) {
      caseQuery = { $or: caseSearchConditions };
    } else {
      // Employee: Only see assigned or allowed category cases
      caseQuery = {
        $and: [
          { $or: caseSearchConditions },
          {
            $or: [
              { assignedTo: userEmail.toLowerCase() },
              { category: { $in: user.allowedCategories } },
            ],
          },
        ],
      };
    }
    
    const casesFromDirectSearch = await Case.find(caseQuery)
      .select('caseId title status category clientId clientName createdAt createdBy')
      .lean();
    
    // Search in comments using text index
    let commentsWithMatches = [];
    try {
      commentsWithMatches = await Comment.find(
        { $text: { $search: searchTerm } },
        { score: { $meta: 'textScore' } }
      )
        .select('caseId')
        .lean();
    } catch (error) {
      // Text index might not be ready yet, fallback to regex
      commentsWithMatches = await Comment.find(
        { text: { $regex: searchTerm, $options: 'i' } }
      )
        .select('caseId')
        .lean();
    }
    
    // Search in attachments using text index
    let attachmentsWithMatches = [];
    try {
      attachmentsWithMatches = await Attachment.find(
        { $text: { $search: searchTerm } },
        { score: { $meta: 'textScore' } }
      )
        .select('caseId')
        .lean();
    } catch (error) {
      // Text index might not be ready yet, fallback to regex
      attachmentsWithMatches = await Attachment.find(
        { fileName: { $regex: searchTerm, $options: 'i' } }
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
        relatedQuery = {
          $and: [
            { caseId: { $in: caseIdsFromRelated } },
            {
              $or: [
                { assignedTo: userEmail.toLowerCase() },
                { category: { $in: user.allowedCategories } },
              ],
            },
          ],
        };
      }
      
      casesFromRelated = await Case.find(relatedQuery)
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
 */
const categoryWorklist = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const userEmail = req.body.email || req.query.email || req.headers['x-user-email'];
    
    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Category ID is required',
      });
    }
    
    if (!userEmail) {
      return res.status(401).json({
        success: false,
        message: 'User email is required for authentication',
      });
    }
    
    // Get user to check role and permissions
    const user = await User.findOne({ email: userEmail.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
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
    
    const cases = await Case.find(query)
      .select('caseId createdAt createdBy status clientId clientName')
      .sort({ createdAt: -1 })
      .lean();
    
    res.json({
      success: true,
      data: cases.map(c => ({
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
      error: error.message,
    });
  }
};

/**
 * Employee Worklist
 * GET /api/worklists/employee/me
 * 
 * Shows all cases assigned to the current user
 * Excludes Pending cases
 * Does NOT show caseId in the list
 */
const employeeWorklist = async (req, res) => {
  try {
    const userEmail = req.body.email || req.query.email || req.headers['x-user-email'];
    
    if (!userEmail) {
      return res.status(401).json({
        success: false,
        message: 'User email is required for authentication',
      });
    }
    
    // Get user to verify they exist
    const user = await User.findOne({ email: userEmail.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }
    
    // Build query: assigned to this user and status is NOT Pending
    const query = {
      assignedTo: userEmail.toLowerCase(),
      status: { $ne: 'Pending' },
    };
    
    const cases = await Case.find(query)
      .select('category createdAt createdBy status clientId clientName')
      .sort({ createdAt: -1 })
      .lean();
    
    res.json({
      success: true,
      data: cases.map(c => ({
        category: c.category,
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
      message: 'Error fetching employee worklist',
      error: error.message,
    });
  }
};

module.exports = {
  globalSearch,
  categoryWorklist,
  employeeWorklist,
};
