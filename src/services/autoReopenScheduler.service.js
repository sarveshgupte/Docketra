const { reopenDuePending, processExpiredPendedDockets } = require('./docketWorkflow.service');
const log = require('../utils/log');

/**
 * Pending Case Auto-Reopen Scheduler
 * 
 * Periodically checks for pended cases where pendingUntil has passed
 * and automatically reopens them.
 * 
 * This service should be called by a cron job or scheduler.
 * For example, run every hour or every 15 minutes depending on requirements.
 * 
 * PR: Case Lifecycle & Dashboard Logic
 */

/**
 * Run the auto-reopen job
 * 
 * Finds all PENDED cases where pendingUntil <= now and reopens them.
 * Logs results for monitoring.
 * 
 * @returns {Promise<object>} Results with count of reopened cases
 */
const runAutoReopenJob = async () => {
  try {
    log.info('[AutoReopen] Starting auto-reopen job...');
    
    const result = await reopenDuePending();
    const expiredSessionsResult = await processExpiredPendedDockets().catch(err => {
      log.error('[AutoReopen] Error processing expired pended upload sessions:', err);
      return { processedCount: 0 };
    });
    
    if (result.count > 0 || (expiredSessionsResult && expiredSessionsResult.processedCount > 0)) {
      log.info(`[AutoReopen] Successfully reopened ${result.count} case(s), ${expiredSessionsResult?.processedCount || 0} upload session(s)`);
      if (result.docketIds.length > 0) {
        log.info(`[AutoReopen] Case IDs: ${result.docketIds.join(', ')}`);
      }
    } else {
      log.info('[AutoReopen] No cases to reopen');
    }
    
    return { ...result, expiredSessionsProcessed: expiredSessionsResult?.processedCount || 0 };
  } catch (error) {
    log.error('[AutoReopen] Error running auto-reopen job:', error);
    throw error;
  }
};

/**
 * Start the scheduler (optional)
 * 
 * Runs the auto-reopen job at specified intervals.
 * Call this from server.js to enable automatic scheduling.
 * 
 * @param {number} intervalMinutes - Interval in minutes (default: 60)
 */
const startScheduler = (intervalMinutes = 15) => {
  log.info(`[AutoReopen] Scheduler started (runs every ${intervalMinutes} minutes)`);
  
  // Run immediately on startup
  runAutoReopenJob().catch(err => {
    log.error('[AutoReopen] Initial run failed:', err);
  });
  
  // Then run at specified intervals
  const intervalMs = intervalMinutes * 60 * 1000;
  const timer = setInterval(async () => {
    try {
      await runAutoReopenJob();
    } catch (error) {
      log.error('[AutoReopen] Scheduled run failed:', error);
    }
  }, intervalMs);
  if (timer && typeof timer.unref === 'function') {
    timer.unref();
  }
};

module.exports = {
  runAutoReopenJob,
  startScheduler,
};
