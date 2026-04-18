import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { crmApi } from '../../api/crm.api';
import { ROUTES } from '../../constants/routes';
import { DataTable, toArray } from './PlatformShared';

export const PlatformCrmPage = () => {
  const { firmSlug } = useParams();
  const [clients, setClients] = useState([]);

  useEffect(() => {
    crmApi.listClients({ limit: 50 }).then((res) => setClients(toArray(res?.data?.data || res?.data?.items))).catch(() => setClients([]));
  }, []);

  return (
    <PlatformShell title="CRM" subtitle="Client portfolio and docket relationships">
      <DataTable columns={['Client Name', 'Email', 'Phone', 'Total Dockets', 'Actions']} rows={clients.map((c) => (
        <tr key={c._id || c.id}><td>{c.name || c.clientName}</td><td>{c.email || '-'}</td><td>{c.phone || '-'}</td><td>{c.totalDockets || 0}</td><td className="action-row"><Link to={ROUTES.CRM_CLIENT_DETAIL(firmSlug, c._id || c.id)}>View client</Link><Link to={ROUTES.CASES(firmSlug)}>See all dockets</Link><button type="button" onClick={() => crmApi.createClient({ name: 'New Client', email: 'new@example.com' })}>Add client</button></td></tr>
      ))} />
    </PlatformShell>
  );
};

export default PlatformCrmPage;
