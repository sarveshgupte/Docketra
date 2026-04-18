import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { dashboardApi } from '../../api/dashboard.api';
import { ROUTES } from '../../constants/routes';

export const PlatformDashboardPage = () => {
  const { firmSlug } = useParams();
  const [summary, setSummary] = useState({});

  useEffect(() => {
    dashboardApi.getSummary({ filter: 'ALL' }).then((res) => setSummary(res?.data?.data || {})).catch(() => setSummary({}));
  }, []);

  const cards = [
    { label: 'Total dockets', value: summary.totalDockets || 0 },
    { label: 'In progress', value: summary.inProgress || 0 },
    { label: 'Pending', value: summary.pending || 0 },
    { label: 'Resolved', value: summary.resolved || 0 },
    { label: 'QC passed', value: summary.qcPassed || 0 },
    { label: 'Time spent (hrs)', value: summary.timeSpentHours || 0 },
  ];

  return (
    <PlatformShell title="Dashboard" subtitle="Operations analytics and live audit timeline">
      <section className="grid-cards">{cards.map((c) => <article className="panel" key={c.label}><p className="muted">{c.label}</p><p className="kpi">{c.value}</p></article>)}</section>
      <section className="panel"><h3>Productivity (bar)</h3><div className="bar"><span style={{ width: `${Math.min(100, Number(summary.productivityScore || 62))}%` }} /></div></section>
      <section className="panel"><h3>Lifecycle Split (pie approximation)</h3><div className="action-row"><span className="chip">In Progress</span><span className="chip">Pending</span><span className="chip">Resolved</span></div></section>
      <section className="panel"><h3>Recent Activity</h3><p className="muted">Audit timeline is available in docket details and reports.</p><Link to={ROUTES.ADMIN_REPORTS(firmSlug)}>Open reports timeline</Link></section>
    </PlatformShell>
  );
};

export default PlatformDashboardPage;
