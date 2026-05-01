import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { PlatformShell } from '../components/platform/PlatformShell';
import { knowledgeItemsApi } from '../api/knowledgeItems.api';
import { WORK_TYPE_OPTIONS, isKnownWorkType, normalizeWorkType } from '../utils/workTypeOptions';
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

const CUSTOM_WORK_TYPE_OPTION = '__custom__';

const EMPTY_FORM = {
  title: '',
  type: 'sop',
  status: 'draft',
  summary: '',
  content: '',
  tags: '',
  ownerXid: '',
  linkedWorkType: '',
  linkedClientId: '',
  reviewDueAt: '',
  checklistSteps: [],
};

// ── Status badge colours ────────────────────────────────────────────────────
const STATUS_COLORS = {
  active:   { background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' },
  draft:    { background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' },
  archived: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' },
  review:   { background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047' },
};

const TYPE_COLORS = {
  sop:                { background: '#dbeafe', color: '#1e40af' },
  checklist:          { background: '#ede9fe', color: '#5b21b6' },
  template:           { background: '#ccfbf1', color: '#0f766e' },
  note:               { background: '#fef9c3', color: '#854d0e' },
  client_instruction: { background: '#e0e7ff', color: '#3730a3' },
  process:            { background: '#ffedd5', color: '#9a3412' },
};

const BADGE_BASE = {
  display: 'inline-block',
  padding: '0.15em 0.55em',
  borderRadius: '999px',
  fontSize: '0.75rem',
  fontWeight: 600,
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
};

const StatusBadge = ({ status }) => {
  const style = STATUS_COLORS[status] || STATUS_COLORS.draft;
  return <span style={{ ...BADGE_BASE, ...style }}>{formatLabel(status)}</span>;
};

const TypeBadge = ({ type }) => {
  const style = TYPE_COLORS[type] || { background: '#f3f4f6', color: '#374151' };
  return <span style={{ ...BADGE_BASE, ...style }}>{formatLabel(type)}</span>;
};

// ── Form component ──────────────────────────────────────────────────────────
const KnowledgeItemForm = ({ initial, onSave, onCancel, saving, saveError }) => {
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    ...initial,
    tags: Array.isArray(initial?.tags) ? initial.tags.join(', ') : (initial?.tags || ''),
    reviewDueAt: initial?.reviewDueAt ? new Date(initial.reviewDueAt).toISOString().slice(0, 10) : '',
    checklistSteps: Array.isArray(initial?.checklistSteps) ? initial.checklistSteps.map((step, idx) => ({
      label: String(step?.label || ''),
      description: String(step?.description || ''),
      order: Number.isFinite(Number(step?.order)) ? Number(step.order) : (idx + 1),
      required: step?.required !== false,
    })) : [],
  }));

  const initialLinkedWorkType = String(initial?.linkedWorkType || '').trim();
  const [selectedWorkType, setSelectedWorkType] = useState(() => {
    if (!initialLinkedWorkType) return '';
    return isKnownWorkType(initialLinkedWorkType) ? normalizeWorkType(initialLinkedWorkType) : CUSTOM_WORK_TYPE_OPTION;
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (name === 'linkedWorkTypeSelect') {
      setSelectedWorkType(value);
      if (value === '') {
        setForm((prev) => ({ ...prev, linkedWorkType: '' }));
        return;
      }
      if (value !== CUSTOM_WORK_TYPE_OPTION) {
        setForm((prev) => ({ ...prev, linkedWorkType: value }));
      }
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const updateChecklistStep = (index, patch) => {
    setForm((prev) => ({
      ...prev,
      checklistSteps: (prev.checklistSteps || []).map((step, stepIndex) =>
        stepIndex === index ? { ...step, ...patch } : step,
      ),
    }));
  };

  const addChecklistStep = () => {
    setForm((prev) => ({
      ...prev,
      checklistSteps: [
        ...(prev.checklistSteps || []),
        { label: '', description: '', order: (prev.checklistSteps || []).length + 1, required: true },
      ],
    }));
  };

  const removeChecklistStep = (index) => {
    setForm((prev) => ({
      ...prev,
      checklistSteps: (prev.checklistSteps || [])
        .filter((_, stepIndex) => stepIndex !== index)
        .map((step, idx) => ({ ...step, order: idx + 1 })),
    }));
  };

  const moveChecklistStep = (index, direction) => {
    setForm((prev) => {
      const next = [...(prev.checklistSteps || [])];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, checklistSteps: next.map((step, idx) => ({ ...step, order: idx + 1 })) };
    });
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
      linkedWorkType: normalizeWorkType(form.linkedWorkType) || null,
      linkedClientId: form.linkedClientId.trim() || null,
      reviewDueAt: form.reviewDueAt || null,
      checklistSteps: Array.isArray(form.checklistSteps)
        ? form.checklistSteps.map((step, idx) => ({
            label: String(step.label || '').trim(),
            description: String(step.description || '').trim() || null,
            order: Number(step.order) || (idx + 1),
            required: step.required !== false,
          }))
        : undefined,
    };
    onSave(payload);
  };

  const fieldsetStyle = {
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    padding: '1rem',
    marginBottom: '0.75rem',
  };
  const legendStyle = {
    fontWeight: 700,
    fontSize: '0.85rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#374151',
    padding: '0 0.4rem',
  };
  const labelStyle = { display: 'block', marginBottom: '0.25rem', fontWeight: 600 };
  const fieldGap = { display: 'flex', flexDirection: 'column', gap: '0.75rem' };
  const rowGap = { display: 'flex', gap: '0.75rem', flexWrap: 'wrap' };

  return (
    <form onSubmit={handleSubmit} aria-label="Knowledge item form">
      <div style={fieldGap}>

        {/* ── A. Basics ── */}
        <fieldset style={fieldsetStyle}>
          <legend style={legendStyle}>Basics</legend>
          <div style={fieldGap}>
            <div>
              <label htmlFor="ki-title" style={labelStyle}>
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

            <div style={rowGap}>
              <div style={{ flex: 1, minWidth: '140px' }}>
                <label htmlFor="ki-type" style={labelStyle}>
                  Type <span aria-hidden="true">*</span>
                </label>
                <select id="ki-type" name="type" value={form.type} onChange={handleChange} required aria-required="true" style={{ width: '100%' }}>
                  {ITEM_TYPES.map((t) => (
                    <option key={t} value={t}>{formatLabel(t)}</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: 1, minWidth: '140px' }}>
                <label htmlFor="ki-status" style={labelStyle}>
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
              <label htmlFor="ki-summary" style={labelStyle}>Summary</label>
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
              <label htmlFor="ki-content" style={labelStyle}>Content</label>
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
              <label htmlFor="ki-tags" style={labelStyle}>
                Tags <span style={{ fontWeight: 400, color: '#6b7280' }}>(comma-separated)</span>
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
          </div>
        </fieldset>

        {/* ── B. Ownership & linking ── */}
        <fieldset style={fieldsetStyle}>
          <legend style={legendStyle}>Ownership &amp; linking</legend>
          <div style={fieldGap}>
            <div style={rowGap}>
              <div style={{ flex: 1, minWidth: '140px' }}>
                <label htmlFor="ki-ownerXid" style={labelStyle}>Owner XID</label>
                <input
                  id="ki-ownerXid"
                  name="ownerXid"
                  type="text"
                  value={form.ownerXid}
                  onChange={handleChange}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ flex: 1, minWidth: '200px' }}>
                <label htmlFor="ki-linkedWorkTypeSelect" style={labelStyle}>Linked work type</label>
                <select
                  id="ki-linkedWorkTypeSelect"
                  name="linkedWorkTypeSelect"
                  value={selectedWorkType}
                  onChange={handleChange}
                  style={{ width: '100%' }}
                >
                  <option value="">Unlinked</option>
                  {WORK_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                  {!isKnownWorkType(form.linkedWorkType) && form.linkedWorkType.trim() ? (
                    <option value={CUSTOM_WORK_TYPE_OPTION}>{`Custom: ${form.linkedWorkType.trim()}`}</option>
                  ) : null}
                  <option value={CUSTOM_WORK_TYPE_OPTION}>Other / custom (advanced)</option>
                </select>
                {selectedWorkType === CUSTOM_WORK_TYPE_OPTION ? (
                  <input
                    id="ki-linkedWorkType"
                    name="linkedWorkType"
                    type="text"
                    value={form.linkedWorkType}
                    onChange={handleChange}
                    style={{ width: '100%', marginTop: '0.4rem' }}
                    placeholder="Enter custom work type"
                  />
                ) : null}
                <p style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.2rem', marginBottom: 0 }}>
                  Use the same work type/category used by dockets so this knowledge appears during work execution.
                </p>
              </div>
            </div>

            <div style={rowGap}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label htmlFor="ki-linkedClientId" style={labelStyle}>
                  Linked client ID <span style={{ fontWeight: 400, color: '#6b7280' }}>(advanced, optional)</span>
                </label>
                <input
                  id="ki-linkedClientId"
                  name="linkedClientId"
                  type="text"
                  value={form.linkedClientId}
                  onChange={handleChange}
                  style={{ width: '100%' }}
                />
                <p style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.2rem', marginBottom: 0 }}>
                  Linking a client lets this knowledge appear in Client Memory. Use the client&apos;s internal Mongo ID. A client picker will be added in a future update.
                </p>
              </div>

              <div style={{ flex: 1, minWidth: '140px' }}>
                <label htmlFor="ki-reviewDueAt" style={labelStyle}>Review due</label>
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
          </div>
        </fieldset>

        {/* ── C. Checklist steps (only when type === checklist) ── */}
        {form.type === 'checklist' ? (
          <fieldset style={fieldsetStyle}>
            <legend style={legendStyle}>Checklist steps</legend>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                {(form.checklistSteps || []).length} step{(form.checklistSteps || []).length !== 1 ? 's' : ''}
              </span>
              <button type="button" onClick={addChecklistStep}>Add step</button>
            </div>
            {(form.checklistSteps || []).length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.5rem 0' }}>
                No checklist steps yet. Add the first step to make this checklist useful during work execution.
              </p>
            ) : null}
            {(form.checklistSteps || []).map((step, index) => (
              <div
                key={`step-${index}`}
                style={{
                  borderTop: index ? '1px solid #f3f4f6' : 'none',
                  paddingTop: index ? '0.5rem' : 0,
                  marginTop: index ? '0.5rem' : 0,
                }}
              >
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <span style={{ minWidth: '60px', fontSize: '0.85rem', color: '#6b7280' }}>Step {index + 1}</span>
                  <input
                    type="text"
                    value={step.label}
                    onChange={(e) => updateChecklistStep(index, { label: e.target.value })}
                    placeholder="Step label"
                    maxLength={300}
                    style={{ flex: 1 }}
                  />
                </div>
                <textarea
                  value={step.description || ''}
                  onChange={(e) => updateChecklistStep(index, { description: e.target.value })}
                  placeholder="Description (optional)"
                  rows={2}
                  maxLength={2000}
                  style={{ width: '100%', marginTop: '0.35rem' }}
                />
                <label style={{ fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={step.required !== false}
                    onChange={(e) => updateChecklistStep(index, { required: e.target.checked })}
                  />{' '}
                  Required step
                </label>
                <div className="action-row" style={{ marginTop: '0.3rem' }}>
                  <button type="button" onClick={() => moveChecklistStep(index, -1)} disabled={index === 0}>Up</button>
                  <button type="button" onClick={() => moveChecklistStep(index, 1)} disabled={index === (form.checklistSteps || []).length - 1}>Down</button>
                  <button type="button" onClick={() => removeChecklistStep(index)}>Remove</button>
                </div>
              </div>
            ))}
          </fieldset>
        ) : null}

        {initial?.type === 'checklist' && form.type !== 'checklist' ? (
          <p className="inline-notice inline-notice--warning">Checklist steps are only used for checklist records.</p>
        ) : null}

        {/* ── D. Privacy reminder ── */}
        <p
          className="inline-notice inline-notice--warning"
          style={{ fontSize: '0.82rem', marginBottom: 0 }}
        >
          Structured knowledge only. Do not upload or paste sensitive client documents here; store heavy documents in firm-controlled storage/BYOS.
        </p>

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

// ── Detail drawer ───────────────────────────────────────────────────────────
const DRAWER_ASIDE_STYLE = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: '520px',
  maxWidth: '100vw',
  background: '#fff',
  borderLeft: '1px solid #e5e7eb',
  boxShadow: '-4px 0 24px rgba(0,0,0,0.10)',
  zIndex: 200,
};

const DetailRow = ({ label, value }) => (
  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
    <span style={{ fontWeight: 600, minWidth: '160px', color: '#374151', fontSize: '0.85rem' }}>{label}</span>
    <span style={{ color: '#111827', flex: 1, fontSize: '0.85rem' }}>{value || '—'}</span>
  </div>
);

const DrawerSectionLabel = ({ children }) => (
  <div style={{
    fontSize: '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: '#9ca3af',
    marginBottom: '0.5rem',
    marginTop: '1rem',
    paddingBottom: '0.25rem',
    borderBottom: '1px solid #f3f4f6',
  }}>
    {children}
  </div>
);

const KnowledgeItemDetailDrawer = ({ item, onEdit, onArchive, onClose }) => {
  if (!item) return null;
  const tags = toArray(item.tags);

  return (
    <aside
      aria-label="Knowledge Item Detail"
      role="complementary"
      style={{ ...DRAWER_ASIDE_STYLE, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}
    >
      {/* Header */}
      <div style={{
        padding: '1.25rem 1.5rem',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '0.75rem',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.3, wordBreak: 'break-word' }}>
            {item.title}
          </h2>
          <div style={{ marginTop: '0.35rem' }}>
            <StatusBadge status={item.status} />
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close detail drawer"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#6b7280', flexShrink: 0 }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: '1rem 1.5rem', flex: 1 }}>

        {/* Metadata */}
        <DrawerSectionLabel>Metadata</DrawerSectionLabel>
        <DetailRow label="Type" value={formatLabel(item.type)} />
        <DetailRow label="Owner" value={item.ownerXid} />
        <DetailRow label="Linked work type" value={item.linkedWorkType} />
        <DetailRow label="Linked client ID" value={item.linkedClientId || item.clientId} />
        <DetailRow label="Linked docket ID" value={item.linkedDocketId || item.docketId} />
        <DetailRow label="Review due" value={formatDate(item.reviewDueAt)} />
        <DetailRow label="Updated" value={formatDate(item.updatedAt)} />

        {/* Summary */}
        {item.summary ? (
          <>
            <DrawerSectionLabel>Summary</DrawerSectionLabel>
            <p style={{ fontSize: '0.875rem', color: '#374151', margin: 0 }}>{item.summary}</p>
          </>
        ) : null}

        {/* Content */}
        {item.content ? (
          <>
            <DrawerSectionLabel>Content</DrawerSectionLabel>
            <pre style={{
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              padding: '0.75rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '0.85rem',
              maxHeight: '240px',
              overflowY: 'auto',
              margin: 0,
            }}>
              {item.content}
            </pre>
          </>
        ) : null}

        {/* Checklist steps */}
        {item.type === 'checklist' && Array.isArray(item.checklistSteps) && item.checklistSteps.length ? (
          <>
            <DrawerSectionLabel>Checklist steps</DrawerSectionLabel>
            <ol style={{ margin: 0, paddingLeft: '1.1rem' }}>
              {item.checklistSteps.map((step, index) => (
                <li key={`detail-step-${index}`} style={{ marginBottom: '0.4rem', fontSize: '0.875rem' }}>
                  <div>
                    <strong>{step.label}</strong>{' '}
                    <span style={{ color: '#9ca3af', fontSize: '0.78rem' }}>
                      ({step.required === false ? 'Optional' : 'Required'})
                    </span>
                  </div>
                  {step.description ? <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>{step.description}</div> : null}
                </li>
              ))}
            </ol>
          </>
        ) : null}

        {/* Tags */}
        {tags.length ? (
          <>
            <DrawerSectionLabel>Tags</DrawerSectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    background: '#f3f4f6',
                    color: '#374151',
                    borderRadius: '999px',
                    padding: '0.15em 0.6em',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </>
        ) : null}

        {/* Audit */}
        <DrawerSectionLabel>Audit</DrawerSectionLabel>
        <DetailRow label="Created by" value={item.createdBy || item.createdByXid} />
        <DetailRow label="Updated by" value={item.updatedBy || item.updatedByXid} />
        <DetailRow label="Created at" value={formatDate(item.createdAt)} />
        <DetailRow label="Updated at" value={formatDate(item.updatedAt)} />

      </div>

      <div className="action-row" style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb', gap: '0.5rem' }}>
        {item.status !== 'archived' ? (
          <>
            <button type="button" onClick={() => onEdit(item)}>Edit</button>
            <button type="button" onClick={() => onArchive(item)}>Archive</button>
          </>
        ) : null}
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </aside>
  );
};

// ── Page ────────────────────────────────────────────────────────────────────
export const KnowledgeLibraryPage = () => {
  const { firmSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const hasLoadedRef = useRef(false);

  // Client-side filters — no API params
  const [searchQ, setSearchQ] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterWorkType, setFilterWorkType] = useState('');

  // Form state
  const [formMode, setFormMode] = useState(null); // null | 'create' | 'edit'
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Detail drawer state
  const [drawerItem, setDrawerItem] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState('');

  const itemParam = searchParams.get('item');

  // Open detail drawer when ?item= param is present
  useEffect(() => {
    if (!itemParam) {
      setDrawerItem(null);
      setDrawerError('');
      return;
    }

    let cancelled = false;
    const fetchItem = async () => {
      setDrawerLoading(true);
      setDrawerError('');
      try {
        const result = await knowledgeItemsApi.getKnowledgeItem(itemParam);
        const fetched = result?.data?.data || result?.data;
        if (!cancelled) {
          if (fetched && (fetched._id || fetched.id)) {
            setDrawerItem(fetched);
          } else {
            setDrawerItem(null);
            setDrawerError('Knowledge item could not be opened. It may have been archived, removed, or unavailable to this firm.');
          }
        }
      } catch {
        if (!cancelled) {
          setDrawerItem(null);
          setDrawerError('Knowledge item could not be opened. It may have been archived, removed, or unavailable to this firm.');
        }
      } finally {
        if (!cancelled) setDrawerLoading(false);
      }
    };

    void fetchItem();
    return () => { cancelled = true; };
  }, [itemParam]);

  const closeDrawer = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('item');
    setSearchParams(next, { replace: true });
    setDrawerItem(null);
    setDrawerError('');
  };

  const openDrawer = (item) => {
    const itemId = item._id || item.id;
    if (!itemId) return;
    const next = new URLSearchParams(searchParams);
    next.set('item', itemId);
    setSearchParams(next, { replace: true });
  };

  const loadData = async ({ background = false } = {}) => {
    if (background && hasLoadedRef.current) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      // Load all items; all filter/search narrowing is applied client-side via filteredItems.
      const result = await knowledgeItemsApi.listKnowledgeItems({});
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
    if (filterWorkType) {
      result = result.filter((item) => String(item.linkedWorkType || '').toLowerCase() === filterWorkType.toLowerCase());
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
  }, [items, filterType, filterStatus, filterTag, filterWorkType, searchQ]);

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
  const checklistCount = useMemo(() => items.filter((item) => item.type === 'checklist').length, [items]);
  const unlinkedCount = useMemo(
    () => items.filter((item) => !item.linkedWorkType && !item.linkedClientId && !item.linkedDocketId).length,
    [items],
  );

  const hasActiveFilters = Boolean(searchQ || filterType || filterStatus || filterTag || filterWorkType);

  const clearFilters = () => {
    setSearchQ('');
    setFilterType('');
    setFilterStatus('');
    setFilterTag('');
    setFilterWorkType('');
  };

  const openCreate = () => {
    setSaveError('');
    setEditingItem(null);
    setFormMode('create');
  };

  const openEdit = (item) => {
    closeDrawer();
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
      closeDrawer();
      void loadData({ background: true });
    } catch (archiveErr) {
      setStatusMessage(`Archive failed: ${archiveErr?.message || 'Please try again.'}`);
    }
  };

  const columns = ['Knowledge item', 'Type', 'Status', 'Links', 'Review due', 'Updated', 'Actions'];

  const tableRows = filteredItems.map((item) => {
    const itemId = item._id || item.id;
    const tags = toArray(item.tags);
    const summaryPreview = item.summary ? (item.summary.length > 80 ? `${item.summary.slice(0, 80)}…` : item.summary) : null;
    const hasLinks = item.linkedWorkType || item.linkedClientId || item.linkedDocketId;
    const stepCount = Array.isArray(item.checklistSteps) ? item.checklistSteps.length : 0;

    return (
      <tr key={itemId}>
        {/* Knowledge item cell */}
        <td style={{ maxWidth: '260px' }}>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.3 }}>{item.title || '—'}</div>
          {summaryPreview ? (
            <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.2rem' }}>{summaryPreview}</div>
          ) : null}
          {tags.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.3rem' }}>
              {tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  style={{
                    background: '#f3f4f6',
                    color: '#374151',
                    borderRadius: '999px',
                    padding: '0.1em 0.5em',
                    fontSize: '0.7rem',
                    fontWeight: 500,
                  }}
                >
                  {tag}
                </span>
              ))}
              {tags.length > 4 ? (
                <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>+{tags.length - 4}</span>
              ) : null}
            </div>
          ) : null}
        </td>

        {/* Type cell */}
        <td>
          <TypeBadge type={item.type} />
          {item.type === 'checklist' && stepCount > 0 ? (
            <span style={{
              display: 'inline-block',
              marginLeft: '0.35rem',
              background: '#f3f4f6',
              color: '#374151',
              borderRadius: '999px',
              padding: '0.1em 0.5em',
              fontSize: '0.7rem',
              fontWeight: 500,
            }}>
              {stepCount} step{stepCount !== 1 ? 's' : ''}
            </span>
          ) : null}
        </td>

        {/* Status cell */}
        <td><StatusBadge status={item.status} /></td>

        {/* Links cell */}
        <td style={{ fontSize: '0.78rem' }}>
          {hasLinks ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {item.linkedWorkType ? (
                <span style={{ color: '#1e40af' }}>⚙ {formatLabel(item.linkedWorkType)}</span>
              ) : null}
              {item.linkedClientId ? (
                <span style={{ color: '#065f46' }}>👤 {item.linkedClientId}</span>
              ) : null}
              {item.linkedDocketId ? (
                <span style={{ color: '#4338ca' }}>📁 {item.linkedDocketId}</span>
              ) : null}
            </div>
          ) : (
            <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Unlinked</span>
          )}
        </td>

        {/* Review due */}
        <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{formatDate(item.reviewDueAt)}</td>

        {/* Updated */}
        <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{formatDate(item.updatedAt)}</td>

        {/* Actions */}
        <td>
          <div className="action-row" style={{ gap: '0.4rem' }}>
            <button
              type="button"
              onClick={() => openDrawer(item)}
              aria-label={`View ${item.title}`}
              style={{ fontSize: '0.8rem' }}
            >
              View
            </button>
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

  const drawerOpen = Boolean(itemParam);

  return (
    <PlatformShell
      moduleLabel="Firm Memory"
      title="Knowledge Library"
      subtitle="Knowledge Library feeds Company Brain. SOPs, checklists, templates, notes, client instructions, and process records — all in one place."
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

      {/* Guidance panel */}
      <PageSection>
        <div style={{
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '6px',
          padding: '0.85rem 1rem',
          fontSize: '0.875rem',
          color: '#0c4a6e',
          marginBottom: '0.5rem',
        }}>
          <strong>Use Knowledge Library for reusable firm knowledge.</strong> Link records to work types, clients, or dockets so they appear during execution.
        </div>
        <p className="inline-notice inline-notice--warning" style={{ marginBottom: 0, fontSize: '0.82rem' }}>
          Do not upload or paste sensitive client documents here. Store heavy documents in firm-controlled storage/BYOS and use Knowledge Items for structured operational knowledge.
        </p>
      </PageSection>

      <StatGrid
        items={[
          { label: 'Total records', value: loading ? '…' : totalCount },
          { label: 'Active', value: loading ? '…' : activeCount },
          { label: 'Draft', value: loading ? '…' : draftCount },
          { label: 'Archived', value: loading ? '…' : archivedCount },
          { label: 'Review due', value: loading ? '…' : reviewDueCount, helpText: reviewDueCount > 0 ? 'Items past their scheduled review date.' : '' },
          { label: 'Checklist records', value: loading ? '…' : checklistCount },
          { label: 'Unlinked records', value: loading ? '…' : unlinkedCount, helpText: unlinkedCount > 0 ? 'Items with no linked work type, client, or docket.' : '' },
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
          <select
            value={filterWorkType}
            onChange={(event) => setFilterWorkType(event.target.value)}
            aria-label="Filter by work type"
          >
            <option value="">All work types</option>
            {WORK_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
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
          emptyLabel="Your Knowledge Library is empty. Add your first SOP, checklist, template, note, client instruction, or process record."
          emptyLabelFiltered="No knowledge items match these filters. Clear filters or adjust your search."
          hasActiveFilters={hasActiveFilters}
          error={error}
          onRetry={() => void loadData()}
          retryLabel="Retry"
          pageSize={20}
          paginationLabel="Knowledge items pagination"
        />
      </PageSection>

      {drawerOpen ? (
        drawerLoading ? (
          <aside
            aria-label="Knowledge Item Detail"
            role="complementary"
            style={{ ...DRAWER_ASIDE_STYLE, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
          >
            <p>Loading knowledge item…</p>
            <button type="button" onClick={closeDrawer} style={{ marginTop: '1rem' }}>Close</button>
          </aside>
        ) : drawerError ? (
          <aside
            aria-label="Knowledge Item Detail"
            role="complementary"
            style={{ ...DRAWER_ASIDE_STYLE, display: 'flex', flexDirection: 'column', padding: '1.5rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Knowledge Item Detail</h2>
              <button type="button" onClick={closeDrawer} aria-label="Close detail drawer" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#6b7280' }}>✕</button>
            </div>
            <p className="inline-notice inline-notice--error" role="alert">{drawerError}</p>
            <button type="button" onClick={closeDrawer} style={{ marginTop: '1rem' }}>Close</button>
          </aside>
        ) : (
          <KnowledgeItemDetailDrawer
            item={drawerItem}
            onEdit={openEdit}
            onArchive={(item) => void handleArchive(item)}
            onClose={closeDrawer}
          />
        )
      ) : null}
    </PlatformShell>
  );
};

export default KnowledgeLibraryPage;
