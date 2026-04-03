/**
 * Worklist Page
 * 
 * Shows dockets assigned to the current user, with optional filtering by status.
 * - Default view: Only OPEN dockets (My Worklist)
 * - With ?status=PENDING,ON_HOLD: Shows pending dockets
 * 
 * This is the canonical "My Worklist" view.
 * 
 * PR: Docket Lifecycle - Fixed to show only OPEN status dockets
 * PR: Clickable Dashboard KPI Cards - Added support for status query params
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { TableSkeleton } from '../components/common/Skeleton';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { DataTable } from '../components/layout/DataTable';
import { PriorityPill } from '../components/common/PriorityPill';
import { worklistApi } from '../api/worklist.api';
import { formatDate } from '../utils/formatters';
import { getStatusLabel } from '../utils/statusDisplay';
import { useQueryState } from '../hooks/useQueryState';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import api from '../services/api';
import { ROUTES } from '../constants/routes';
import './WorklistPage.css';
const normalizeCases = (records = []) => records.map((record) => ({
  ...record,
  caseId: record.caseId || record._id,
}));

export const WorklistPage = () => {
  const navigate = useNavigate();
  const { query, setQuery } = useQueryState({ status: '', sort: 'updatedAt', order: 'desc' });
  const { firmSlug } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState([]);
  const [error, setError] = useState('');
  const [sortState, setSortState] = useState({ key: query.sort, direction: query.order });
  const [focusedIndex, setFocusedIndex] = useState(0);
  
  // Get status filter from query params
  const statusParam = query.status;
  const isPendingView = statusParam && (
    statusParam === 'PENDING' ||
    statusParam.split(',').includes('PENDING')
  );

  useEffect(() => {
    const defaultKey = isPendingView ? 'pendingUntil' : 'updatedAt';
    const nextKey = query.sort || defaultKey;
    const nextDirection = query.order || 'desc';
    setSortState({ key: nextKey, direction: nextDirection });
  }, [isPendingView, query.sort, query.order]);

  useEffect(() => {
    loadWorklist();
  }, [statusParam]);


  useEffect(() => {
    if (!sortState?.key || !sortState?.direction) {
      setQuery({ sort: null, order: null });
      return;
    }
    setQuery({ sort: sortState.key, order: sortState.direction });
  }, [sortState, setQuery]);

  const loadWorklist = async () => {
    setLoading(true);
    setError('');
    try {
      if (isPendingView) {
        // Load pending cases
        const response = await api.get('/cases/my-pending');
        if (response.data.success) {
          setCases(normalizeCases(response.data.data || []));
        }
      } else {
        // Load open cases (default worklist)
        // PR: Hard Cutover to xID - Removed email parameter, uses auth token
        const response = await worklistApi.getEmployeeWorklist();
        
        if (response.success) {
          // Worklist only contains OPEN cases (backend already filters)
          setCases(normalizeCases(response.data || []));
        }
      }
    } catch (error) {
      console.error('Failed to load worklist:', error);
      setError('We couldn’t load your worklist. Retry to fetch the latest assigned dockets.');
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCaseClick = useCallback((caseId) => {
    navigate(ROUTES.CASE_DETAIL(firmSlug, caseId));
  }, [navigate, firmSlug]);

  const handleRowClick = useCallback((caseItem) => {
    handleCaseClick(caseItem.caseId);
  }, [handleCaseClick]);
  
  // Get page title and description
  const getPageInfo = () => {
    if (isPendingView) {
      return {
        title: 'My Pending Dockets',
        description: 'Dockets temporarily on hold (status = PENDING)',
      };
    }
    return {
      title: 'My Worklist',
      description: 'Your open dockets (status = OPEN). Pending dockets appear in My Pending Dockets.',
    };
  };
  
  const pageInfo = getPageInfo();

  const sortedCases = useMemo(() => {
    if (!sortState?.key || !sortState?.direction) return [...cases];
    const dateSortKeys = new Set(['createdAt', 'updatedAt', 'pendingUntil']);
    const direction = sortState.direction === 'asc' ? 1 : -1;
    return [...cases].sort((left, right) => {
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
  }, [cases, sortState]);


  useKeyboardShortcuts({
    onNext: () => setFocusedIndex((idx) => Math.min(idx + 1, Math.max(sortedCases.length - 1, 0))),
    onPrev: () => setFocusedIndex((idx) => Math.max(idx - 1, 0)),
    onOpen: () => {
      const target = sortedCases[focusedIndex];
      if (target?.caseId) handleCaseClick(target.caseId);
    },
  });

  const columns = useMemo(() => [
    {
      key: 'caseName',
      header: 'Docket Name',
      sortable: true,
      headerClassName: 'w-full max-w-lg',
      cellClassName: 'w-full max-w-lg',
      contentClassName: 'truncate',
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
    },
    {
      key: 'clientId',
      header: 'Client ID',
      align: 'center',
      tabular: true,
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
      render: (caseItem) => caseItem.clientId || '—',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      align: 'center',
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
      render: (caseItem) => (
        <Badge status={caseItem.status}>{getStatusLabel(caseItem.status)}</Badge>
      ),
    },
    {
      key: 'assignedTo',
      header: 'Assigned To',
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
      render: (caseItem) => caseItem.assignedToName || caseItem.assignedToXID || 'Unassigned',
    },
    {
      key: 'priority',
      header: 'Priority',
      align: 'center',
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
      render: (caseItem) => <PriorityPill caseRecord={caseItem} />,
    },
    ...(isPendingView
      ? [{
        key: 'pendingUntil',
        header: 'Pending Until',
        sortable: true,
        align: 'right',
        tabular: true,
        headerClassName: 'w-[1px] whitespace-nowrap',
        cellClassName: 'w-[1px] whitespace-nowrap',
        render: (caseItem) => formatDate(caseItem.pendingUntil),
      }]
      : []),
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      align: 'right',
      tabular: true,
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
      render: (caseItem) => formatDate(caseItem.createdAt),
    },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      sortable: true,
      align: 'right',
      tabular: true,
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
      render: (caseItem) => formatDate(caseItem.updatedAt),
    },
  ], [isPendingView]);

  if (loading) {
    return (
      <Layout>
        <TableSkeleton />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="worklist">
        <PageHeader
          title={pageInfo.title}
          subtitle={pageInfo.description}
          actions={(
            <Button variant="primary" onClick={() => navigate(ROUTES.CREATE_CASE(firmSlug))}>
              Create Docket
            </Button>
          )}
        />
        <div className="worklist-view-tabs" role="tablist" aria-label="Docket queues">
          <Button variant="outline" onClick={() => navigate(ROUTES.GLOBAL_WORKLIST(firmSlug))}>Workbasket</Button>
          <Button variant="outline">My Worklist</Button>
        </div>

        <Card>
          {error ? (
            <EmptyState
              title="We couldn’t load your worklist"
              description="Retry to fetch the latest assigned dockets. If the problem continues, refresh the page or contact your administrator."
              actionLabel="Retry"
              onAction={loadWorklist}
            />
          ) : cases.length === 0 ? (
            <EmptyState
              title={isPendingView ? 'No pending dockets' : 'No assigned dockets'}
                description={
                  isPendingView
                    ? 'There are no dockets currently in review. When a docket is placed on hold, it will appear here with its review date.'
                    : 'No open dockets are assigned to you right now.'
                }
            />
          ) : (
            <DataTable
              columns={columns}
              data={sortedCases}
              rowKey="caseId"
              onRowClick={handleRowClick}
              sortState={sortState}
              onSortChange={setSortState}
              toolbarLeft={(
                <span className="worklist__count">
                  {sortedCases.length} docket{sortedCases.length !== 1 ? 's' : ''}
                </span>
              )}
              dense
            />
          )}
        </Card>
      </div>
    </Layout>
  );
};
