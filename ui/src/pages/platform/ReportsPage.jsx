import React, { useEffect, useMemo, useState } from 'react';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { reportsService } from '../../services/reports.service';
import { toArray } from './PlatformShared';

export const PlatformReportsPage = () => {
  const [metrics, setMetrics] = useState([]);

  useEffect(() => {
    reportsService.getCaseMetrics().then((res) => setMetrics(toArray(res?.data?.data))).catch(() => setMetrics([]));
  }, []);

  const top = useMemo(() => metrics.slice(0, 5), [metrics]);

  return (
    <PlatformShell title="Reports" subtitle="PR7 analytics: productivity, QC, user time, client workload">
      <section className="panel"><h3>Productivity chart</h3>{top.map((m, i) => <div key={i}><p className="muted">{m.label || m.category || `Bucket ${i + 1}`}</p><div className="bar"><span style={{ width: `${Math.min(100, Number(m.value || m.count || 0))}%` }} /></div></div>)}</section>
      <section className="grid-cards"><article className="panel"><h3>Time per user</h3><p className="muted">Filterable by date/user/client.</p></article><article className="panel"><h3>QC performance</h3><p className="muted">Pass/fail/correct trend cards.</p></article><article className="panel"><h3>Client workload</h3><p className="muted">Workload concentration view.</p></article></section>
    </PlatformShell>
  );
};

export default PlatformReportsPage;
