import { useCallback, useEffect, useState } from 'react';
import { caseApi } from '../../api/case.api';
import { ACTION_RETRY_BASE_DELAY_MS, ACTION_RETRY_KEY, ACTION_RETRY_MAX_ATTEMPTS } from './caseDetailUtils';

export const useDocketRetryQueue = ({ caseId, showSuccess, showWarning, onQueueSynced }) => {
  const [retryQueue, setRetryQueue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(ACTION_RETRY_KEY) || '[]');
    } catch (_error) {
      return [];
    }
  });

  const queueFailedAction = useCallback((action) => {
    setRetryQueue((prev) => {
      const next = [...prev, { ...action, id: `${action.type}-${Date.now()}`, attempts: 0, queuedAt: new Date().toISOString(), nextRetryAt: Date.now() }];
      localStorage.setItem(ACTION_RETRY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const executeQueuedAction = useCallback(async (action) => {
    if (action.type === 'ADD_COMMENT') {
      await caseApi.addComment(caseId, action.payload.commentText);
      return true;
    }
    if (action.type === 'RESOLVE_CASE') {
      await caseApi.resolveCase(caseId, action.payload.comment);
      return true;
    }
    return false;
  }, [caseId]);

  useEffect(() => {
    localStorage.setItem(ACTION_RETRY_KEY, JSON.stringify(retryQueue));
  }, [retryQueue]);

  useEffect(() => {
    const retryQueued = async () => {
      if (!navigator.onLine || retryQueue.length === 0) return;
      const remaining = [];
      const now = Date.now();
      for (const action of retryQueue) {
        if ((action.attempts || 0) >= ACTION_RETRY_MAX_ATTEMPTS) {
          showWarning(`Dropping queued ${action.type} after ${ACTION_RETRY_MAX_ATTEMPTS} attempts.`);
          continue;
        }
        if (action.nextRetryAt && action.nextRetryAt > now) {
          remaining.push(action);
          continue;
        }
        try {
          const handled = await executeQueuedAction(action);
          if (!handled) remaining.push(action);
        } catch (_error) {
          const nextAttempts = (action.attempts || 0) + 1;
          if (nextAttempts >= ACTION_RETRY_MAX_ATTEMPTS) {
            showWarning(`Dropping queued ${action.type} after ${ACTION_RETRY_MAX_ATTEMPTS} attempts.`);
            continue;
          }
          const delay = (2 ** nextAttempts) * ACTION_RETRY_BASE_DELAY_MS;
          remaining.push({ ...action, attempts: nextAttempts, nextRetryAt: Date.now() + delay });
        }
      }
      setRetryQueue(remaining);
      if (remaining.length === 0) {
        showSuccess('Queued offline actions synced successfully.');
        onQueueSynced?.();
      }
    };

    window.addEventListener('online', retryQueued);
    retryQueued();
    return () => window.removeEventListener('online', retryQueued);
  }, [executeQueuedAction, onQueueSynced, retryQueue, showSuccess, showWarning]);

  return { retryQueue, queueFailedAction };
};
