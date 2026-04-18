import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { worklistApi } from '../../api/worklist.api';
import { caseApi } from '../../api/case.api';
import { ROUTES } from '../../constants/routes';
import { DataTable, toArray } from './PlatformShared';

export const PlatformWorklistPage = () => {
  const { firmSlug } = useParams();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    worklistApi.getEmployeeWorklist({ limit: 50 }).then((res) => setRows(toArray(res?.data?.data || res?.data?.items))).catch(() => setRows([]));
  }, []);

  return (
    <PlatformShell title="My Worklist" subtitle="Your active dockets and fastest actions">
      <DataTable columns={['Docket', 'Client', 'Time Spent', 'Status', 'Actions']} rows={rows.map((r) => (
        <tr key={r.caseInternalId || r._id}><td>{r.docketId || r.caseInternalId}</td><td>{r.clientName || '-'}</td><td>{r.timeSpent || '0m'}</td><td>{r.status || 'IN_PROGRESS'}</td><td className="action-row"><Link to={ROUTES.CASE_DETAIL(firmSlug, r.caseInternalId)}>Open docket</Link><button type="button" onClick={() => caseApi.transitionDocket(r.caseInternalId, { action: 'SEND_TO_QC' })}>Send to QC</button><button type="button" onClick={() => caseApi.pendCase(r.caseInternalId, 'Pending via table action')}>Pend</button><button type="button" onClick={() => caseApi.resolveCase(r.caseInternalId, 'Resolved via table action')}>Resolve</button><button type="button" onClick={() => caseApi.fileCase(r.caseInternalId, 'Filed via table action')}>File</button></td></tr>
      ))} />
    </PlatformShell>
  );
};

export default PlatformWorklistPage;
