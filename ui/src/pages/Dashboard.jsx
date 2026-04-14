import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { dashboardApi } from '../api/dashboard.api';
import { ROUTES } from '../constants/routes';
import { SlaBadge } from '../components/common/SlaBadge';

const FILTERS = ['MY', 'TEAM', 'ALL'];
const PAGE_SIZE = 10;
const SORT_OPTIONS = ['NEWEST', 'PRIORITY', 'SLA'];

const DashboardCard = ({ title, children, actions = null }) => (
  <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {actions}
    </div>
    {children}
  </section>
);

const DocketList = ({ items = [], loading = false, emptyLabel, onSelect }) => {
  if (loading) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  if (!items.length) {
    return <p className="text-sm text-gray-500">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const slaBadge = String(item.slaStatus || item.slaBadge || 'GREEN').toUpperCase();
        return (
          <li key={item.caseInternalId || item._id}>
            <button
              type="button"
              onClick={() => onSelect?.(item)}
              className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left hover:bg-gray-50"
            >
              <span>
                <span className="block text-sm font-medium text-gray-900">{item.title || item.docketId || 'Untitled docket'}</span>
                <span className="text-xs text-gray-500">{item.docketId || 'DOCKET'}</span>
              </span>
              <SlaBadge status={slaBadge} />
            </button>
          </li>
        );
      })}
    </ul>
  );
};

const WorkbasketChart = ({ items = [], loading = false }) => {
  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (!items.length) return <p className="text-sm text-gray-500">No workbasket load data</p>;

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.workbasketId} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
          <span className="text-sm text-gray-800">{item.name}</span>
          <span className="text-sm font-semibold text-gray-900">{item.count}</span>
        </li>
      ))}
    </ul>
  );
};

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const [filter, setFilter] = useState('MY');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [widgetLoading, setWidgetLoading] = useState({});
  const [sort, setSort] = useState('NEWEST');
  const [workbasketId, setWorkbasketId] = useState('');
  const [setupLoading, setSetupLoading] = useState(true);
  const [summary, setSummary] = useState({
    myDockets: { items: [], total: 0, hasNextPage: false },
    overdueDockets: { items: [], total: 0, hasNextPage: false },
    recentDockets: { items: [], total: 0, hasNextPage: false },
    workbasketLoad: [],
  });
  const [isSetupComplete, setIsSetupComplete] = useState(true);

  const goToDocket = (docket) => {
    if (!docket?.caseInternalId) return;
    navigate(ROUTES.CASE_DETAIL(firmSlug, docket.caseInternalId));
  };

  const loadWidget = async (only) => {
    setWidgetLoading((prev) => ({ ...prev, [only]: true }));
    try {
      const result = await dashboardApi.getSummary({ filter, page, sort, workbasketId, limit: PAGE_SIZE, only });
      setSummary((prev) => ({ ...prev, ...(result?.data || {}) }));
    } finally {
      setWidgetLoading((prev) => ({ ...prev, [only]: false }));
    }
  };

  const loadDashboard = async () => {
    setLoading(true);
    await Promise.all([
      loadWidget('myDockets'),
      loadWidget('overdueDockets'),
      loadWidget('recentDockets'),
      loadWidget('workbasketLoad'),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadDashboard();
  }, [filter, page, sort, workbasketId]);

  useEffect(() => {
    const loadStatus = async () => {
      setSetupLoading(true);
      try {
        const result = await dashboardApi.getSetupStatus();
        setIsSetupComplete(Boolean(result?.data?.isSetupComplete));
      } finally {
        setSetupLoading(false);
      }
    };

    loadStatus();
  }, []);

  const currentPageTotal = useMemo(() => summary?.myDockets?.total || 0, [summary]);

  return (
    <Layout title="Dashboard" subtitle="Action-oriented docket view">
      <div className="space-y-4">
        {!setupLoading && !isSetupComplete ? (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            Your workspace is being prepared...
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
            {FILTERS.map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => {
                  setFilter(entry);
                  setPage(1);
                }}
                className={`rounded-md px-3 py-1 text-sm ${entry === filter ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {entry === 'MY' ? 'My' : entry === 'TEAM' ? 'Team' : 'All'}
              </button>
            ))}
          </div>

          <Button onClick={() => navigate(ROUTES.CREATE_CASE(firmSlug))}>Create Docket</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-sm">
            {SORT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <select value={workbasketId} onChange={(event) => setWorkbasketId(event.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-sm">
            <option value="">All workbaskets</option>
            {(summary?.workbasketLoad || []).map((item) => <option key={item.workbasketId} value={item.workbasketId}>{item.name}</option>)}
          </select>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <DashboardCard title="My Dockets" actions={<Button variant="outline" onClick={() => navigate(ROUTES.CASES(firmSlug))}>View All</Button>}>
            <DocketList
              items={summary?.myDockets?.items || []}
              loading={loading || widgetLoading.myDockets}
              emptyLabel="No dockets assigned"
              onSelect={goToDocket}
            />
          </DashboardCard>

          <DashboardCard title="Overdue Dockets" actions={<Button variant="outline" onClick={() => navigate(ROUTES.CASES(firmSlug))}>View All</Button>}>
            <DocketList
              items={summary?.overdueDockets?.items || []}
              loading={loading || widgetLoading.overdueDockets}
              emptyLabel="No overdue dockets"
              onSelect={goToDocket}
            />
          </DashboardCard>

          <DashboardCard title="Recently Created" actions={<Button variant="outline" onClick={() => navigate(ROUTES.CASES(firmSlug))}>View All</Button>}>
            <DocketList
              items={summary?.recentDockets?.items || []}
              loading={loading || widgetLoading.recentDockets}
              emptyLabel="No recent dockets"
              onSelect={goToDocket}
            />
          </DashboardCard>

          <DashboardCard title="Workbasket Load" actions={<Button variant="outline" onClick={() => navigate(ROUTES.CASES(firmSlug))}>View All</Button>}>
            <WorkbasketChart items={summary?.workbasketLoad || []} loading={loading || widgetLoading.workbasketLoad} />
          </DashboardCard>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-sm text-gray-600">Showing page {page}. Total dockets in current filter: {currentPageTotal}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage((value) => value + 1)}
              disabled={!summary?.myDockets?.hasNextPage}
            >
              Next
            </Button>
          </div>
        </div>

        {!loading && !summary?.myDockets?.items?.length && !summary?.recentDockets?.items?.length ? (
          <EmptyState
            title="No dockets yet"
            message="Create your first docket to activate the dashboard."
            actionLabel="Create Docket"
            onAction={() => navigate(ROUTES.CREATE_CASE(firmSlug))}
          />
        ) : null}
      </div>
    </Layout>
  );
};
