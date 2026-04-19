import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { crmApi } from '../../api/crm.api';
import { formsApi } from '../../api/forms.api';
import { ROUTES } from '../../constants/routes';
import { DataTable, FilterBar, InlineNotice, PageSection, RefreshNotice, StatGrid, toArray } from './PlatformShared';

export const PlatformCmsPage = () => {
  const { firmSlug } = useParams();
  const [leads, setLeads] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [forms, setForms] = useState([]);
  const [formsError, setFormsError] = useState('');
  const [selectedFormId, setSelectedFormId] = useState('');
  const [copyState, setCopyState] = useState('');

  const loadLeads = async ({ background = false } = {}) => {
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const res = await crmApi.listLeads({ limit: 50 });
      setLeads(toArray(res?.data?.data || res?.data?.items || res?.data));
    } catch {
      setLeads([]);
      setError('Unable to load CMS intake leads.');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLeads();
  }, []);

  useEffect(() => {
    const loadForms = async () => {
      setFormsError('');
      try {
        const response = await formsApi.listForms();
        const records = toArray(response?.data);
        setForms(records);
        setSelectedFormId((prev) => (prev || String(records[0]?._id || records[0]?.id || '')));
      } catch {
        setForms([]);
        setFormsError('Unable to load forms.');
      }
    };
    void loadForms();
  }, []);

  const selectedForm = useMemo(
    () => forms.find((item) => String(item._id || item.id) === String(selectedFormId)) || null,
    [forms, selectedFormId],
  );

  const publicLink = selectedForm ? `${window.location.origin}/forms/${selectedForm._id}` : '';
  const embedLink = selectedForm ? `${publicLink}?embed=true` : '';

  const handleCopy = async (text, label) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyState(`${label} copied`);
      window.setTimeout(() => setCopyState(''), 1800);
    } catch {
      setCopyState(`Unable to copy ${label.toLowerCase()}`);
    }
  };

  const filteredLeads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return leads;
    return leads.filter((lead) => [lead.name, lead.email, lead.source, lead.docketId]
      .some((value) => String(value || '').toLowerCase().includes(needle)));
  }, [leads, query]);

  const cmsStats = [
    { label: 'Total submissions', value: leads.length },
    { label: 'Open intake items', value: leads.filter((lead) => !lead.docketId).length },
    { label: 'Converted to docket', value: leads.filter((lead) => lead.docketId).length },
    { label: 'Active forms / request links', value: forms.filter((form) => form.isActive).length },
  ];

  return (
    <PlatformShell
      moduleLabel="CMS / Intake and Submission"
      title="CMS"
      subtitle="Intake and submission surface hub for request links, forms/templates, and public intake routing."
      actions={<Link to={ROUTES.CRM_LEADS(firmSlug)}>Go to Intake Queue</Link>}
    >
      <InlineNotice tone="error" message={error} />
      <InlineNotice tone="error" message={formsError} />
      <InlineNotice tone="info" message={copyState} />
      <RefreshNotice refreshing={refreshing} message="Refreshing intake queue in the background…" />
      <StatGrid items={cmsStats} />

      <PageSection title="Quick actions" description="Move from intake setup to queue processing quickly.">
        <div className="action-row">
          <button type="button" onClick={() => void handleCopy(publicLink || embedLink, 'Intake link')} disabled={!selectedForm}>Copy intake link</button>
          <Link to={`${ROUTES.CMS(firmSlug)}#intake-queue`}>Go to Intake Queue</Link>
          <Link to={`${ROUTES.CMS(firmSlug)}#embed-forms`}>Go to Forms/Templates</Link>
        </div>
      </PageSection>

      <PageSection id="cms-surfaces" title="CMS surfaces" description="Public intake surfaces and queue visibility for the CMS module.">
        <div className="tile-grid">
          <Link className="module-tile" to={`${ROUTES.CMS(firmSlug)}#intake-queue`}>
            <strong>Request Links / Intake Links</strong>
            <span>Share public intake entry points and capture submissions.</span>
          </Link>
          <Link className="module-tile" to={`${ROUTES.CMS(firmSlug)}#embed-forms`}>
            <strong>Forms / Templates</strong>
            <span>Manage form definitions and embeddable intake surfaces.</span>
          </Link>
          <Link className="module-tile" to={`${ROUTES.CMS(firmSlug)}#intake-queue`}>
            <strong>Public Intake / Submissions</strong>
            <span>Review submissions and conversion readiness to docket.</span>
          </Link>
        </div>
      </PageSection>

      <PageSection id="embed-forms" title="Embed forms" description="Use these links on your website; submissions route into intake and downstream CRM/Task workflows.">
        {forms.length > 0 ? (
          <>
            <div className="action-row" style={{ marginBottom: 16 }}>
              <label htmlFor="cms-form-select">Select form</label>
              <select
                id="cms-form-select"
                value={selectedFormId}
                onChange={(event) => setSelectedFormId(event.target.value)}
                style={{ minWidth: 260 }}
              >
                {forms.map((form) => (
                  <option key={form._id} value={form._id}>{form.name}</option>
                ))}
              </select>
              <span>{selectedForm?.isActive ? 'Active' : 'Inactive'}</span>
              <span>{selectedForm?.allowEmbed ? 'Embeddable' : 'Embed disabled'}</span>
            </div>
            <div className="action-row">
              <button type="button" onClick={() => void handleCopy(publicLink, 'Public link')}>Copy public link</button>
              <button type="button" onClick={() => void handleCopy(embedLink, 'Embed link')}>Copy embed link</button>
            </div>
            <p className="muted" style={{ marginTop: 8 }}>Document collection remains inside Docket → Attachments, not as a standalone CMS repository.</p>
          </>
        ) : (
          <p>No forms found yet. Create a form first, then copy your intake links here.</p>
        )}
      </PageSection>

      <PageSection id="intake-queue" title="Intake queue summary" description="Track submissions and conversion readiness.">
        <FilterBar onClear={() => setQuery('')} clearDisabled={!query}>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search lead, source, or docket"
            aria-label="Search intake leads"
          />
          <button type="button" onClick={() => void loadLeads({ background: leads.length > 0 })} disabled={loading || refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
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
          onRetry={() => void loadLeads()}
          hasActiveFilters={Boolean(query.trim())}
          emptyLabel="No intake submissions yet. Create a form or request link to start intake."
          emptyLabelFiltered="No intake submissions match your current search."
        />
      </PageSection>
    </PlatformShell>
  );
};

export default PlatformCmsPage;
