import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../src/services/api';
import { worklistApi } from '../src/api/worklist.api';
import { Card } from '../src/components/common/Card';
import { ErrorState } from '../src/components/feedback/ErrorState';
import { EmptyState } from '../src/components/ui/EmptyState';
import { TableSkeleton } from '../src/components/common/Skeleton';
import { DocketCard } from '../components/DocketCard';
import { useKeyboardShortcuts } from '../src/hooks/useKeyboardShortcuts';
import { resolveLifecycleKey } from '../utils/lifecycleMap';

const normalizeRecords = (records = []) => {
  if (!Array.isArray(records)) return [];
  return records
    .filter((record) => record && typeof record === 'object')
    .map((record) => ({
      ...record,
      caseId: record.caseId || record._id,
    }));
};

function isAllowedWorklistLifecycle(record) {
  const raw = record?.lifecycle;
  if (raw == null || raw === '') return true;
  const key = resolveLifecycleKey(raw);
  return key === 'open_active' || key === 'in_progress' || key === 'blocked';
}

export function WorklistView({
  variant = 'worklist',
  sortState = { key: 'updatedAt', direction: 'desc' },
  onOpenDocket,
}) {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [error, setError] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);

  const isPendingView = variant === 'pending';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isPendingView) {
        const response = await api.get('/cases/my-pending');
        const pendingData = response?.data?.data;
        setRecords(normalizeRecords(pendingData));
      } else {
        const response = await worklistApi.getEmployeeWorklist();
        const worklistPayload = Array.isArray(response?.data)
          ? response.data
          : response?.data?.data;
        setRecords(normalizeRecords(worklistPayload));
      }
    } catch (err) {
      console.error('Failed to load worklist:', err);
      setError('We couldn’t load your worklist. Retry to fetch the latest assigned dockets.');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [isPendingView]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => records.filter((row) => isAllowedWorklistLifecycle(row)),
    [records],
  );

  const sorted = useMemo(() => {
    if (!sortState?.key || !sortState?.direction) return [...filtered];
    const dateSortKeys = new Set(['createdAt', 'updatedAt', 'pendingUntil']);
    const direction = sortState.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((left, right) => {
      const leftValue = left?.[sortState.key];
      const rightValue = right?.[sortState.key];

      if (dateSortKeys.has(sortState.key)) {
        const leftTime = leftValue ? new Date(leftValue).getTime() : 0;
        const rightTime = rightValue ? new Date(rightValue).getTime() : 0;
        return (leftTime - rightTime) * direction;
      }

      return String(leftValue || '').localeCompare(String(rightValue || ''), undefined, {
        numeric: true,
        sensitivity: 'base',
      }) * direction;
    });
  }, [filtered, sortState]);

  useEffect(() => {
    setFocusedIndex((idx) => Math.min(idx, Math.max(sorted.length - 1, 0)));
  }, [sorted.length]);

  const handleOpen = useCallback(
    (caseId) => {
      if (caseId) onOpenDocket?.(caseId);
    },
    [onOpenDocket],
  );

  useKeyboardShortcuts({
    onNext: () => setFocusedIndex((idx) => Math.min(idx + 1, Math.max(sorted.length - 1, 0))),
    onPrev: () => setFocusedIndex((idx) => Math.max(idx - 1, 0)),
    onOpen: () => {
      const target = sorted[focusedIndex];
      if (target?.caseId) handleOpen(target.caseId);
    },
  });

  if (loading) {
    return (
      <Card>
        <TableSkeleton />
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <ErrorState
          title="We couldn’t load your worklist"
          description="Retry to fetch the latest assigned dockets. If the problem continues, refresh the page or contact your administrator."
          onRetry={load}
        />
      </Card>
    );
  }

  if (sorted.length === 0) {
    return (
      <Card>
        <EmptyState
          title={isPendingView ? 'No pending dockets' : 'No assigned dockets'}
          description={
            isPendingView
              ? 'There are no dockets currently on hold. When a docket is placed on hold, it will appear here with its review date.'
              : 'No open dockets are assigned to you right now.'
          }
        />
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ marginBottom: 16, fontSize: '0.875rem', color: '#6b7280' }}>
        {sorted.length} docket{sorted.length !== 1 ? 's' : ''}
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
        {sorted.map((row, index) => {
          const assignParts = [row.assignedToName, row.assignedToXID].filter(
            (p) => p != null && String(p).trim() !== '',
          );
          const assignedTo = assignParts.length > 0 ? assignParts.join(' · ') : 'You';
          return (
            <li key={row.caseId}>
              <DocketCard
                docketId={row.caseId}
                title={row.title || row.caseName}
                lifecycle={row.lifecycle}
                assignedTo={assignedTo}
                lastUpdated={row.updatedAt}
                focused={index === focusedIndex}
                onOpen={handleOpen}
              />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
