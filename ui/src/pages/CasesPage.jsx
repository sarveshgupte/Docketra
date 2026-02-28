import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { PageHeader } from '../components/layout/PageHeader';
import { SectionCard } from '../components/layout/SectionCard';
import { DataTable } from '../components/layout/DataTable';
import { StatusBadge } from '../components/layout/StatusBadge';
import { EmptyState } from '../components/layout/EmptyState';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { caseService } from '../services/caseService';
import { worklistService } from '../services/worklistService';
import { CASE_STATUS } from '../utils/constants';
import { formatDate } from '../utils/formatters';
import './CasesPage.css';

export const CasesPage = () => {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const navigate = useNavigate();
  const { firmSlug } = useParams();

  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState([]);
  const [filteredCases, setFilteredCases] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [error, setError] = useState(null);

  const normalizeCases = (records = []) =>
    records.map((record) => ({
      ...record,
      caseId: record.caseId || record._id,
    }));

  useEffect(() => {
    if (user) {
      loadCases();
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (statusFilter === 'ALL') {
      setFilteredCases(cases);
      return;
    }
    setFilteredCases(cases.filter((item) => item.status === statusFilter));
  }, [statusFilter, cases]);

  const loadCases = async () => {
    setLoading(true);
    setError(null);
    try {
      let casesData = [];
      if (isAdmin) {
        const response = await caseService.getCases();
        if (response.success) {
          casesData = response.data || [];
        }
      } else {
        const response = await worklistService.getEmployeeWorklist();
        if (response.success) {
          casesData = response.data || [];
        }
      }
      setCases(normalizeCases(casesData));
    } catch (err) {
      console.error('Failed to load cases:', err);
      setError(err);
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCaseClick = (caseRecord) => {
    navigate(`/app/firm/${firmSlug}/cases/${caseRecord.caseId}`);
  };

  const handleCreateCase = () => {
    navigate(`/app/firm/${firmSlug}/cases/create`);
  };

  if (loading) {
    return (
      <Layout>
        <Loading message="Loading cases…" />
      </Layout>
    );
  }

  const columns = [
    { key: 'caseName', header: 'Case Name' },
    { key: 'category', header: 'Category' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'assignedToName',
      header: 'Assigned To',
      render: (row) => row.assignedToName || row.assignedTo || 'Unassigned',
    },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      align: 'right',
      render: (row) => formatDate(row.updatedAt),
    },
  ];

  return (
    <Layout>
      <div className="cases-page">
        <PageHeader
          title="Cases"
          description="Manage lifecycle, assignments, and status transitions."
          actions={isAdmin ? <Button variant="primary" onClick={handleCreateCase}>New Case</Button> : null}
        />

        <SectionCard className="cases-page__filters" title="Filters" subtitle="Narrow down the case list by workflow status.">
          <label className="cases-page__filter-label" htmlFor="status-filter">Status</label>
          <select
            id="status-filter"
            className="cases-page__filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All statuses</option>
            <option value={CASE_STATUS.OPEN}>Open</option>
            <option value={CASE_STATUS.PENDED}>In Review</option>
            <option value={CASE_STATUS.RESOLVED}>Resolved</option>
            <option value={CASE_STATUS.FILED}>Filed</option>
          </select>
        </SectionCard>

        {error ? (
          <div className="cases-page__error" role="alert">
            Failed to load cases. Refresh the page or try again in a moment.
          </div>
        ) : null}

        <SectionCard title="Case Registry" subtitle={`${filteredCases.length} records`}>
          <DataTable
            columns={columns}
            data={filteredCases}
            rowKey="caseId"
            onRowClick={handleCaseClick}
            emptyContent={
              <EmptyState
                title={isAdmin ? 'No cases yet' : 'No assigned cases'}
                description={isAdmin ? 'Create your first case to start managing firm workflows.' : 'You do not have assigned cases right now.'}
                actionLabel={isAdmin ? 'Create Case' : undefined}
                onAction={isAdmin ? handleCreateCase : undefined}
              />
            }
          />
        </SectionCard>
      </div>
    </Layout>
  );
};
