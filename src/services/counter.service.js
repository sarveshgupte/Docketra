const Counter = require('../models/Counter.model');

/**
 * Counter Service for Atomic Sequence Generation
 * 
 * Provides thread-safe, atomic counter increments for generating unique IDs
 * Ensures no race conditions, no duplicates, and no skipped numbers
 * 
 * PR 2: Atomic Counter Implementation
 * 
 * Features:
 * - Atomic increments using MongoDB's findOneAndUpdate with $inc
 * - Firm-scoped counters for multi-tenancy
 * - Auto-initialization with upsert
 * - No in-memory state
 * - No time-based logic
 * 
 * Usage:
 *   const nextSeq = await getNextSequence('case', 'FIRM001');
 */

/**
 * Get next sequence number atomically
 * 
 * This is the single source of truth for sequence generation.
 * Uses MongoDB's atomic findOneAndUpdate operation to ensure:
 * - No race conditions
 * - No duplicate sequences
 * - No skipped numbers
 * 
 * @param {string} name - Counter name (e.g., 'case', 'xID')
 * @param {string} firmId - Firm ID for tenant scoping (REQUIRED)
 * @returns {Promise<number>} Next sequence number
 * @throws {Error} If firmId is missing or operation fails
 */
async function getNextSequence(name, firmId) {
  // Validate required parameters
  if (!name || typeof name !== 'string') {
    throw new Error('Counter name is required and must be a string');
  }
  
  if (!firmId || typeof firmId !== 'string') {
    throw new Error('Firm ID is required for tenant-scoped counters');
  }
  
  try {
    // Atomic increment operation
    // $inc: { seq: 1 } - atomically increments the sequence
    // upsert: true - creates counter if it doesn't exist (starting at 0, then incremented to 1)
    // new: true - returns the document after update (with incremented value)
    const counter = await Counter.findOneAndUpdate(
      { name, firmId },
      { $inc: { seq: 1 } },
      { 
        new: true,        // Return updated document
        upsert: true,     // Create if doesn't exist
        setDefaultsOnInsert: true  // Apply schema defaults on insert
      }
    );
    
    if (!counter || typeof counter.seq !== 'number') {
      throw new Error('Counter operation failed - invalid response');
    }
    
    return counter.seq;
  } catch (error) {
    // If this is a duplicate key error during upsert, retry once
    // This can happen in rare concurrent initialization scenarios
    if (error.code === 11000) {
      try {
        // Retry the operation once
        const counter = await Counter.findOneAndUpdate(
          { name, firmId },
          { $inc: { seq: 1 } },
          { new: true }
        );
        
        if (!counter || typeof counter.seq !== 'number') {
          throw new Error('Counter operation failed after retry - invalid response');
        }
        
        return counter.seq;
      } catch (retryError) {
        // If retry also fails, throw formatted error
        throw new Error(`Error getting next sequence for ${name}/${firmId} after retry: ${retryError.message}`);
      }
    }
    
    // Re-throw other errors with context
    throw new Error(`Error getting next sequence for ${name}/${firmId}: ${error.message}`);
  }
}

/**
 * Get current sequence value without incrementing
 * Useful for debugging and diagnostics
 * 
 * @param {string} name - Counter name
 * @param {string} firmId - Firm ID
 * @returns {Promise<number|null>} Current sequence or null if counter doesn't exist
 */
async function getCurrentSequence(name, firmId) {
  if (!name || !firmId) {
    throw new Error('Counter name and firm ID are required');
  }
  
  const counter = await Counter.findOne({ name, firmId }).lean();
  return counter ? counter.seq : null;
}

/**
 * Initialize counter with a specific starting value
 * WARNING: Only use during system initialization or migration
 * This will NOT update an existing counter - only sets value on first insert
 * 
 * @param {string} name - Counter name
 * @param {string} firmId - Firm ID
 * @param {number} startValue - Starting sequence value
 * @returns {Promise<void>}
 */
async function initializeCounter(name, firmId, startValue) {
  if (!name || !firmId) {
    throw new Error('Counter name and firm ID are required');
  }
  
  if (typeof startValue !== 'number' || startValue < 0) {
    throw new Error('Start value must be a non-negative number');
  }
  
  // Check if counter already exists
  const existingCounter = await Counter.findOne({ name, firmId });
  
  if (existingCounter) {
    throw new Error(`Counter ${name}/${firmId} already exists with seq=${existingCounter.seq}. Cannot re-initialize.`);
  }
  
  // Only set on insert - will not update existing counters
  await Counter.findOneAndUpdate(
    { name, firmId },
    { $setOnInsert: { seq: startValue } },
    { upsert: true }
  );
}

module.exports = {
  getNextSequence,
  getCurrentSequence,
  initializeCounter,
};
