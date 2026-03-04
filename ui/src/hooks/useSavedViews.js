/**
 * useSavedViews Hook
 * Allows users to save commonly-used filter combinations as named presets.
 * Persists saved views per user in localStorage.
 *
 * Storage key: docketra_saved_views_<userId>
 */

import { useState, useCallback } from 'react';

const getStorageKey = (userId) => `docketra_saved_views_${userId || 'anonymous'}`;

const loadFromStorage = (userId) => {
  try {
    const stored = localStorage.getItem(getStorageKey(userId));
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveToStorage = (userId, views) => {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(views));
  } catch {
    // ignore storage errors
  }
};

/**
 * @param {string|null} userId  — current user's id (or email)
 * @returns {{ savedViews, saveView, removeView, applySavedView }}
 */
export const useSavedViews = (userId) => {
  const [savedViews, setSavedViews] = useState(() => loadFromStorage(userId));

  /**
   * Save the current filter state as a named preset.
   * @param {string} name          — user-facing label for the preset
   * @param {{ viewId, statusFilter, searchQuery }} filters
   */
  const saveView = useCallback(
    (name, filters) => {
      if (!name?.trim()) return;
      setSavedViews((prev) => {
        const trimmedName = name.trim();
        // Replace existing preset with the same name
        const filtered = prev.filter((v) => v.name !== trimmedName);
        const next = [...filtered, { name: trimmedName, filters }];
        saveToStorage(userId, next);
        return next;
      });
    },
    [userId]
  );

  /**
   * Remove a saved preset by name.
   * @param {string} name
   */
  const removeView = useCallback(
    (name) => {
      setSavedViews((prev) => {
        const next = prev.filter((v) => v.name !== name);
        saveToStorage(userId, next);
        return next;
      });
    },
    [userId]
  );

  /**
   * Returns the filter state for a saved preset by name, or null.
   * @param {string} name
   * @returns {{ viewId, statusFilter, searchQuery }|null}
   */
  const applySavedView = useCallback(
    (name) => {
      const found = savedViews.find((v) => v.name === name);
      return found ? found.filters : null;
    },
    [savedViews]
  );

  return { savedViews, saveView, removeView, applySavedView };
};
