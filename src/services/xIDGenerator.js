/**
 * xID Generator Service
 * 
 * Generates unique, sequential xIDs for user accounts
 * Format: X000001, X000002, X000003, etc.
 * 
 * This service ensures:
 * - Server-side generation only (never client-provided)
 * - Sequential numbering for easy reference
 * - Uniqueness guarantees
 * - Immutability (xID cannot be changed after creation)
 */

const User = require('../models/User.model');

/**
 * Generate the next available xID
 * @returns {Promise<string>} Next xID in format X000001
 */
const generateNextXID = async () => {
  try {
    // Find the user with the highest xID number
    const lastUser = await User.findOne()
      .sort({ xID: -1 })
      .select('xID')
      .lean();
    
    if (!lastUser || !lastUser.xID) {
      // First user - start with X000001
      return 'X000001';
    }
    
    // Extract the numeric part from the last xID
    const lastNumber = parseInt(lastUser.xID.substring(1), 10);
    
    // Increment and pad with zeros
    const nextNumber = lastNumber + 1;
    const paddedNumber = String(nextNumber).padStart(6, '0');
    
    return `X${paddedNumber}`;
  } catch (error) {
    console.error('[xID Generator] Error generating xID:', error);
    throw new Error('Failed to generate xID');
  }
};

/**
 * Validate xID format
 * @param {string} xID - xID to validate
 * @returns {boolean} True if valid format
 */
const validateXIDFormat = (xID) => {
  if (!xID || typeof xID !== 'string') {
    return false;
  }
  
  // Must match format: X followed by 6 digits
  return /^X\d{6}$/.test(xID);
};

/**
 * Check if xID already exists
 * @param {string} xID - xID to check
 * @returns {Promise<boolean>} True if xID exists
 */
const xIDExists = async (xID) => {
  try {
    const user = await User.findOne({ xID: xID.toUpperCase() }).lean();
    return !!user;
  } catch (error) {
    console.error('[xID Generator] Error checking xID existence:', error);
    throw new Error('Failed to check xID existence');
  }
};

module.exports = {
  generateNextXID,
  validateXIDFormat,
  xIDExists,
};
