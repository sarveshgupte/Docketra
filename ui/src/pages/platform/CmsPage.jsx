import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { crmApi } from '../../api/crm.api';
import { formsApi } from '../../api/forms.api';
import { ROUTES, safeRoute } from '../../constants/routes';
import { DataTable, FilterBar, PageSection, SectionToolbar, StatGrid, StatusMessageStack, toArray } from './PlatformShared';
import { resolveCrmErrorMessage } from '../crm/crmUiUtils';

const EMPTY_FORM_FIELDS = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'email', label: 'Email', type: 'email', required: false },
  { key: 'phone', label: 'Phone', type: 'phone', required: false },
];

const normalizeText = (value) => String(value || '').trim();

const normalizeDomains = (value) => (
  String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
);

const parseOutcome = (lead) => ({
  createdClient: Boolean(lead?.metadata?.intakeOutcome?.createdClient),
  createdDocket: Boolean(lead?.metadata?.intakeOutcome?.createdDocket),
  clientId: lead?.metadata?.intakeOutcome?.clientId || null,
  docketId: lead?.metadata?.intakeOutcome?.docketId || null,
  warnings: toArray(lead?.metadata?.intakeOutcome?.warnings),
  warningDetails: toArray(lead?.metadata?.intakeOutcome?.warningDetails || lead?.metadata?.intakeDiagnostics?.warningDetails),
  submissionMode: lead?.metadata?.submissionMode || lead?.metadata?.intakeOutcome?.submissionMode || 'cms',
  source: lead?.source || lead?.metadata?.intakeOutcome?.source || 'CMS_FORM',
  sourceAttribution: lead?.metadata?.sourceAttribution || null,
});

const emptyEditorState = {
  id: null,
  name: '',
  isActive: true,
  allowEmbed: true,
  embedTitle: '',
  successMessage: 'Thank you. Your submission has been received.',
  redirectUrl: '',
  allowedEmbedDomainsInput: '',
  fields: EMPTY_FORM_FIELDS,
};

export const PlatformCmsPage = () => {
  const { firmSlug } = useParams();
  const [leads, setLeads] = useState([]);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [forms, setForms] = useState([]);
  const [formsError, setFormsError] = useState('');
  const [selectedFormId, setSelectedFormId] = useState('');
  const [copyState, setCopyState] = useState('');
  const [formsLoading, setFormsLoading] = useState(false);
  const [formEditor, setFormEditor] = useState(emptyEditorState);
  const [formSaving, setFormSaving] = useState(false);
  const [formEditorError, setFormEditorError] = useState('');
  const [formEditorSuccess, setFormEditorSuccess] = useState('');

  const loadLeads = async ({ background = false } = {}) => {
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const res = await crmApi.listLeads({ limit: 100 });
      setLeads(toArray(res?.data?.data || res?.data?.items || res?.data));
    } catch (loadError) {
      setLeads([]);
      setError(resolveCrmErrorMessage(loadError, 'Unable to load CMS intake leads.'));
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const loadForms = async () => {
    setFormsLoading(true);
    setFormsError('');
    try {
      const response = await formsApi.listForms();
      const records = toArray(response?.data);
      setForms(records);
      setSelectedFormId((prev) => (prev || String(records[0]?._id || records[0]?.id || '')));
    } catch (loadError) {
      setForms([]);
      setFormsError(resolveCrmErrorMessage(loadError, 'Unable to load forms.'));
    } finally {
      setFormsLoading(false);
    }
  };

  useEffect(() => {
    void loadLeads();
    void loadForms();
  }, []);

  const selectedForm = useMemo(
    () => forms.find((item) => String(item._id || item.id) === String(selectedFormId)) || null,
    [forms, selectedFormId],
  );

  const publicLink = selectedForm ? `${window.location.origin}/forms/${selectedForm._id}` : '';
  const embedLink = selectedForm ? `${publicLink}?embed=true` : '';
  const iframeSnippet = selectedForm
    ? `<iframe src="${embedLink}" title="${selectedForm.name || 'Docketra Intake'}" width="100%" height="680" style="border:0;max-width:640px;"></iframe>`
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

    return leads.filter((lead) => {
      const outcome = parseOutcome(lead);
      const sourceValue = String(outcome.source || '').toLowerCase();
      const modeValue = String(outcome.submissionMode || '').toLowerCase();

      if (sourceFilter !== 'all' && sourceValue !== sourceFilter) return false;
      if (modeFilter !== 'all' && modeValue !== modeFilter) return false;

      if (outcomeFilter === 'lead_only' && (outcome.createdClient || outcome.createdDocket)) return false;
      if (outcomeFilter === 'lead_client' && (!outcome.createdClient || outcome.createdDocket)) return false;
      if (outcomeFilter === 'lead_client_docket' && (!outcome.createdClient || !outcome.createdDocket)) return false;
      if (outcomeFilter === 'warnings_only' && outcome.warnings.length === 0) return false;

      if (!needle) return true;
      return [
        lead.name,
        lead.email,
        outcome.source,
        outcome.submissionMode,
        outcome.clientId,
        outcome.docketId,
      ].some((value) => String(value || '').toLowerCase().includes(needle));
    });
  }, [leads, query, sourceFilter, modeFilter, outcomeFilter]);

  const availableSources = useMemo(() => {
    const entries = new Set(leads.map((lead) => String(parseOutcome(lead).source || '').toLowerCase()).filter(Boolean));
    return [...entries].sort();
  }, [leads]);

  const cmsStats = [
    { label: 'Active forms', value: forms.filter((form) => form.isActive).length },
    {
      label: 'Submissions today',
      value: leads.filter((lead) => {
        if (!lead.createdAt) return false;
        const created = new Date(lead.createdAt);
        const now = new Date();
        return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth() && created.getDate() === now.getDate();
      }).length,
    },
    {
      label: 'Submissions (7d)',
      value: leads.filter((lead) => lead.createdAt && new Date(lead.createdAt).getTime() >= Date.now() - (7 * 24 * 60 * 60 * 1000)).length,
    },
    { label: 'Lead only', value: leads.filter((lead) => !parseOutcome(lead).createdClient && !parseOutcome(lead).createdDocket).length },
    { label: 'Converted to client', value: leads.filter((lead) => parseOutcome(lead).createdClient).length },
    { label: 'Converted to docket', value: leads.filter((lead) => parseOutcome(lead).createdDocket).length },
    { label: 'Routing/config warnings', value: leads.filter((lead) => parseOutcome(lead).warnings.length > 0).length },
  ];

  const hydrateEditorFromForm = (form) => {
    if (!form) {
      setFormEditor(emptyEditorState);
      return;
    }
    setFormEditor({
      id: form._id,
      name: form.name || '',
      isActive: Boolean(form.isActive),
      allowEmbed: Boolean(form.allowEmbed),
      embedTitle: form.embedTitle || '',
      successMessage: form.successMessage || 'Thank you. Your submission has been received.',
      redirectUrl: form.redirectUrl || '',
      allowedEmbedDomainsInput: toArray(form.allowedEmbedDomains).join(', '),
      fields: toArray(form.fields).length > 0 ? toArray(form.fields).map((field, index) => ({
        key: normalizeText(field?.key) || `field_${index + 1}`,
        label: normalizeText(field?.label) || normalizeText(field?.key) || `Field ${index + 1}`,
        type: ['text', 'email', 'phone'].includes(field?.type) ? field.type : 'text',
        required: Boolean(field?.required) || normalizeText(field?.key).toLowerCase() === 'name',
      })) : EMPTY_FORM_FIELDS,
    });
  };

  useEffect(() => {
    if (selectedForm) {
      hydrateEditorFromForm(selectedForm);
    }
  }, [selectedForm]);

  const setEditorField = (index, key, value) => {
    setFormEditor((prev) => ({
      ...prev,
      fields: prev.fields.map((field, fieldIndex) => (fieldIndex === index ? { ...field, [key]: value } : field)),
    }));
  };

  const addField = () => {
    setFormEditor((prev) => ({
      ...prev,
      fields: [...prev.fields, { key: '', label: '', type: 'text', required: false }],
    }));
  };

  const removeField = (index) => {
    setFormEditor((prev) => {
      const next = prev.fields.filter((_field, fieldIndex) => fieldIndex !== index);
      return {
        ...prev,
        fields: next.length > 0 ? next : EMPTY_FORM_FIELDS,
      };
    });
  };

  const resetEditorForCreate = () => {
    setFormEditor(emptyEditorState);
    setFormEditorError('');
    setFormEditorSuccess('');
  };

  const scrollToSection = (sectionId) => {
    if (!sectionId || typeof document === 'undefined') return;
    const target = document.getElementById(sectionId);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (typeof window !== 'undefined') {
      const nextHash = `#${sectionId}`;
      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`);
      }
    }
  };

  const handleCreateForm = () => {
    resetEditorForCreate();
    setSelectedFormId('');
    scrollToSection('embed-forms');
  };

  const handleGoToForms = () => {
    scrollToSection('embed-forms');
  };

  const handleSaveForm = async (event) => {
    event.preventDefault();
    if (formSaving) return;
    setFormEditorError('');
    setFormEditorSuccess('');

    const normalizedName = normalizeText(formEditor.name);
    if (!normalizedName) {
      setFormEditorError('Form name is required.');
      return;
    }

    const normalizedFields = formEditor.fields.map((field, index) => ({
      key: normalizeText(field.key) || `field_${index + 1}`,
      label: normalizeText(field.label) || normalizeText(field.key) || `Field ${index + 1}`,
      type: ['text', 'email', 'phone'].includes(field.type) ? field.type : 'text',
      required: Boolean(field.required) || normalizeText(field.key).toLowerCase() === 'name',
    }));

    if (!normalizedFields.some((field) => field.key.toLowerCase() === 'name')) {
      setFormEditorError('A name field is required for public/embed submissions.');
      return;
    }
    const fieldKeys = new Set();
    for (const field of normalizedFields) {
      const normalizedKey = String(field.key || '').toLowerCase();
      if (fieldKeys.has(normalizedKey)) {
        setFormEditorError(`Field key "${field.key}" is duplicated. Use unique field keys.`);
        return;
      }
      fieldKeys.add(normalizedKey);
    }

    const redirectUrl = normalizeText(formEditor.redirectUrl);
    if (redirectUrl) {
      try {
        // eslint-disable-next-line no-new
        new URL(redirectUrl);
      } catch {
        setFormEditorError('Redirect URL must be a valid absolute URL (for example: https://example.com/thank-you).');
        return;
      }
    }

    const payload = {
      name: normalizedName,
      fields: normalizedFields,
      isActive: Boolean(formEditor.isActive),
      allowEmbed: Boolean(formEditor.allowEmbed),
      embedTitle: normalizeText(formEditor.embedTitle),
      successMessage: normalizeText(formEditor.successMessage) || 'Thank you. Your submission has been received.',
      redirectUrl,
      allowedEmbedDomains: normalizeDomains(formEditor.allowedEmbedDomainsInput),
    };

    setFormSaving(true);
    try {
      if (formEditor.id) {
        await formsApi.updateForm(formEditor.id, payload);
        setFormEditorSuccess('Form updated.');
      } else {
        const response = await formsApi.createForm(payload);
        const created = response?.data;
        if (created?._id) {
          setSelectedFormId(created._id);
        }
        setFormEditorSuccess('Form created.');
      }
      await loadForms();
    } catch (saveError) {
      setFormEditorError(resolveCrmErrorMessage(saveError, 'Unable to save form.'));
    } finally {
      setFormSaving(false);
    }
  };

  return (
    <PlatformShell
      moduleLabel="CMS / Intake and Submission"
      title="CMS"
      subtitle="Intake and submission surface hub for request links, forms, and public intake routing."
      actions={<Link to={ROUTES.CRM_LEADS(firmSlug)}>Go to Intake Queue</Link>}
    >
      <StatusMessageStack
        messages={[
          { tone: 'error', message: error },
          { tone: 'error', message: formsError },
          { tone: 'info', message: copyState },
          { tone: 'info', message: refreshing ? 'Refreshing intake queue in the background…' : '' },
        ]}
      />
      <StatGrid items={cmsStats} />
      <PageSection
        title="What this module is for"
        description="CMS captures intake submissions. Leads are created first, then client/docket creation follows your configured intake settings."
      >
        <p className="muted">If no data appears yet, publish one form and submit a test intake.</p>
      </PageSection>

      <PageSection title="Quick actions" description="Move from intake setup to queue processing quickly.">
        <div className="action-row">
          <button type="button" onClick={() => void handleCopy(publicLink || embedLink, 'Intake link')} disabled={!selectedForm}>Copy intake link</button>
          <button type="button" onClick={handleCreateForm}>Create new form</button>
          <Link to={safeRoute(ROUTES.CRM_LEADS(firmSlug))}>Go to Intake Queue</Link>
          <button type="button" onClick={handleGoToForms}>Go to Forms</button>
          <Link to={safeRoute(`${ROUTES.WORK_SETTINGS(firmSlug)}#cms-intake-settings`)}>Open Intake Settings</Link>
        </div>
      </PageSection>

      <PageSection id="embed-forms" title="Form management" description="Create/edit intake forms and publish request links.">
        {forms.length > 0 ? (
          <div className="cms-form-editor__status-row">
            <label htmlFor="cms-form-select">Select form</label>
            <select
              id="cms-form-select"
              value={selectedFormId}
              onChange={(event) => setSelectedFormId(event.target.value)}
              className="cms-form-editor__form-select"
              disabled={formsLoading}
            >
              {forms.map((form) => (
                <option key={form._id} value={form._id}>{form.name}</option>
              ))}
            </select>
            <span>{selectedForm?.isActive ? 'Active' : 'Inactive'}</span>
            <span>{selectedForm?.allowEmbed ? 'Embeddable' : 'Embed disabled'}</span>
          </div>
        ) : (
          <p>No forms found yet. Create one below to start launch testing.</p>
        )}

        <form onSubmit={handleSaveForm} className="cms-form-editor">
          <StatusMessageStack
            messages={[
              { tone: 'error', message: formEditorError },
              { tone: 'success', message: formEditorSuccess },
            ]}
          />
          <div className="cms-form-editor__grid">
            <label className="cms-form-editor__field">
              Form name
              <input value={formEditor.name} onChange={(event) => setFormEditor((prev) => ({ ...prev, name: event.target.value }))} required />
            </label>
            <label className="cms-form-editor__field">
              Embed title
              <input value={formEditor.embedTitle} onChange={(event) => setFormEditor((prev) => ({ ...prev, embedTitle: event.target.value }))} />
            </label>
            <label className="cms-form-editor__field">
              Success message
              <input value={formEditor.successMessage} onChange={(event) => setFormEditor((prev) => ({ ...prev, successMessage: event.target.value }))} />
            </label>
            <label className="cms-form-editor__field">
              Redirect URL (optional)
              <input value={formEditor.redirectUrl} onChange={(event) => setFormEditor((prev) => ({ ...prev, redirectUrl: event.target.value }))} placeholder="https://example.com/thank-you" />
            </label>
          </div>

          <div className="cms-form-editor__toggles">
            <label className="cms-form-editor__toggle">
              <input
                type="checkbox"
                checked={formEditor.isActive}
                onChange={(event) => setFormEditor((prev) => ({ ...prev, isActive: event.target.checked }))}
              />
              {' '}
              Active
            </label>
            <label className="cms-form-editor__toggle">
              <input
                type="checkbox"
                checked={formEditor.allowEmbed}
                onChange={(event) => setFormEditor((prev) => ({ ...prev, allowEmbed: event.target.checked }))}
              />
              {' '}
              Allow embed
            </label>
          </div>

          <label className="cms-form-editor__field cms-form-editor__field--full">
            Allowed embed domains (comma-separated)
            <input
              value={formEditor.allowedEmbedDomainsInput}
              onChange={(event) => setFormEditor((prev) => ({ ...prev, allowedEmbedDomainsInput: event.target.value }))}
              placeholder="example.com, portal.example.com"
            />
          </label>

          <div className="cms-form-editor__fields">
            <strong>Fields</strong>
            {formEditor.fields.map((field, index) => (
              <div key={`${field.key || 'field'}-${index}`} className="cms-form-editor__field-row">
                <input
                  value={field.key}
                  onChange={(event) => setEditorField(index, 'key', event.target.value)}
                  placeholder="field key"
                  aria-label={`Field ${index + 1} key`}
                  required
                />
                <input
                  value={field.label}
                  onChange={(event) => setEditorField(index, 'label', event.target.value)}
                  placeholder="label"
                  aria-label={`Field ${index + 1} label`}
                />
                <select value={field.type} onChange={(event) => setEditorField(index, 'type', event.target.value)}>
                  <option value="text">Text</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                </select>
                <div className="cms-form-editor__field-actions">
                  <label className="cms-form-editor__toggle">
                    <input
                      type="checkbox"
                      checked={Boolean(field.required) || normalizeText(field.key).toLowerCase() === 'name'}
                      onChange={(event) => setEditorField(index, 'required', event.target.checked)}
                      disabled={normalizeText(field.key).toLowerCase() === 'name'}
                    />
                    {' '}
                    Required
                  </label>
                  <button
                    type="button"
                    onClick={() => removeField(index)}
                    aria-label={`Remove field ${field.label || field.key || index + 1}`}
                    disabled={formEditor.fields.length <= 1 || normalizeText(field.key).toLowerCase() === 'name'}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <div className="cms-form-editor__actions">
              <button type="button" onClick={addField}>Add field</button>
              <button type="submit" className="cms-form-editor__save-btn" disabled={formSaving}>
                {formSaving ? 'Saving…' : (formEditor.id ? 'Save form' : 'Create form')}
              </button>
            </div>
          </div>
        </form>

        {selectedForm ? (
          <>
            <div className="cms-form-editor__copy-actions">
              <button type="button" onClick={() => void handleCopy(publicLink, 'Public link')}>Copy public link</button>
              <button type="button" onClick={() => void handleCopy(embedLink, 'Embed link')}>Copy embed link</button>
              <button type="button" onClick={() => void handleCopy(iframeSnippet, 'Iframe snippet')}>Copy iframe snippet</button>
            </div>
            <p className="muted cms-form-editor__note">Document collection remains inside Docket → Attachments, not as a standalone CMS repository.</p>
          </>
        ) : null}
      </PageSection>

      <PageSection id="intake-queue" title="Intake queue summary" description="Track real submission outcomes, source attribution, and downstream handoff status.">
        <SectionToolbar>
          <FilterBar
            onClear={() => {
              setQuery('');
              setSourceFilter('all');
              setModeFilter('all');
              setOutcomeFilter('all');
            }}
            clearDisabled={!query && sourceFilter === 'all' && modeFilter === 'all' && outcomeFilter === 'all'}
          >
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search lead, source, mode, client, docket"
              aria-label="Search intake leads"
            />
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} aria-label="Filter by source">
              <option value="all">All sources</option>
              {availableSources.map((source) => <option key={source} value={source}>{source}</option>)}
            </select>
            <select value={modeFilter} onChange={(event) => setModeFilter(event.target.value)} aria-label="Filter by submission mode">
              <option value="all">All modes</option>
              <option value="public_form">Public form</option>
              <option value="embedded_form">Embedded form</option>
              <option value="cms">CMS</option>
              <option value="api_intake">API intake</option>
            </select>
            <select value={outcomeFilter} onChange={(event) => setOutcomeFilter(event.target.value)} aria-label="Filter by outcome">
              <option value="all">All outcomes</option>
              <option value="lead_only">Lead only</option>
              <option value="lead_client">Lead + client</option>
              <option value="lead_client_docket">Lead + client + docket</option>
              <option value="warnings_only">Routing/config warnings</option>
            </select>
            <button type="button" onClick={() => void loadLeads({ background: leads.length > 0 })} disabled={loading || refreshing}>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </FilterBar>
        </SectionToolbar>

        <DataTable
          columns={['Lead', 'Source', 'Submission mode', 'Created client?', 'Created docket?', 'Status / stage', 'Created at']}
          rows={filteredLeads.map((lead) => {
            const outcome = parseOutcome(lead);
            const leadId = lead._id || lead.id;
            const statusLabel = lead.stage || lead.status || 'new';
            const sourceDetail = outcome.sourceAttribution?.referrer || outcome.sourceAttribution?.pageUrl || null;
            return (
              <tr key={leadId}>
                <td>
                  <strong>{lead.name || '-'}</strong>
                  <div className="muted">{lead.email || 'No email'}</div>
                  {sourceDetail ? <div className="muted">From: {sourceDetail}</div> : null}
                  {outcome.warnings.length > 0 ? (
                    <div style={{ color: '#92400E' }}>
                      ⚠️ {outcome.warnings[0]}
                      {outcome.warningDetails[0]?.code ? <span className="muted"> ({outcome.warningDetails[0].code})</span> : null}
                      {outcome.warningDetails[0]?.recovery ? <div className="muted">Recovery: {outcome.warningDetails[0].recovery}</div> : null}
                    </div>
                  ) : null}
                </td>
                <td>{outcome.source || '-'}</td>
                <td>{outcome.submissionMode || '-'}</td>
                <td>{outcome.createdClient ? `Yes (${outcome.clientId || 'linked'})` : 'No'}</td>
                <td>{outcome.createdDocket ? `Yes (${outcome.docketId || 'linked'})` : 'No'}</td>
                <td>{statusLabel}</td>
                <td>{lead.createdAt ? new Date(lead.createdAt).toLocaleString() : '-'}</td>
              </tr>
            );
          })}
          loading={loading}
          error={error}
          onRetry={() => void loadLeads()}
          hasActiveFilters={Boolean(query.trim()) || sourceFilter !== 'all' || modeFilter !== 'all' || outcomeFilter !== 'all'}
          emptyLabel="No intake submissions yet. Publish a form, submit a test intake, then review conversion outcomes here."
          emptyLabelFiltered="No intake submissions match your current filters. Clear filters or broaden source/mode selection."
        />
      </PageSection>
    </PlatformShell>
  );
};

export default PlatformCmsPage;
