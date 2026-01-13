const applyDefaultDeletedFilter = function(query) {
  if (!query) return { deletedAt: null };
  if (query.includeDeleted) {
    // Allow opt-in override while keeping filter object clean
    // eslint-disable-next-line no-param-reassign
    delete query.includeDeleted;
    return query;
  }
  if (query.deletedAt !== undefined) {
    return query;
  }
  return { ...query, deletedAt: null };
};

/**
 * Global soft-delete plugin.
 * - Adds deletedAt/deletedByXID/deleteReason/restoreHistory fields
 * - Excludes deleted documents from find/count/aggregate by default
 * - Allows opt-in inclusion via { includeDeleted: true }
 */
const softDeletePlugin = (schema) => {
  schema.add({
    deletedAt: { type: Date, default: null, index: true },
    deletedByXID: { type: String, default: null },
    deleteReason: { type: String, default: null },
    restoreHistory: [{
      restoredAt: Date,
      restoredByXID: String,
    }],
  });

  schema.pre(/^find/, function softDeleteFindHook() {
    const filtered = applyDefaultDeletedFilter(this.getQuery());
    if (filtered) {
      this.setQuery(filtered);
    }
  });

  schema.pre('countDocuments', function softDeleteCountHook() {
    const filtered = applyDefaultDeletedFilter(this.getFilter());
    if (filtered) {
      this.setQuery(filtered);
    }
  });

  schema.pre('aggregate', function softDeleteAggregateHook() {
    const pipeline = this.pipeline();
    const includeDeleted = this.options?.includeDeleted
      || (pipeline[0] && pipeline[0].$match && pipeline[0].$match.includeDeleted);
    if (includeDeleted && pipeline[0]?.$match?.includeDeleted !== undefined) {
      // Clean up includeDeleted flag from match
      // eslint-disable-next-line no-param-reassign
      delete pipeline[0].$match.includeDeleted;
      return;
    }
    const matchStage = { deletedAt: null };
    if (!pipeline.length || !pipeline[0].$match) {
      this.pipeline().unshift({ $match: matchStage });
      return;
    }
    if (pipeline[0].$match && pipeline[0].$match.deletedAt === undefined) {
      pipeline[0].$match = { ...pipeline[0].$match, deletedAt: null };
    }
  });

  schema.query.includeDeleted = function includeDeleted() {
    this.setQuery({ ...this.getQuery(), includeDeleted: true });
    return this;
  };

  schema.query.onlyDeleted = function onlyDeleted() {
    this.setQuery({ ...this.getQuery(), deletedAt: { $ne: null }, includeDeleted: true });
    return this;
  };
};

module.exports = softDeletePlugin;
