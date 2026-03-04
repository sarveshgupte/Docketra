/**
 * useCaseView Hook
 * Manages preset operational views for the Cases page.
 * Persists the selected view in localStorage and merges preset filters
 * with any manually applied filters.
 */

import { useState, useCallback, useMemo } from 'react';
import { CASE_STATUS } from '../utils/constants';

const STORAGE_KEY = 'caseViewPreset';

/**
 * Returns true when a case is "escalated":
 * SLA breached AND still Open/Pended AND not updated in 24h.
 */
export const isEscalatedCase = (record) => {
  if (!record.slaDueDate) return false;
  if (record.status === CASE_STATUS.RESOLVED || record.status === CASE_STATUS.FILED) return false;
  if (new Date(record.slaDueDate) >= new Date()) return false;
  if (record.status !== CASE_STATUS.OPEN && record.status !== CASE_STATUS.PENDED) return false;
  if (!record.updatedAt) return false; // require updatedAt to exist before comparison
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return new Date(record.updatedAt) < twentyFourHoursAgo;
};

export const CASE_VIEWS = {
  MY_OPEN: {
    id: 'MY_OPEN',
    label: 'My Open',
    filters: { status: CASE_STATUS.OPEN },
    defaultSort: { key: 'updatedAt', direction: 'desc' },
    requiresAdmin: false,
    /** Filter predicate – receives a case record and the current user */
    predicate: (record, user) =>
      record.status === CASE_STATUS.OPEN &&
      (record.assignedTo === user?._id ||
        record.assignedTo === user?.id ||
        record.assignedToEmail === user?.email),
  },
  DUE_TODAY: {
    id: 'DUE_TODAY',
    label: 'Due Today',
    filters: {},
    defaultSort: { key: 'slaDueDate', direction: 'asc' },
    requiresAdmin: false,
    predicate: (record) => {
      if (!record.slaDueDate) return false;
      const due = new Date(record.slaDueDate);
      const now = new Date();
      return (
        due.getFullYear() === now.getFullYear() &&
        due.getMonth() === now.getMonth() &&
        due.getDate() === now.getDate()
      );
    },
  },
  OVERDUE: {
    id: 'OVERDUE',
    label: 'Overdue',
    filters: {},
    defaultSort: { key: 'slaDueDate', direction: 'asc' },
    requiresAdmin: false,
    predicate: (record) => {
      if (!record.slaDueDate) return false;
      if (record.status === CASE_STATUS.RESOLVED || record.status === CASE_STATUS.FILED) return false;
      return new Date(record.slaDueDate) < new Date();
    },
  },
  ESCALATED: {
    id: 'ESCALATED',
    label: 'Escalated',
    filters: {},
    defaultSort: { key: 'slaDueDate', direction: 'asc' },
    requiresAdmin: false,
    predicate: (record) => isEscalatedCase(record),
  },
  UNASSIGNED: {
    id: 'UNASSIGNED',
    label: 'Unassigned',
    filters: { status: CASE_STATUS.UNASSIGNED },
    defaultSort: { key: 'updatedAt', direction: 'desc' },
    requiresAdmin: true,
    predicate: (record) =>
      !record.assignedTo && record.status !== CASE_STATUS.RESOLVED && record.status !== CASE_STATUS.FILED,
  },
  RECENTLY_UPDATED: {
    id: 'RECENTLY_UPDATED',
    label: 'Recently Updated',
    filters: {},
    defaultSort: { key: 'updatedAt', direction: 'desc' },
    requiresAdmin: false,
    predicate: (record) => {
      if (!record.updatedAt) return false;
      const updated = new Date(record.updatedAt);
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // last 48 hours
      return updated >= cutoff;
    },
  },
  FILED: {
    id: 'FILED',
    label: 'Filed',
    filters: { status: CASE_STATUS.FILED },
    defaultSort: { key: 'updatedAt', direction: 'desc' },
    requiresAdmin: false,
    predicate: (record) => record.status === CASE_STATUS.FILED,
  },
};

/**
 * Returns the list of views available for the given role.
 * @param {boolean} isAdmin
 * @returns {Array}
 */
export const getAvailableViews = (isAdmin) =>
  Object.values(CASE_VIEWS).filter((v) => !v.requiresAdmin || isAdmin);

/**
 * Hook that manages the active preset view, applies it to a list of cases,
 * and persists the selection to localStorage.
 *
 * @param {boolean} isAdmin
 * @param {object} user
 * @returns {{ activeView, setActiveView, applyView, availableViews, hasStoredView, applySmartDefault }}
 */
export const useCaseView = (isAdmin, user) => {
  const availableViews = useMemo(() => getAvailableViews(isAdmin), [isAdmin]);

  // Track whether the initial view came from localStorage (manual selection).
  // If false, we allow smart default selection after cases are loaded.
  const hasStoredView = useMemo(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return !!(stored && CASE_VIEWS[stored] && !(CASE_VIEWS[stored].requiresAdmin && !isAdmin));
    } catch {
      return false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [activeView, setActiveViewState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && CASE_VIEWS[stored]) {
        // Non-admin cannot use admin-only views
        if (CASE_VIEWS[stored].requiresAdmin && !isAdmin) {
          return 'MY_OPEN';
        }
        return stored;
      }
    } catch {
      // ignore localStorage errors
    }
    return isAdmin ? 'UNASSIGNED' : 'MY_OPEN';
  });

  const setActiveView = useCallback(
    (viewId) => {
      setActiveViewState(viewId);
      try {
        localStorage.setItem(STORAGE_KEY, viewId);
      } catch {
        // ignore
      }
    },
    []
  );

  /**
   * Selects the best default view based on loaded cases.
   * Only has effect when no stored preference exists.
   * Priority: Overdue → Due Today → MY_OPEN
   *
   * @param {Array} allCases
   */
  const applySmartDefault = useCallback(
    (allCases) => {
      if (hasStoredView) return; // respect manual selection
      const hasOverdue = allCases.some((c) => CASE_VIEWS.OVERDUE.predicate(c));
      if (hasOverdue) {
        setActiveViewState('OVERDUE');
        return;
      }
      const hasDueToday = allCases.some((c) => CASE_VIEWS.DUE_TODAY.predicate(c));
      if (hasDueToday) {
        setActiveViewState('DUE_TODAY');
        return;
      }
      setActiveViewState('MY_OPEN');
    },
    [hasStoredView]
  );

  /**
   * Applies the active preset view's predicate to the full case list.
   * If viewId is null/undefined the full list is returned.
   *
   * @param {Array} allCases
   * @param {string|null} viewId
   * @returns {Array}
   */
  const applyView = useCallback(
    (allCases, viewId) => {
      if (!viewId) return allCases;
      const view = CASE_VIEWS[viewId];
      if (!view) return allCases;
      return allCases.filter((record) => view.predicate(record, user));
    },
    [user]
  );

  return {
    activeView,
    setActiveView,
    applyView,
    availableViews,
    hasStoredView,
    applySmartDefault,
    currentViewDef: CASE_VIEWS[activeView] || null,
  };
};
