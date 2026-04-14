/**
 * DocketRepository
 *
 * Canonical re-export of CaseRepository under the Docket naming convention.
 * All new code should import from this file.
 * The underlying implementation remains in CaseRepository.js for backward
 * compatibility with existing imports and tests.
 */

module.exports = require('./CaseRepository');
