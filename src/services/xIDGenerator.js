/**
 * xID Generator Service
 * 
 * Generates unique, sequential xIDs for user accounts
 * Format: X000001, X000002, X000003, etc.
 * 
 * This service ensures:
 * - Server-side generation only (never client-provided)
 * - Sequential numbering for easy reference
 * - Bootstrap-safe (works when database is empty)
 * - Transactional support (works within MongoDB sessions)
 * - Immutability (xID cannot be changed after creation)
 * - Race-condition safety via transaction isolation
 * 
 * IMPORTANT: Uses tenant-scoped Counter collection with atomic $inc updates.
 */

const Counter = require('../models/Counter.model');
const User = require('../models/User.model');

/**
 * Generate the next available xID using an atomic tenant-scoped counter.
 * 
 * @param {string|Object} firmId - Firm ID/ObjectId for tenant-scoped counters
 * @param {object} session - MongoDB session for transactional reads (required for atomicity)
 * @returns {Promise<string>} Next xID in format X000001
 */
const generateNextXID = async (firmId, session = null) => {
  if (!firmId) {
    throw new Error('firmId is required for xID generation');
  }
  try {
    const counter = await Counter.findOneAndUpdate(
      { name: 'xID', firmId: String(firmId) },
      { $inc: { seq: 1 } },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        ...(session ? { session } : {}),
      }
    );

    const xID = `X${String(counter.seq).padStart(6, '0')}`;
    
    console.log(`[xID Generator] Generated xID: ${xID} for firm: ${firmId}`);
    
    return xID;
  } catch (error) {
    console.error('[xID Generator] Error generating xID:', error);
    throw new Error('Failed to generate xID during firm provisioning');
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
