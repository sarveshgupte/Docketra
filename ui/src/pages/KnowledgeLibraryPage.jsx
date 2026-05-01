import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PlatformShell } from '../components/platform/PlatformShell';
import { knowledgeItemsApi } from '../api/knowledgeItems.api';
import {
  DataTable,
  FilterBar,
  PageSection,
  StatGrid,
  StatusMessageStack,
  toArray,
} from './platform/PlatformShared';

const ITEM_TYPES = ['sop', 'checklist', 'template', 'note', 'client_instruction', 'process'];
const ITEM_STATUSES = ['draft', 'active'];

const formatLabel = (value) => String(value || '').replace(/_/g, ' ');

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
};

const normalizeTagInput = (raw) =>
  raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

const EMPTY_FORM = {
  title: '',
  type: 'sop',
  status: 'draft',
  summary: '',
  content: '',
  tags: '',
  ownerXid: '',
  linkedWorkType: '',
  reviewDueAt: '',
};

const KnowledgeItemForm = ({ initial, onSave, onCancel, saving, saveError }) => {
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    ...initial,
    tags: Array.isArray(initial?.tags) ? initial.tags.join(', ') : (initial?.tags || ''),
    reviewDueAt: initial?.reviewDueAt ? new Date(initial.reviewDueAt).toISOString().slice(0, 10) : '',
  }));

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const payload = {
      title: form.title.trim(),
      type: form.type,
      status: form.status,
      summary: form.summary.trim() || null,
      content: form.content.trim() || null,
      tags: normalizeTagInput(form.tags),
      ownerXid: form.ownerXid.trim() || null,
      linkedWorkType: form.linkedWorkType.trim() || null,
      reviewDueAt: form.reviewDueAt || null,
    };
    onSave(payload);
  };

  return (
    <form onSubmit={handleSubmit} aria-label="Knowledge item form">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div>
          <label htmlFor="ki-title" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>
            Title <span aria-hidden="true">*</span>
          </label>
          <input
            id="ki-title"
            name="title"
            type="text"
            value={form.title}
            onChange={handleChange}
            required
            maxLength={500}
            style={{ width: '100%' }}
            aria-required="true"
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '140px' }}>
            <label htmlFor="ki-type" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>
              Type <span aria-hidden="true">*</span>
            </label>
            <select id="ki-type" name="type" value={form.type} onChange={handleChange} required aria-required="true" style={{ width: '100%' }}>
              {ITEM_TYPES.map((t) => (
                <option key={t} value={t}>{formatLabel(t)}</option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: '140px' }}>
            <label htmlFor="ki-status" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>
              Status <span aria-hidden="true">*</span>
            </label>
            <select id="ki-status" name="status" value={form.status} onChange={handleChange} required aria-required="true" style={{ width: '100%' }}>
              {ITEM_STATUSES.map((s) => (
                <option key={s} value={s}>{formatLabel(s)}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="ki-summary" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Summary</label>
          <textarea
            id="ki-summary"
            name="summary"
            value={form.summary}
            onChange={handleChange}
            maxLength={2000}
            rows={2}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <label htmlFor="ki-content" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Content</label>
          <textarea
            id="ki-content"
            name="content"
            value={form.content}
            onChange={handleChange}
            maxLength={50000}
            rows={6}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <label htmlFor="ki-tags" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>
            Tags <span className="muted" style={{ fontWeight: 400 }}>(comma-separated)</span>
          </label>
          <input
            id="ki-tags"
            name="tags"
            type="text"
            value={form.tags}
            onChange={handleChange}
            placeholder="e.g. compliance, filing, annual"
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '140px' }}>
            <label htmlFor="ki-ownerXid" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Owner XID</label>
            <input
              id="ki-ownerXid"
              name="ownerXid"
              type="text"
              value={form.ownerXid}
              onChange={handleChange}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ flex: 1, minWidth: '140px' }}>
            <label htmlFor="ki-linkedWorkType" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Linked work type</label>
            <input
              id="ki-linkedWorkType"
              name="linkedWorkType"
              type="text"
              value={form.linkedWorkType}
              onChange={handleChange}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ flex: 1, minWidth: '140px' }}>
            <label htmlFor="ki-reviewDueAt" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Review due</label>
            <input
              id="ki-reviewDueAt"
              name="reviewDueAt"
              type="date"
              value={form.reviewDueAt}
              onChange={handleChange}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {saveError ? (
          <p className="inline-notice inline-notice--error" role="alert">{saveError}</p>
        ) : null}

        <div className="action-row">
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
};

export const KnowledgeLibraryPage = () => {
  const { firmSlug } = useParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const hasLoadedRef = useRef(false);

  // Filters
  const [searchQ, setSearchQ] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTag, setFilterTag] = useState('');

  // Form state
  const [formMode, setFormMode] = useState(null); // null | 'create' | 'edit'
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const loadData = async ({ background = false } = {}) => {
    if (background && hasLoadedRef.current) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const params = {};
      if (filterType) params.type = filterType;
      if (filterStatus) params.status = filterStatus;

      const result = await knowledgeItemsApi.listKnowledgeItems(params);
      const loaded = toArray(result?.data?.data || result?.data?.items || result?.data);
      setItems(loaded);
    } catch (loadError) {
      setItems([]);
      setError(loadError?.message || 'Failed to load knowledge items. Please retry.');
    } finally {
      hasLoadedRef.current = true;
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredItems = useMemo(() => {
    let result = items;
    if (filterType) result = result.filter((item) => item.type === filterType);
    if (filterStatus) result = result.filter((item) => item.status === filterStatus);
    if (filterTag) {
      const tag = filterTag.toLowerCase();
      result = result.filter((item) => toArray(item.tags).some((t) => String(t).toLowerCase().includes(tag)));
    }
    if (searchQ) {
      const q = searchQ.toLowerCase();
      result = result.filter(
        (item) =>
          String(item.title || '').toLowerCase().includes(q) ||
          String(item.summary || '').toLowerCase().includes(q) ||
          String(item.type || '').toLowerCase().includes(q),
      );
    }
    return result;
  }, [items, filterType, filterStatus, filterTag, searchQ]);

  const now = Date.now();
  const totalCount = items.length;
  const activeCount = useMemo(() => items.filter((item) => item.status === 'active').length, [items]);
  const draftCount = useMemo(() => items.filter((item) => item.status === 'draft').length, [items]);
  const archivedCount = useMemo(() => items.filter((item) => item.status === 'archived').length, [items]);
  const reviewDueCount = useMemo(
    () => items.filter((item) => item.reviewDueAt && new Date(item.reviewDueAt).getTime() <= now).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items],
  );

  const hasActiveFilters = Boolean(searchQ || filterType || filterStatus || filterTag);

  const clearFilters = () => {
    setSearchQ('');
    setFilterType('');
    setFilterStatus('');
    setFilterTag('');
  };

  const openCreate = () => {
    setSaveError('');
    setEditingItem(null);
    setFormMode('create');
  };

  const openEdit = (item) => {
    setSaveError('');
    setEditingItem(item);
    setFormMode('edit');
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingItem(null);
    setSaveError('');
  };

  const handleSave = async (payload) => {
    setSaving(true);
    setSaveError('');
    try {
      if (formMode === 'create') {
        await knowledgeItemsApi.createKnowledgeItem(payload);
        setStatusMessage('Knowledge item created.');
      } else if (formMode === 'edit' && editingItem) {
        await knowledgeItemsApi.updateKnowledgeItem(editingItem._id || editingItem.id, payload);
        setStatusMessage('Knowledge item updated.');
      }
      closeForm();
      void loadData({ background: true });
    } catch (saveErr) {
      setSaveError(saveErr?.message || 'Failed to save knowledge item. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (item) => {
    const itemId = item._id || item.id;
    if (!itemId) return;
    setStatusMessage('');
    try {
      await knowledgeItemsApi.archiveKnowledgeItem(itemId);
      setStatusMessage('Knowledge item archived.');
      void loadData({ background: true });
    } catch (archiveErr) {
      setStatusMessage(`Archive failed: ${archiveErr?.message || 'Please try again.'}`);
    }
  };

  const columns = ['Title', 'Type', 'Status', 'Tags', 'Owner', 'Review due', 'Updated', 'Actions'];

  const tableRows = filteredItems.map((item) => {
    const itemId = item._id || item.id;
    return (
      <tr key={itemId}>
        <td>{item.title || '—'}</td>
        <td>{formatLabel(item.type)}</td>
        <td>{formatLabel(item.status)}</td>
        <td>{toArray(item.tags).join(', ') || '—'}</td>
        <td>{item.ownerXid || '—'}</td>
        <td>{formatDate(item.reviewDueAt)}</td>
        <td>{formatDate(item.updatedAt)}</td>
        <td>
          <div className="action-row" style={{ gap: '0.4rem' }}>
            {item.status !== 'archived' ? (
              <>
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  aria-label={`Edit ${item.title}`}
                  style={{ fontSize: '0.8rem' }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void handleArchive(item)}
                  aria-label={`Archive ${item.title}`}
                  style={{ fontSize: '0.8rem' }}
                >
                  Archive
                </button>
              </>
            ) : (
              <span className="muted" style={{ fontSize: '0.8rem' }}>Archived</span>
            )}
          </div>
        </td>
      </tr>
    );
  });

  return (
    <PlatformShell
      moduleLabel="Firm Memory"
      title="Knowledge Library"
      subtitle="SOPs, checklists, templates, notes, client instructions, and process records that feed Company Brain."
      actions={(
        <div className="action-row">
          <button type="button" onClick={openCreate} disabled={loading}>
            New Knowledge Item
          </button>
          <button
            type="button"
            onClick={() => void loadData({ background: true })}
            disabled={loading || refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      )}
    >
      <StatusMessageStack
        messages={[
          { tone: 'error', message: error },
          { tone: 'success', message: statusMessage },
          { tone: 'info', message: refreshing ? 'Refreshing Knowledge Library in the background…' : '' },
        ]}
      />

      <PageSection>
        <p className="inline-notice inline-notice--info" style={{ marginBottom: '0.5rem' }}>
          Knowledge Library feeds Company Brain. These records will later connect to clients, dockets, work types,
          and process templates so teams can execute with context.
        </p>
        <p className="inline-notice inline-notice--warning">
          Do not upload or paste sensitive client documents here. Store heavy documents in firm-controlled
          storage/BYOS and use KnowledgeItems for structured operational knowledge.
        </p>
      </PageSection>

      <StatGrid
        items={[
          { label: 'Total knowledge items', value: loading ? '…' : totalCount },
          { label: 'Active', value: loading ? '…' : activeCount },
          { label: 'Draft', value: loading ? '…' : draftCount },
          { label: 'Archived', value: loading ? '…' : archivedCount },
          { label: 'Review due', value: loading ? '…' : reviewDueCount, helpText: reviewDueCount > 0 ? 'Items past their scheduled review date.' : '' },
        ]}
      />

      {formMode ? (
        <PageSection title={formMode === 'create' ? 'New Knowledge Item' : 'Edit Knowledge Item'}>
          <KnowledgeItemForm
            initial={editingItem || {}}
            onSave={handleSave}
            onCancel={closeForm}
            saving={saving}
            saveError={saveError}
          />
        </PageSection>
      ) : null}

      <PageSection
        title="Knowledge items"
        description="All firm knowledge records. Use filters to narrow results."
        actions={null}
      >
        <FilterBar
          onClear={hasActiveFilters ? clearFilters : undefined}
          clearDisabled={!hasActiveFilters}
        >
          <input
            type="search"
            placeholder="Search…"
            value={searchQ}
            onChange={(event) => setSearchQ(event.target.value)}
            aria-label="Search knowledge items"
            style={{ minWidth: '160px' }}
          />
          <select
            value={filterType}
            onChange={(event) => setFilterType(event.target.value)}
            aria-label="Filter by type"
          >
            <option value="">All types</option>
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>{formatLabel(t)}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
          <input
            type="text"
            placeholder="Filter by tag…"
            value={filterTag}
            onChange={(event) => setFilterTag(event.target.value)}
            aria-label="Filter by tag"
            style={{ minWidth: '130px' }}
          />
        </FilterBar>

        <DataTable
          columns={columns}
          rows={tableRows}
          loading={loading}
          loadingLabel="Loading knowledge items…"
          emptyLabel="Your firm knowledge library is empty. Start by adding an SOP, checklist, template, note, client instruction, or process record."
          emptyLabelFiltered="No knowledge items match these filters."
          hasActiveFilters={hasActiveFilters}
          error={error}
          onRetry={() => void loadData()}
          retryLabel="Retry"
          pageSize={20}
          paginationLabel="Knowledge items pagination"
        />
      </PageSection>
    </PlatformShell>
  );
};

export default KnowledgeLibraryPage;
