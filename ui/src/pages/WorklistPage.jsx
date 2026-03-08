/**
 * Worklist Page
 * 
 * Shows cases assigned to the current user, with optional filtering by status.
 * - Default view: Only OPEN cases (My Worklist)
 * - With ?status=PENDING,ON_HOLD: Shows pending cases
 * 
 * This is the canonical "My Worklist" view.
 * 
 * PR: Case Lifecycle - Fixed to show only OPEN status cases
 * PR: Clickable Dashboard KPI Cards - Added support for status query params
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { TableSkeleton } from '../components/common/Skeleton';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/layout/EmptyState';
import { DataTable } from '../components/layout/DataTable';
import { PriorityPill } from '../components/common/PriorityPill';
import { worklistService } from '../services/worklistService';
import { formatDate } from '../utils/formatters';
import { getStatusLabel } from '../utils/statusDisplay';
import { UX_COPY } from '../constants/uxCopy';
import api from '../services/api';
import './WorklistPage.css';
const normalizeCases = (records = []) => records.map((record) => ({
  ...record,
  caseId: record.caseId || record._id,
}));

export const WorklistPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { firmSlug } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState([]);
  const [error, setError] = useState('');
  const [sortState, setSortState] = useState({ key: 'updatedAt', direction: 'desc' });
  
  // Get status filter from query params
  const statusParam = searchParams.get('status');
  // Check for PENDING or PENDED status (both are valid)
  const isPendingView = statusParam && (
    statusParam === 'PENDING' || 
    statusParam === 'PENDED' || 
    statusParam.split(',').includes('PENDING') ||
    statusParam.split(',').includes('PENDED')
  );

  useEffect(() => {
    setSortState({ key: isPendingView ? 'pendingUntil' : 'updatedAt', direction: 'desc' });
  }, [isPendingView]);

  useEffect(() => {
    loadWorklist();
  }, [statusParam]);

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
        const response = await worklistService.getEmployeeWorklist();
        
        if (response.success) {
          // Worklist only contains OPEN cases (backend already filters)
          setCases(normalizeCases(response.data || []));
        }
      }
    } catch (error) {
      console.error('Failed to load worklist:', error);
      setError('We couldn’t load your worklist. Retry to fetch the latest assigned cases.');
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCaseClick = (caseId) => {
    navigate(`/app/firm/${firmSlug}/cases/${caseId}`);
  };
  
  // Get page title and description
  const getPageInfo = () => {
    if (isPendingView) {
      return {
        title: 'My Pending Cases',
        description: 'Cases temporarily on hold (status = PENDED)',
      };
    }
    return {
      title: 'My Worklist',
      description: 'Your open cases (status = OPEN). Pending cases appear in My Pending Cases.',
    };
  };
  
  const pageInfo = getPageInfo();

  const sortedCases = useMemo(() => {
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

  const columns = [
    {
      key: 'caseName',
      header: 'Case Name',
      sortable: true,
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
    },
    {
      key: 'clientId',
      header: 'Client ID',
      render: (caseItem) => caseItem.clientId || '—',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (caseItem) => (
        <Badge status={caseItem.status}>{getStatusLabel(caseItem.status)}</Badge>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (caseItem) => <PriorityPill caseRecord={caseItem} />,
    },
    ...(isPendingView
      ? [{
        key: 'pendingUntil',
        header: 'Pending Until',
        sortable: true,
        render: (caseItem) => formatDate(caseItem.pendingUntil),
      }]
      : []),
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      render: (caseItem) => formatDate(caseItem.createdAt),
    },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      sortable: true,
      render: (caseItem) => formatDate(caseItem.updatedAt),
    },
  ];

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
          description={pageInfo.description}
          actions={(
            <Button variant="primary" onClick={() => navigate(`/app/firm/${firmSlug}/cases/create`)}>
              {UX_COPY.actions.CREATE_CASE}
            </Button>
          )}
        />

        <Card>
          {error ? (
            <EmptyState
              tone="error"
              eyebrow="Worklist unavailable"
              title="We couldn’t load your worklist"
              description="Retry to fetch the latest assigned cases. If the problem continues, refresh the page or contact your administrator."
              actionLabel="Retry"
              onAction={loadWorklist}
              secondaryActionLabel={!isPendingView ? UX_COPY.actions.CREATE_CASE : undefined}
              onSecondaryAction={!isPendingView ? () => navigate(`/app/firm/${firmSlug}/cases/create`) : undefined}
            />
          ) : cases.length === 0 ? (
            <EmptyState
              title={isPendingView ? 'No pending cases right now.' : UX_COPY.emptyStates.NO_MY_OPEN}
                description={
                  isPendingView
                    ? 'There are no cases currently in review. When a case is placed on hold, it will appear here with its review date.'
                    : 'No open cases are assigned to you right now. Create a new case or wait for one to be assigned.'
                }
              actionLabel={!isPendingView ? UX_COPY.actions.CREATE_CASE : undefined}
              onAction={!isPendingView ? () => navigate(`/app/firm/${firmSlug}/cases/create`) : undefined}
            />
          ) : (
            <DataTable
              columns={columns}
              data={sortedCases}
              rowKey="caseId"
              onRowClick={(caseItem) => handleCaseClick(caseItem.caseId)}
              sortState={sortState}
              onSortChange={setSortState}
              toolbarLeft={(
                <span className="worklist__count">
                  {sortedCases.length} case{sortedCases.length !== 1 ? 's' : ''}
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
