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

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { TableSkeleton } from '../components/common/Skeleton';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/layout/EmptyState';
import { PriorityPill } from '../components/common/PriorityPill';
import { worklistService } from '../services/worklistService';
import { formatDate } from '../utils/formatters';
import { getStatusLabel } from '../utils/statusDisplay';
import { UX_COPY } from '../constants/uxCopy';
import api from '../services/api';
import './WorklistPage.css';

export const WorklistPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { firmSlug } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState([]);
  
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
    loadWorklist();
  }, [statusParam]);

  const loadWorklist = async () => {
    setLoading(true);
    try {
      if (isPendingView) {
        // Load pending cases
        const response = await api.get('/cases/my-pending');
        if (response.data.success) {
          setCases(response.data.data || []);
        }
      } else {
        // Load open cases (default worklist)
        // PR: Hard Cutover to xID - Removed email parameter, uses auth token
        const response = await worklistService.getEmployeeWorklist();
        
        if (response.success) {
          // Worklist only contains OPEN cases (backend already filters)
          setCases(response.data || []);
        }
      }
    } catch (error) {
      console.error('Failed to load worklist:', error);
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

        <div className="worklist__toolbar">
          <span className="worklist__count">
            {cases.length} case{cases.length !== 1 ? 's' : ''}
          </span>
        </div>

        <Card>
          {cases.length === 0 ? (
            <EmptyState
              title={isPendingView ? 'No pending cases right now.' : UX_COPY.emptyStates.NO_MY_OPEN}
              description={isPendingView ? 'There are no cases currently in review.' : 'No open cases are assigned to you right now.'}
              actionLabel={!isPendingView ? UX_COPY.actions.CREATE_CASE : undefined}
              onAction={!isPendingView ? () => navigate(`/app/firm/${firmSlug}/cases/create`) : undefined}
            />
          ) : (
            <div className="worklist__table-wrap">
              <table className="neo-table" role="grid" aria-label={pageInfo.title}>
                <thead>
                  <tr>
                    <th scope="col">Case Name</th>
                    <th scope="col">Category</th>
                    <th scope="col">Client ID</th>
                    <th scope="col">Status</th>
                    <th scope="col">Priority</th>
                    {isPendingView && <th scope="col">Pending Until</th>}
                    <th scope="col">Created</th>
                    <th scope="col">Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((caseItem) => (
                    <tr
                      key={caseItem._id}
                      onClick={() => handleCaseClick(caseItem.caseId)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCaseClick(caseItem.caseId)}
                      tabIndex={0}
                      role="row"
                      aria-label={`Case: ${caseItem.caseName}, status ${getStatusLabel(caseItem.status)}`}
                      className="worklist__row"
                    >
                      <td>{caseItem.caseName}</td>
                      <td>{caseItem.category}</td>
                      <td>{caseItem.clientId || '—'}</td>
                      <td>
                        <Badge status={caseItem.status}>{getStatusLabel(caseItem.status)}</Badge>
                      </td>
                      <td><PriorityPill caseRecord={caseItem} /></td>
                      {isPendingView && (
                        <td>{formatDate(caseItem.pendingUntil)}</td>
                      )}
                      <td>{formatDate(caseItem.createdAt)}</td>
                      <td>{formatDate(caseItem.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
};
