import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { dashboardApi } from '../../api/dashboard.api';
import { worklistApi } from '../../api/worklist.api';
import { caseApi } from '../../api/case.api';
import { ROUTES } from '../../constants/routes';
import { usePermissions } from '../../hooks/usePermissions';
import { InlineNotice, PageSection, StatGrid, toArray } from './PlatformShared';

export const PlatformTaskManagerPage = () => {
  const { firmSlug } = useParams();
  const { isAdmin } = usePermissions();
  const [stats, setStats] = useState({
    allActiveDockets: 0,
    myWorklistCount: 0,
    workbasketCount: 0,
    qcPendingCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [summaryRes, worklistRes, globalRes, qcRes] = await Promise.allSettled([
          dashboardApi.getSummary({ filter: 'ALL' }),
          worklistApi.getEmployeeWorklist({ limit: 1 }),
          worklistApi.getGlobalWorklist({ limit: 1 }),
          caseApi.getCases({ state: 'IN_QC', limit: 1 }),
        ]);

        if (cancelled) return;

        const hasRejectedMetrics = [summaryRes, worklistRes, globalRes, qcRes].some((result) => result.status === 'rejected');
        if (hasRejectedMetrics) {
          throw new Error('One or more Task Manager metric requests failed');
        }

        const summary = summaryRes.status === 'fulfilled' ? (summaryRes.value?.data?.data || {}) : {};
        const myWorklist = worklistRes.status === 'fulfilled' ? worklistRes.value : null;
        const globalWorklist = globalRes.status === 'fulfilled' ? globalRes.value : null;
        const qcRows = qcRes.status === 'fulfilled' ? qcRes.value : null;

        setStats({
          allActiveDockets: Number(summary.inProgress || 0) + Number(summary.pending || 0) + Number(summary.inQc || 0),
          myWorklistCount: Number(myWorklist?.meta?.total ?? toArray(myWorklist?.data).length ?? 0),
          workbasketCount: Number(globalWorklist?.meta?.total ?? toArray(globalWorklist?.data).length ?? 0),
          qcPendingCount: Number(qcRows?.meta?.total ?? toArray(qcRows?.data?.data || qcRows?.data?.items).length ?? 0),
        });
      } catch {
        if (!cancelled) {
          setStats({ allActiveDockets: 0, myWorklistCount: 0, workbasketCount: 0, qcPendingCount: 0 });
          setError('Task Manager metrics are temporarily unavailable. You can still navigate to all execution surfaces.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    { label: 'All active dockets', value: loading ? '…' : stats.allActiveDockets, helpText: 'In progress, pending, and in QC right now.' },
    { label: 'My worklist', value: loading ? '…' : stats.myWorklistCount, helpText: 'Dockets assigned to you for execution.' },
    { label: 'Workbasket', value: loading ? '…' : stats.workbasketCount, helpText: 'Unassigned/pooled dockets waiting for pull.' },
    { label: 'QC pending', value: loading ? '…' : stats.qcPendingCount, helpText: 'Dockets waiting in quality-control queue.' },
  ];

  return (
    <PlatformShell
      moduleLabel="Task Manager / Execution"
      title="Task Manager"
      subtitle="Execution and routing hub for dockets, worklists, QC handoff, and operational configuration."
      actions={<Link to={ROUTES.CREATE_CASE(firmSlug)}>New Docket</Link>}
    >
      <InlineNotice tone="error" message={error} />
      <StatGrid items={cards} />

      <PageSection title="Quick actions" description="Start work or route to the correct queue in one click.">
        <div className="action-row">
          <Link to={ROUTES.CREATE_CASE(firmSlug)}>New Docket</Link>
          <Link to={ROUTES.GLOBAL_WORKLIST(firmSlug)}>Open Workbasket</Link>
          <Link to={ROUTES.WORKLIST(firmSlug)}>Open My Worklist</Link>
        </div>
      </PageSection>

      <PageSection title="Execution surfaces" description="Task Manager owns docket execution; document collection remains inside each docket detail under Attachments.">
        <div className="tile-grid">
          <Link className="module-tile" to={ROUTES.GLOBAL_WORKLIST(firmSlug)}>
            <strong>Workbasket</strong>
            <span>Pooled and unassigned docket routing.</span>
          </Link>
          <Link className="module-tile" to={ROUTES.WORKLIST(firmSlug)}>
            <strong>My Worklist</strong>
            <span>Assigned execution queue for your day-to-day work.</span>
          </Link>
          <Link className="module-tile" to={ROUTES.QC_QUEUE(firmSlug)}>
            <strong>QC Workbasket</strong>
            <span>Quality review and pass/correct/fail decisions.</span>
          </Link>
          <Link className="module-tile" to={ROUTES.CASES(firmSlug)}>
            <strong>All Dockets</strong>
            <span>Firm-wide docket list for search, tracking, and oversight.</span>
          </Link>
          {isAdmin ? (
            <Link className="module-tile" to={ROUTES.WORK_CATEGORY_MANAGEMENT(firmSlug)}>
              <strong>Category Management</strong>
              <span>Manage category/subcategory and workbasket linkage.</span>
            </Link>
          ) : null}
        </div>
      </PageSection>

      {isAdmin ? (
        <PageSection title="Manager/Admin configuration" description="Control category/subcategory setup and routing behavior.">
          <div className="action-row">
            <Link to={ROUTES.WORK_CATEGORY_MANAGEMENT(firmSlug)}>Category + subcategory setup</Link>
            <Link to={ROUTES.WORK_SETTINGS(firmSlug)}>Workbasket linkage / routing config</Link>
          </div>
        </PageSection>
      ) : null}
    </PlatformShell>
  );
};

export default PlatformTaskManagerPage;
