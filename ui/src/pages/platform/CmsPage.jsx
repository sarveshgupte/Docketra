import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { crmApi } from '../../api/crm.api';
import { ROUTES } from '../../constants/routes';
import { DataTable, FilterBar, InlineNotice, PageSection, StatGrid, toArray } from './PlatformShared';

export const PlatformCmsPage = () => {
  const { firmSlug } = useParams();
  const [leads, setLeads] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLeads = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await crmApi.listLeads({ limit: 50 });
      setLeads(toArray(res?.data?.data || res?.data?.items));
    } catch {
      setLeads([]);
      setError('Unable to load CMS intake leads.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLeads();
  }, []);

  const filteredLeads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return leads;
    return leads.filter((lead) => [lead.name, lead.email, lead.source, lead.docketId]
      .some((value) => String(value || '').toLowerCase().includes(needle)));
  }, [leads, query]);

  const cmsStats = [
    { label: 'Lead submissions', value: leads.length },
    { label: 'Converted to docket', value: leads.filter((lead) => lead.docketId).length },
    { label: 'Open intake items', value: leads.filter((lead) => !lead.docketId).length },
  ];

  return (
    <PlatformShell
      title="CMS Intake"
      subtitle="Lead capture, intake operations, and conversion to dockets"
      actions={<Link to={ROUTES.CRM_LEADS(firmSlug)}>Full leads page</Link>}
    >
      <InlineNotice tone="error" message={error} />
      <StatGrid items={cmsStats} />

      <PageSection title="Intake queue" description="Track form submissions and conversion readiness.">
        <FilterBar onClear={() => setQuery('')} clearDisabled={!query}>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search lead, source, or docket"
            aria-label="Search intake leads"
          />
          <button type="button" onClick={() => void loadLeads()} disabled={loading}>Refresh</button>
        </FilterBar>

        <DataTable
          columns={['Lead', 'Email', 'Source', 'Status', 'Created Docket']}
          rows={filteredLeads.map((lead) => (
            <tr key={lead._id || lead.id}>
              <td>{lead.name || '-'}</td>
              <td>{lead.email || '-'}</td>
              <td>{lead.source || 'Landing form'}</td>
              <td>{lead.status || 'NEW'}</td>
              <td>{lead.docketId || '-'}</td>
            </tr>
          ))}
          loading={loading}
          error={error}
          emptyLabel="No intake leads are available right now."
        />
      </PageSection>
    </PlatformShell>
  );
};

export default PlatformCmsPage;
