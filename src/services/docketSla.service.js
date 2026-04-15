/**
 * DocketSla Service
 *
 * Canonical re-export of caseSla.service under the Docket naming convention.
 * All new code should import from this file.
 * The underlying implementation remains in caseSla.service.js for backward
 * compatibility with existing imports and tests.
 */

module.exports = require('./caseSla.service');
