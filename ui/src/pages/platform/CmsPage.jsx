import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { crmApi } from '../../api/crm.api';
import { formsApi } from '../../api/forms.api';
import { ROUTES } from '../../constants/routes';
import { DataTable, FilterBar, InlineNotice, PageSection, StatGrid, toArray } from './PlatformShared';

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
      setLeads(toArray(res?.data?.data || res?.data?.items));
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
  const iframeCode = selectedForm
    ? `<iframe src="${embedLink}" width="100%" height="700" frameborder="0" loading="lazy" title="${selectedForm.embedTitle || selectedForm.name}"></iframe>`
    : '';

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
    { label: 'Lead submissions', value: leads.length },
    { label: 'Converted to docket', value: leads.filter((lead) => lead.docketId).length },
    { label: 'Open intake items', value: leads.filter((lead) => !lead.docketId).length },
  ];

  return (
    <PlatformShell
      moduleLabel="CMS / Lead Capture"
      title="CMS Intake"
      subtitle="Landing pages, forms, public intake, and submission-to-docket conversion."
      actions={<Link to={ROUTES.CRM_LEADS(firmSlug)}>Full leads page</Link>}
    >
      <InlineNotice tone="error" message={error} />
      <InlineNotice tone="error" message={formsError} />
      <InlineNotice tone="info" message={copyState} />
      <StatGrid items={cmsStats} />
      <PageSection id="cms-surfaces" title="CMS surfaces" description="Lead-capture assets managed in the CMS module.">
        <div className="action-row">
          <span>Landing pages</span>
          <span>Forms</span>
          <span>Submissions / Intake</span>
          <span>Public intake tools</span>
        </div>
      </PageSection>

      <PageSection id="embed-forms" title="Embed on your website" description="Use this to place Docketra intake forms on your existing website. Submissions go to CMS intake and appear in CRM.">
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
            <div className="space-y-3">
              <div>
                <strong>Public form link</strong>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                  <code style={{ overflowWrap: 'anywhere' }}>{publicLink || '-'}</code>
                  <button type="button" onClick={() => void handleCopy(publicLink, 'Public link')}>Copy</button>
                </div>
              </div>
              <div>
                <strong>Embed link</strong>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                  <code style={{ overflowWrap: 'anywhere' }}>{embedLink || '-'}</code>
                  <button type="button" onClick={() => void handleCopy(embedLink, 'Embed link')}>Copy</button>
                </div>
              </div>
              <div>
                <strong>Iframe embed code</strong>
                <div style={{ marginTop: 6 }}>
                  <pre style={{ whiteSpace: 'pre-wrap', background: '#0F172A', color: '#F8FAFC', padding: 12, borderRadius: 8 }}>
                    {iframeCode || '-'}
                  </pre>
                  <button type="button" onClick={() => void handleCopy(iframeCode, 'Embed code')}>Copy embed code</button>
                </div>
              </div>
              <p style={{ marginTop: 12, color: '#475569' }}>
                Optional auto-docket creation follows your intake configuration.
              </p>
              <div style={{ marginTop: 8 }}>
                <strong>Fields rendered publicly</strong>
                <ul style={{ marginTop: 6, marginBottom: 0, paddingLeft: 18 }}>
                  {(selectedForm?.fields || []).map((field, index) => (
                    <li key={`${field.key || 'field'}-${index}`}>
                      {(field.label || field.key || `Field ${index + 1}`)} ({field.type || 'text'})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        ) : (
          <p>No forms found yet. Create a form first, then copy your embed code here.</p>
        )}
      </PageSection>

      <PageSection id="intake-queue" title="Intake queue" description="Track form submissions and conversion readiness.">
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
          emptyLabel="No intake submissions yet. Create a form or landing page to start capturing leads."
        />
      </PageSection>
    </PlatformShell>
  );
};

export default PlatformCmsPage;
