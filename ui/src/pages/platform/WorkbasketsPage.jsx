import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { worklistApi } from '../../api/worklist.api';
import { caseApi } from '../../api/case.api';
import { ROUTES } from '../../constants/routes';
import { DataTable, toArray } from './PlatformShared';

export const PlatformWorkbasketsPage = () => {
  const { firmSlug } = useParams();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    worklistApi.getGlobalWorklist({ limit: 50 }).then((res) => setRows(toArray(res?.data?.data || res?.data?.items))).catch(() => setRows([]));
  }, []);

  return (
    <PlatformShell title="Workbaskets" subtitle="Unassigned dockets pool">
      <DataTable columns={['Docket ID', 'Client', 'Category', 'Created', 'Status', 'Actions']} rows={rows.map((r) => (
        <tr key={r.caseInternalId || r._id}><td>{r.docketId || r.caseInternalId}</td><td>{r.clientName || '-'}</td><td>{r.category || '-'}</td><td>{new Date(r.createdAt || Date.now()).toLocaleDateString()}</td><td>{r.status || 'NEW'}</td><td className="action-row"><button onClick={() => caseApi.pullCase(r.caseInternalId)} type="button">Pull to WL</button><Link to={ROUTES.CASE_DETAIL(firmSlug, r.caseInternalId)}>View</Link></td></tr>
      ))} />
    </PlatformShell>
  );
};

export default PlatformWorkbasketsPage;
