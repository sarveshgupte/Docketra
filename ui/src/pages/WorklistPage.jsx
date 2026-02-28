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
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';
import { useAuth } from '../hooks/useAuth';
import { worklistService } from '../services/worklistService';
import { CASE_STATUS } from '../utils/constants';
import { formatDate } from '../utils/formatters';
import api from '../services/api';
import './WorklistPage.css';

export const WorklistPage = () => {
  const { user } = useAuth();
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
        <Loading message="Loading worklist..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="worklist">
        <div className="worklist__header">
          <div className="worklist__header-left">
            <h1 className="worklist__title">{pageInfo.title}</h1>
            <p className="worklist__description">{pageInfo.description}</p>
          </div>
          <button
            className="btn btn-primary worklist__create-btn"
            onClick={() => navigate(`/app/firm/${firmSlug}/cases/create`)}
          >
            + New Case
          </button>
        </div>

        <div className="worklist__toolbar">
          <span className="worklist__count">
            {cases.length} case{cases.length !== 1 ? 's' : ''}
          </span>
        </div>

        <Card>
          {cases.length === 0 ? (
            <div className="worklist__empty">
              <div className="worklist__empty-icon" aria-hidden="true">
                {isPendingView ? '⏸' : '✅'}
              </div>
              <h3 className="worklist__empty-title">
                {isPendingView ? 'No pending cases' : 'All clear!'}
              </h3>
              <p className="worklist__empty-desc">
                {isPendingView
                  ? 'No cases are currently on hold.'
                  : 'No open cases assigned to you right now.'}
              </p>
              {!isPendingView && (
                <button
                  className="btn btn-primary worklist__empty-cta"
                  onClick={() => navigate(`/app/firm/${firmSlug}/cases/create`)}
                >
                  Create a Case
                </button>
              )}
            </div>
          ) : (
            <div className="worklist__table-wrap">
              <table className="neo-table" role="grid" aria-label={pageInfo.title}>
                <thead>
                  <tr>
                    <th scope="col">Case Name</th>
                    <th scope="col">Category</th>
                    <th scope="col">Client ID</th>
                    <th scope="col">Status</th>
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
                      aria-label={`Case: ${caseItem.caseName}, status ${caseItem.status}`}
                      className="worklist__row"
                    >
                      <td>{caseItem.caseName}</td>
                      <td>{caseItem.category}</td>
                      <td>{caseItem.clientId || '—'}</td>
                      <td>
                        <Badge status={caseItem.status}>{caseItem.status}</Badge>
                      </td>
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
