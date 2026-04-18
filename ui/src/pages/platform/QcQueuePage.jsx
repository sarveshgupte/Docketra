import React, { useEffect, useState } from 'react';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { caseApi } from '../../api/case.api';
import { DataTable, toArray } from './PlatformShared';

export const PlatformQcQueuePage = () => {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    caseApi.getCases({ state: 'IN_QC', limit: 50 }).then((res) => {
      const nextRows = toArray(res?.data?.data || res?.data?.items);
      setRows(nextRows);
    }).catch(() => setRows([]));
  }, []);

  const safeRows = Array.isArray(rows) ? rows : [];

  return (
    <PlatformShell title="QC Queue" subtitle="Review queue for quality control decisions">
      <DataTable columns={['Docket', 'User', 'Time Spent', 'Actions']} rows={safeRows.map((r) => (
        <tr key={r.caseInternalId || r._id}><td>{r.docketId || r.caseInternalId}</td><td>{r.assigneeName || r.assignedTo || '-'}</td><td>{r.timeSpent || '0m'}</td><td className="action-row"><button type="button" onClick={() => caseApi.qcAction(r.caseInternalId, 'PASS', 'Passed from queue')}>Pass</button><button type="button" onClick={() => caseApi.qcAction(r.caseInternalId, 'FAIL', 'Failed from queue')}>Fail</button><button type="button" onClick={() => caseApi.qcAction(r.caseInternalId, 'CORRECT', 'Needs correction')}>Correct</button></td></tr>
      ))} />
    </PlatformShell>
  );
};

export default PlatformQcQueuePage;
