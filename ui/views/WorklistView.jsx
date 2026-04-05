import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../src/services/api';
import { worklistApi } from '../src/api/worklist.api';
import { Card } from '../src/components/common/Card';
import { Button } from '../src/components/common/Button';
import { ErrorState } from '../src/components/feedback/ErrorState';
import { EmptyState } from '../src/components/ui/EmptyState';
import { TableSkeleton } from '../src/components/common/Skeleton';
import { DataTable } from '../src/components/layout/DataTable';
import { formClasses } from '../src/theme/tokens';
import { useKeyboardShortcuts } from '../src/hooks/useKeyboardShortcuts';
import { formatDate } from '../src/utils/formatters';
import { resolveLifecycleKey } from '../utils/lifecycleMap';

const normalizeRecords = (records = []) => {
  if (!Array.isArray(records)) return [];
  return records
    .filter((record) => record && typeof record === 'object')
    .map((record) => ({
      ...record,
      caseId: record.caseId || record._id,
      clientId: record.clientId || '—',
      clientName: record.clientName || '—',
      category: record.category || '—',
      subcategory: record.subcategory || '—',
      dueDate: record.dueDate || record.pendingUntil || null,
    }));
};

function isAllowedWorklistLifecycle(record) {
  const raw = record?.lifecycle;
  if (raw == null || raw === '') return true;
  const key = resolveLifecycleKey(raw);
  return key === 'open_active' || key === 'in_progress' || key === 'blocked';
}

const dateSortKeys = new Set(['createdAt', 'updatedAt', 'pendingUntil', 'dueDate']);

const matchText = (value, query) => String(value || '').toLowerCase().includes(query);

export function WorklistView({
  variant = 'worklist',
  sortState = { key: 'updatedAt', direction: 'desc' },
  onSortChange,
  onOpenDocket,
}) {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [error, setError] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subcategoryFilter, setSubcategoryFilter] = useState('');

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

  const filtered = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return records
      .filter((row) => isAllowedWorklistLifecycle(row))
      .filter((row) => (categoryFilter ? row.category === categoryFilter : true))
      .filter((row) => (subcategoryFilter ? row.subcategory === subcategoryFilter : true))
      .filter((row) => {
        if (!normalizedQuery) return true;
        return (
          matchText(row.caseId, normalizedQuery)
          || matchText(row.clientId, normalizedQuery)
          || matchText(row.clientName, normalizedQuery)
          || matchText(row.category, normalizedQuery)
          || matchText(row.subcategory, normalizedQuery)
        );
      });
  }, [records, searchQuery, categoryFilter, subcategoryFilter]);

  const sorted = useMemo(() => {
    if (!sortState?.key || !sortState?.direction) return [...filtered];
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

  const categories = useMemo(
    () => [...new Set(records.map((row) => row.category).filter((value) => value && value !== '—'))].sort(),
    [records],
  );

  const subcategories = useMemo(() => {
    const source = categoryFilter
      ? records.filter((row) => row.category === categoryFilter)
      : records;
    return [...new Set(source.map((row) => row.subcategory).filter((value) => value && value !== '—'))].sort();
  }, [records, categoryFilter]);

  const activeFilters = useMemo(() => {
    const filters = [];
    if (searchQuery.trim()) filters.push({ key: 'search', label: 'Search', value: searchQuery.trim() });
    if (categoryFilter) filters.push({ key: 'category', label: 'Category', value: categoryFilter });
    if (subcategoryFilter) filters.push({ key: 'subcategory', label: 'Sub category', value: subcategoryFilter });
    return filters;
  }, [searchQuery, categoryFilter, subcategoryFilter]);

  useEffect(() => {
    setFocusedIndex((idx) => Math.min(idx, Math.max(sorted.length - 1, 0)));
  }, [sorted.length]);

  const handleOpen = useCallback(
    (caseId, index) => {
      if (!caseId) return;
      onOpenDocket?.({
        caseId,
        sourceList: sorted.map((row) => row.caseId).filter(Boolean),
        index,
        origin: 'worklist',
      });
    },
    [onOpenDocket, sorted],
  );

  const handleRowClick = useCallback((row) => {
    const index = sorted.findIndex((item) => item.caseId === row.caseId);
    handleOpen(row.caseId, index >= 0 ? index : 0);
  }, [handleOpen, sorted]);

  useKeyboardShortcuts({
    onNext: () => setFocusedIndex((idx) => Math.min(idx + 1, Math.max(sorted.length - 1, 0))),
    onPrev: () => setFocusedIndex((idx) => Math.max(idx - 1, 0)),
    onOpen: () => {
      const target = sorted[focusedIndex];
      if (target?.caseId) handleOpen(target.caseId, focusedIndex);
    },
  });

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setCategoryFilter('');
    setSubcategoryFilter('');
  }, []);

  const removeFilter = useCallback((key) => {
    if (key === 'search') setSearchQuery('');
    if (key === 'category') setCategoryFilter('');
    if (key === 'subcategory') setSubcategoryFilter('');
  }, []);

  const columns = useMemo(() => [
    {
      key: 'clientId',
      header: 'Client ID',
      sortable: true,
      render: (row) => row.clientId || '—',
    },
    {
      key: 'clientName',
      header: 'Client Name',
      sortable: true,
      contentClassName: 'truncate max-w-[220px]',
      render: (row) => row.clientName || '—',
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      render: (row) => row.category || '—',
    },
    {
      key: 'subcategory',
      header: 'Sub Category',
      sortable: true,
      render: (row) => row.subcategory || '—',
    },
    {
      key: 'caseId',
      header: 'Docket#',
      sortable: true,
      render: (row) => (
        <div className="font-semibold text-gray-900">{row.caseId || '—'}</div>
      ),
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      sortable: true,
      render: (row) => formatDate(row.dueDate),
    },
    {
      key: 'updatedAt',
      header: 'Last Updated Date',
      sortable: true,
      render: (row) => formatDate(row.updatedAt),
    },
    {
      key: 'createdAt',
      header: 'Docket Create Date',
      sortable: true,
      render: (row) => formatDate(row.createdAt),
    },
  ], []);

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

  if (records.length === 0) {
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
      <div className="worklist-toolbar">
        <div className="worklist-toolbar__field worklist-toolbar__field--search">
          <label htmlFor="worklist-search">Search</label>
          <input
            id="worklist-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by client, category, sub category, docket#"
            className={formClasses.inputBase}
          />
        </div>
        <div className="worklist-toolbar__field">
          <label htmlFor="worklist-category">Category</label>
          <select
            id="worklist-category"
            value={categoryFilter}
            onChange={(event) => {
              const nextCategory = event.target.value;
              setCategoryFilter(nextCategory);
              setSubcategoryFilter('');
            }}
            className={formClasses.inputBase}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
        <div className="worklist-toolbar__field">
          <label htmlFor="worklist-subcategory">Sub category</label>
          <select
            id="worklist-subcategory"
            value={subcategoryFilter}
            onChange={(event) => setSubcategoryFilter(event.target.value)}
            className={formClasses.inputBase}
          >
            <option value="">All sub categories</option>
            {subcategories.map((subcategory) => (
              <option key={subcategory} value={subcategory}>{subcategory}</option>
            ))}
          </select>
        </div>
        <div className="worklist-toolbar__actions">
          <Button variant="outline" onClick={resetFilters}>Clear Filters</Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={sorted}
        rowKey="caseId"
        onRowClick={handleRowClick}
        sortState={sortState}
        onSortChange={onSortChange}
        activeFilters={activeFilters}
        onRemoveFilter={removeFilter}
        onResetFilters={resetFilters}
        emptyContent={(
          <EmptyState
            title="No matching dockets"
            description="Try changing your filters or clear them to see all assigned dockets."
          />
        )}
      />
    </Card>
  );
}
