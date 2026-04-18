import React, { useEffect, useState } from 'react';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { crmApi } from '../../api/crm.api';
import { DataTable, toArray } from './PlatformShared';

export const PlatformCmsPage = () => {
  const [leads, setLeads] = useState([]);

  useEffect(() => {
    crmApi.listLeads({ limit: 50 }).then((res) => setLeads(toArray(res?.data?.data || res?.data?.items))).catch(() => setLeads([]));
  }, []);

  return (
    <PlatformShell title="CMS Intake" subtitle="Landing forms, lead submissions, and docket conversion">
      <section className="grid-cards"><article className="panel"><h3>Form Builder</h3><p className="muted">Compose intake fields and publish branded form URLs.</p></article><article className="panel"><h3>Lead to Docket Mapping</h3><p className="muted">Trace lead submissions to created dockets.</p></article></section>
      <DataTable columns={['Lead', 'Email', 'Source', 'Status', 'Created Docket']} rows={leads.map((l) => (
        <tr key={l._id || l.id}><td>{l.name || '-'}</td><td>{l.email || '-'}</td><td>{l.source || 'Landing form'}</td><td>{l.status || 'NEW'}</td><td>{l.docketId || '-'}</td></tr>
      ))} />
    </PlatformShell>
  );
};

export default PlatformCmsPage;
