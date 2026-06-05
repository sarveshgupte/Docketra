import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { PlatformShell } from '../components/platform/PlatformShell';
import { knowledgeItemsApi } from '../api/knowledgeItems.api';
import { adminApi } from '../api/admin.api';
import { WORK_TYPE_OPTIONS, isKnownWorkType, normalizeWorkType } from '../utils/workTypeOptions';
import {
  DataTable,
  FilterBar,
  PageSection,
  StatusMessageStack,
  toArray,
} from './platform/PlatformShared';

import { formatDateOnly } from '../utils/formatDateTime';

const ITEM_TYPES = ['sop', 'checklist', 'template', 'note', 'client_instruction', 'process'];
const ITEM_STATUSES = ['draft', 'active'];

const formatLabel = (value) => String(value || '').replace(/_/g, ' ');

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return formatDateOnly(date);
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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
      checklistSteps: form.type === 'checklist' && Array.isArray(form.checklistSteps)
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
    border: '1px solid #e8e6e0',
    borderRadius: '8px',
    padding: '1.25rem',
    marginBottom: '1rem',
    background: '#ffffff',
  };
  const legendStyle = {
    fontWeight: 700,
    fontSize: '0.78rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#7a7870',
    padding: '0 0.5rem',
  };
  const labelStyle = { display: 'block', marginBottom: '0.3rem', fontWeight: 600, fontSize: '0.82rem', color: '#3d3c38' };
  const fieldGap = { display: 'flex', flexDirection: 'column', gap: '0.85rem' };
  const rowGap = { display: 'flex', gap: '0.85rem', flexWrap: 'wrap' };

  return (
    <form onSubmit={handleSubmit} aria-label="Knowledge item form">
      <div style={fieldGap}>

        {/* ── A. Basics ── */}
        <fieldset style={fieldsetStyle}>
          <legend style={legendStyle}>Basics</legend>
          <div style={fieldGap}>
            <div>
              <label htmlFor="ki-title" style={labelStyle}>
                Title <span aria-hidden="true" style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="ki-title"
                name="title"
                type="text"
                className="form-input"
                value={form.title}
                onChange={handleChange}
                required
                maxLength={500}
                style={{ width: '100%', height: '36px' }}
                aria-required="true"
              />
            </div>

            <div style={rowGap}>
              <div style={{ flex: 1, minWidth: '140px' }}>
                <label htmlFor="ki-type" style={labelStyle}>
                  Type <span aria-hidden="true" style={{ color: '#ef4444' }}>*</span>
                </label>
                <select id="ki-type" name="type" className="form-input" value={form.type} onChange={handleChange} required aria-required="true" style={{ width: '100%', height: '36px' }}>
                  {ITEM_TYPES.map((t) => (
                    <option key={t} value={t}>{formatLabel(t)}</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: 1, minWidth: '140px' }}>
                <label htmlFor="ki-status" style={labelStyle}>
                  Status <span aria-hidden="true" style={{ color: '#ef4444' }}>*</span>
                </label>
                <select id="ki-status" name="status" className="form-input" value={form.status} onChange={handleChange} required aria-required="true" style={{ width: '100%', height: '36px' }}>
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
                className="form-input"
                value={form.summary}
                onChange={handleChange}
                maxLength={2000}
                rows={2}
                style={{ width: '100%', padding: '0.5rem' }}
              />
            </div>

            <div>
              <label htmlFor="ki-content" style={labelStyle}>Content</label>
              <textarea
                id="ki-content"
                name="content"
                className="form-input"
                value={form.content}
                onChange={handleChange}
                maxLength={50000}
                rows={6}
                style={{ width: '100%', padding: '0.5rem', fontFamily: 'monospace' }}
              />
            </div>

            <div>
              <label htmlFor="ki-tags" style={labelStyle}>
                Tags <span style={{ fontWeight: 400, color: '#7a7870' }}>(comma-separated)</span>
              </label>
              <input
                id="ki-tags"
                name="tags"
                type="text"
                className="form-input"
                value={form.tags}
                onChange={handleChange}
                placeholder="e.g. compliance, filing, annual"
                style={{ width: '100%', height: '36px' }}
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
                  className="form-input"
                  value={form.ownerXid}
                  onChange={handleChange}
                  style={{ width: '100%', height: '36px' }}
                />
              </div>

              <div style={{ flex: 1, minWidth: '200px' }}>
                <label htmlFor="ki-linkedWorkTypeSelect" style={labelStyle}>Linked work type</label>
                <select
                  id="ki-linkedWorkTypeSelect"
                  name="linkedWorkTypeSelect"
                  className="form-input"
                  value={selectedWorkType}
                  onChange={handleChange}
                  style={{ width: '100%', height: '36px' }}
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
                    className="form-input"
                    value={form.linkedWorkType}
                    onChange={handleChange}
                    style={{ width: '100%', marginTop: '0.4rem', height: '36px' }}
                    placeholder="Enter custom work type"
                  />
                ) : null}
                <p style={{ fontSize: '0.75rem', color: '#7a7870', marginTop: '0.3rem', marginBottom: 0, lineHeight: 1.35 }}>
                  Use the same work type/category used by dockets so this knowledge appears during work execution.
                </p>
              </div>
            </div>

            <div style={rowGap}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label htmlFor="ki-linkedClientId" style={labelStyle}>
                  Linked client ID <span style={{ fontWeight: 400, color: '#7a7870' }}>(advanced, optional)</span>
                </label>
                <input
                  id="ki-linkedClientId"
                  name="linkedClientId"
                  type="text"
                  className="form-input"
                  value={form.linkedClientId}
                  onChange={handleChange}
                  style={{ width: '100%', height: '36px' }}
                />
                <p style={{ fontSize: '0.75rem', color: '#7a7870', marginTop: '0.3rem', marginBottom: 0, lineHeight: 1.35 }}>
                  Linking a client lets this knowledge appear in Client Memory workspace.
                </p>
              </div>

              <div style={{ flex: 1, minWidth: '140px' }}>
                <label htmlFor="ki-reviewDueAt" style={labelStyle}>Review due</label>
                <input
                  id="ki-reviewDueAt"
                  name="reviewDueAt"
                  type="date"
                  className="form-input"
                  value={form.reviewDueAt}
                  onChange={handleChange}
                  style={{ width: '100%', height: '36px' }}
                />
              </div>
            </div>
          </div>
        </fieldset>

        {/* ── C. Checklist steps (only when type === checklist) ── */}
        {form.type === 'checklist' ? (
          <fieldset style={fieldsetStyle}>
            <legend style={legendStyle}>Checklist steps</legend>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#7a7870', fontWeight: 500 }}>
                {(form.checklistSteps || []).length} step{(form.checklistSteps || []).length !== 1 ? 's' : ''} defined
              </span>
              <button
                type="button"
                onClick={addChecklistStep}
                style={{
                  padding: '2px 8px',
                  fontSize: '0.75rem',
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                + Add Step
              </button>
            </div>
            {(form.checklistSteps || []).length === 0 ? (
              <p style={{ color: '#7a7870', fontSize: '0.8rem', margin: '0.5rem 0', fontStyle: 'italic' }}>
                No checklist steps yet. Add the first step to make this checklist useful.
              </p>
            ) : null}
            {(form.checklistSteps || []).map((step, index) => (
              <div
                key={`step-${index}`}
                style={{
                  borderTop: index ? '1px solid #e8e6e0' : 'none',
                  paddingTop: index ? '0.75rem' : 0,
                  marginTop: index ? '0.75rem' : 0,
                }}
              >
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: '#eff5ff',
                    color: '#2563eb',
                    fontSize: '11px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {index + 1}
                  </div>
                  <input
                    type="text"
                    className="form-input"
                    value={step.label}
                    onChange={(e) => updateChecklistStep(index, { label: e.target.value })}
                    placeholder="Step label (e.g. Verify tax return status)"
                    maxLength={300}
                    style={{ flex: 1, height: '32px' }}
                  />
                </div>
                <textarea
                  value={step.description || ''}
                  onChange={(e) => updateChecklistStep(index, { description: e.target.value })}
                  placeholder="Detailed guidance / instructions for this step (optional)"
                  rows={2}
                  className="form-input"
                  maxLength={2000}
                  style={{ width: '100%', marginTop: '0.25rem', padding: '0.4rem', fontSize: '0.8rem' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
                  <label style={{ fontSize: '0.78rem', color: '#3d3c38', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={step.required !== false}
                      onChange={(e) => updateChecklistStep(index, { required: e.target.checked })}
                    />{' '}
                    Required step
                  </label>
                  <div className="action-row" style={{ gap: '0.25rem' }}>
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveChecklistStep(index, -1)}
                      style={{ padding: '2px 6px', fontSize: '10px', height: '24px' }}
                      title="Move Up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === (form.checklistSteps || []).length - 1}
                      onClick={() => moveChecklistStep(index, 1)}
                      style={{ padding: '2px 6px', fontSize: '10px', height: '24px' }}
                      title="Move Down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeChecklistStep(index)}
                      style={{ padding: '2px 6px', fontSize: '10px', color: '#ef4444', borderColor: '#fee2e2', height: '24px' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </fieldset>
        ) : null}

        {initial?.type === 'checklist' && form.type !== 'checklist' ? (
          <p className="inline-notice inline-notice--warning" style={{ fontSize: '0.8rem' }}>Checklist steps are only used for checklist records.</p>
        ) : null}

        {/* ── D. Privacy reminder ── */}
        <p
          className="inline-notice inline-notice--warning"
          style={{ fontSize: '0.78rem', marginBottom: 0 }}
        >
          Structured knowledge only. Do not paste sensitive client documents here; store them in BYOS.
        </p>

        {saveError ? (
          <p className="inline-notice inline-notice--error" role="alert" style={{ fontSize: '0.8rem', padding: '0.5rem' }}>{saveError}</p>
        ) : null}

        <div className="action-row" style={{ marginTop: '0.75rem', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} disabled={saving} style={{ height: '36px', px: '15px' }}>
            Cancel
          </button>
          <button type="submit" className="action-primary" disabled={saving} style={{ height: '36px', px: '20px' }}>
            {saving ? 'Saving…' : 'Save Item'}
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
  width: '540px',
  maxWidth: '100vw',
  background: '#fff',
  borderLeft: '1px solid #e8e6e0',
  boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
  zIndex: 200,
  display: 'flex',
  flexDirection: 'column',
};

const DetailRow = ({ label, value }) => (
  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
    <span style={{ fontWeight: 600, minWidth: '150px', color: '#7a7870', fontSize: '0.82rem' }}>{label}</span>
    <span style={{ color: '#1a1916', flex: 1, fontSize: '0.82rem' }}>{value || '—'}</span>
  </div>
);

const DrawerSectionLabel = ({ children }) => (
  <div style={{
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: '#b0aea8',
    marginBottom: '0.5rem',
    marginTop: '1.25rem',
    paddingBottom: '0.2rem',
    borderBottom: '1px solid #f3f2ef',
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
      style={DRAWER_ASIDE_STYLE}
    >
      {/* Header */}
      <div style={{
        padding: '1.25rem 1.5rem',
        borderBottom: '1px solid #e8e6e0',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '0.75rem',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.3, wordBreak: 'break-word', color: '#1a1916' }}>
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
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#b0aea8', flexShrink: 0 }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: '1rem 1.5rem', flex: 1, overflowY: 'auto' }}>

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
            <p style={{ fontSize: '0.85rem', color: '#3d3c38', margin: 0, lineHeight: 1.45 }}>{item.summary}</p>
          </>
        ) : null}

        {/* Content */}
        {item.content ? (
          <>
            <DrawerSectionLabel>Content</DrawerSectionLabel>
            <pre style={{
              background: '#fafaf8',
              border: '1px solid #e8e6e0',
              borderRadius: '6px',
              padding: '0.75rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '0.8rem',
              fontFamily: 'monospace',
              maxHeight: '280px',
              overflowY: 'auto',
              margin: 0,
              color: '#1a1916',
              lineHeight: 1.4
            }}>
              {item.content}
            </pre>
          </>
        ) : null}

        {/* Checklist steps */}
        {item.type === 'checklist' && Array.isArray(item.checklistSteps) && item.checklistSteps.length ? (
          <>
            <DrawerSectionLabel>Checklist steps</DrawerSectionLabel>
            <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
              {item.checklistSteps.map((step, index) => (
                <li key={`detail-step-${index}`} style={{ marginBottom: '0.5rem', fontSize: '0.82rem', color: '#3d3c38', lineHeight: 1.4 }}>
                  <div>
                    <strong>{step.label}</strong>{' '}
                    <span style={{ color: '#b0aea8', fontSize: '0.75rem' }}>
                      ({step.required === false ? 'Optional' : 'Required'})
                    </span>
                  </div>
                  {step.description ? <div style={{ color: '#7a7870', fontSize: '0.78rem', marginTop: '0.1rem' }}>{step.description}</div> : null}
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
                    background: '#f3f2ef',
                    color: '#3d3c38',
                    borderRadius: '4px',
                    padding: '0.15em 0.5em',
                    fontSize: '0.75rem',
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
        <DrawerSectionLabel>Audit Info</DrawerSectionLabel>
        <DetailRow label="Created by" value={item.createdBy || item.createdByXid} />
        <DetailRow label="Updated by" value={item.updatedBy || item.updatedByXid} />
        <DetailRow label="Created at" value={formatDate(item.createdAt)} />
        <DetailRow label="Updated at" value={formatDate(item.updatedAt)} />

      </div>

      <div className="action-row" style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e8e6e0', gap: '0.5rem', justifyContent: 'flex-end', background: '#fafaf8' }}>
        {item.status !== 'archived' ? (
          <>
            <button type="button" onClick={() => onEdit(item)}>Edit</button>
            <button type="button" onClick={() => onArchive(item)} style={{ color: '#ef4444', borderColor: '#fee2e2' }}>Archive</button>
          </>
        ) : null}
        <button type="button" className="action-primary" onClick={onClose}>Close</button>
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

  // Tab state: 'directory' | 'audit'
  const [activeTab, setActiveTab] = useState('directory');

  // Client-side filters
  const [searchQ, setSearchQ] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterWorkType, setFilterWorkType] = useState('');

  // Sorting state
  const [sortState, setSortState] = useState({ key: 'updatedAt', direction: 'desc' });

  // Form state
  const [formMode, setFormMode] = useState(null); // null | 'create' | 'edit'
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Detail drawer state
  const [drawerItem, setDrawerItem] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState('');

  // Audit trail state
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);

  const itemParam = searchParams.get('item');
  const actionParam = searchParams.get('action');
  const workTypeParam = searchParams.get('workType');

  // Load audit trail logs
  const loadAuditLogs = async (p = 1) => {
    setAuditLoading(true);
    setAuditError('');
    try {
      const result = await adminApi.getAuditLogs({ module: 'knowledge', page: p, limit: 15 });
      setAuditLogs(Array.isArray(result?.data) ? result.data : []);
      setAuditPage(p);
      setAuditTotalPages(result?.pagination?.totalPages || 1);
      setAuditTotal(result?.pagination?.total || 0);
    } catch (err) {
      setAuditError(err?.message || 'Failed to load audit trail logs.');
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') {
      void loadAuditLogs(1);
    }
  }, [activeTab]);

  useEffect(() => {
    if (actionParam === 'create') {
      setSaveError('');
      setEditingItem({
        linkedWorkType: workTypeParam || ''
      });
      setFormMode('create');

      // Clear query params to prevent infinite loop or re-launch on page refresh
      const next = new URLSearchParams(searchParams);
      next.delete('action');
      next.delete('workType');
      setSearchParams(next, { replace: true });
    }
  }, [actionParam, workTypeParam, searchParams, setSearchParams]);

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
      // Load all items
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

  // Client-side sorting
  const sortedItems = useMemo(() => {
    const sorted = [...filteredItems];
    if (sortState.key) {
      sorted.sort((a, b) => {
        let valA = a[sortState.key];
        let valB = b[sortState.key];
        
        if (sortState.key === 'updatedAt' || sortState.key === 'createdAt' || sortState.key === 'reviewDueAt') {
          valA = valA ? new Date(valA).getTime() : 0;
          valB = valB ? new Date(valB).getTime() : 0;
        } else {
          valA = String(valA || '').toLowerCase();
          valB = String(valB || '').toLowerCase();
        }
        
        if (valA < valB) return sortState.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortState.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sorted;
  }, [filteredItems, sortState]);

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
      if (activeTab === 'audit') {
        void loadAuditLogs(1);
      }
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
      if (activeTab === 'audit') {
        void loadAuditLogs(1);
      }
    } catch (archiveErr) {
      setStatusMessage(`Archive failed: ${archiveErr?.message || 'Please try again.'}`);
    }
  };

  const columns = [
    { key: 'title', label: 'Knowledge Item', sortable: true },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'links', label: 'Links', sortable: false },
    { key: 'reviewDueAt', label: 'Review Due', sortable: true },
    { key: 'updatedAt', label: 'Updated', sortable: true },
    { key: 'actions', label: 'Actions', sortable: false }
  ];

  const tableRows = sortedItems.map((item) => {
    const itemId = item._id || item.id;
    const tags = toArray(item.tags);
    const summaryPreview = item.summary ? (item.summary.length > 80 ? `${item.summary.slice(0, 80)}…` : item.summary) : null;
    const hasLinks = item.linkedWorkType || item.linkedClientId || item.linkedDocketId;
    const stepCount = Array.isArray(item.checklistSteps) ? item.checklistSteps.length : 0;

    return (
      <tr key={itemId}>
        {/* Knowledge item cell */}
        <td style={{ maxWidth: '260px' }}>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.3, color: '#1a1916' }}>{item.title || '—'}</div>
          {summaryPreview ? (
            <div style={{ fontSize: '0.78rem', color: '#7a7870', marginTop: '0.2rem' }}>{summaryPreview}</div>
          ) : null}
          {tags.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.3rem' }}>
              {tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  style={{
                    background: '#f3f2ef',
                    color: '#3d3c38',
                    borderRadius: '4px',
                    padding: '0.1em 0.5em',
                    fontSize: '0.7rem',
                    fontWeight: 500,
                  }}
                >
                  {tag}
                </span>
              ))}
              {tags.length > 4 ? (
                <span style={{ fontSize: '0.7rem', color: '#b0aea8' }}>+{tags.length - 4}</span>
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
              background: '#f3f2ef',
              color: '#3d3c38',
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
                <span style={{ color: '#2563eb', fontWeight: 500 }}>⚙ {formatLabel(item.linkedWorkType)}</span>
              ) : null}
              {item.linkedClientId ? (
                <span style={{ color: '#059669', fontWeight: 500 }}>👤 {item.linkedClientId}</span>
              ) : null}
              {item.linkedDocketId ? (
                <span style={{ color: '#4f46e5', fontWeight: 500 }}>📁 {item.linkedDocketId}</span>
              ) : null}
            </div>
          ) : (
            <span style={{ color: '#b0aea8', fontStyle: 'italic' }}>Unlinked</span>
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
              style={{ fontSize: '0.8rem', padding: '3px 8px' }}
            >
              View
            </button>
            {item.status !== 'archived' ? (
              <>
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  aria-label={`Edit ${item.title}`}
                  style={{ fontSize: '0.8rem', padding: '3px 8px' }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void handleArchive(item)}
                  aria-label={`Archive ${item.title}`}
                  style={{ fontSize: '0.8rem', padding: '3px 8px', color: '#ef4444', borderColor: '#fee2e2' }}
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
          <button type="button" className="action-primary" onClick={openCreate} disabled={loading} style={{ height: '36px' }}>
            New Knowledge Item
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'directory') void loadData({ background: true });
              else void loadAuditLogs(1);
            }}
            disabled={loading || refreshing || auditLoading}
            style={{ height: '36px' }}
          >
            {refreshing || auditLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      )}
    >
      <style>{`
        .hover-card:hover {
          transform: translateY(-2.5px);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.05) !important;
          border-color: #ddd9d0 !important;
        }
        .form-input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: 0.85rem;
          border-radius: 6px;
          border: 1px solid #e8e6e0;
          background: #fafaf8;
          color: #1a1916;
          outline: none;
          transition: all 0.15s ease;
        }
        .form-input:focus {
          border-color: #2563eb !important;
          background: #ffffff !important;
          box-shadow: 0 0 0 2.5px rgba(37, 99, 235, 0.12) !important;
        }
        .tab-btn:hover {
          color: #2563eb !important;
          background: #eff5ff !important;
        }
        .timeline-item {
          position: relative;
          padding-left: 2rem;
          padding-bottom: 1.25rem;
        }
        .timeline-item::before {
          content: '';
          position: absolute;
          left: 9px;
          top: 20px;
          bottom: 0;
          width: 2px;
          background: #e8e6e0;
        }
        .timeline-item:last-child::before {
          display: none;
        }
        .timeline-dot {
          position: absolute;
          left: 0;
          top: 1px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          z-index: 2;
        }
      `}</style>

      <StatusMessageStack
        messages={[
          { tone: 'error', message: error },
          { tone: 'success', message: statusMessage },
          { tone: 'info', message: refreshing ? 'Refreshing Knowledge Library in the background…' : '' },
        ]}
      />

      {/* Reworked Premium Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
        gap: '0.75rem',
        marginBottom: '1rem'
      }}>
        {[
          { label: 'Total Records', value: totalCount, icon: '📂', accent: '#4f46e5' },
          { label: 'Active SOPs', value: activeCount, icon: '✅', accent: '#10b981' },
          { label: 'Drafts', value: draftCount, icon: '📝', accent: '#f59e0b' },
          { label: 'Review Due', value: reviewDueCount, icon: '⚠️', accent: '#ef4444', color: reviewDueCount > 0 ? '#ef4444' : '#1a1916' },
          { label: 'Checklists', value: checklistCount, icon: '📋', accent: '#8b5cf6' },
          { label: 'Unlinked', value: unlinkedCount, icon: '🔗', accent: '#ec4899' },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: '#ffffff',
              border: '1px solid #e8e6e0',
              borderTop: `3.5px solid ${stat.accent}`,
              borderRadius: '8px',
              padding: '1rem 1.1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.15rem',
              boxShadow: '0 1px 2.5px rgba(0,0,0,0.015)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            className="hover-card"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10.5px', color: '#7a7870', fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{stat.label}</span>
              <span style={{ fontSize: '1.05rem' }}>{stat.icon}</span>
            </div>
            <span style={{ fontSize: '1.55rem', fontWeight: 800, color: stat.color || '#1a1916', marginTop: '0.25rem' }}>
              {loading ? '…' : stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Tabs Control */}
      <div style={{
        display: 'flex',
        gap: '0.25rem',
        borderBottom: '1px solid #e8e6e0',
        marginBottom: '1rem',
        background: '#ffffff',
        borderRadius: '8px',
        padding: '3px 4px 0px',
        border: '1px solid #e8e6e0'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('directory')}
          style={{
            background: activeTab === 'directory' ? '#eff5ff' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'directory' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'directory' ? '#2563eb' : '#7a7870',
            fontWeight: activeTab === 'directory' ? 650 : 500,
            padding: '0.5rem 1.2rem',
            cursor: 'pointer',
            borderRadius: '6px 6px 0 0',
            fontSize: '12.5px',
            transition: 'all 0.15s ease',
          }}
          className={activeTab !== 'directory' ? 'tab-btn' : ''}
        >
          📚 Knowledge Directory
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          style={{
            background: activeTab === 'audit' ? '#eff5ff' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'audit' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'audit' ? '#2563eb' : '#7a7870',
            fontWeight: activeTab === 'audit' ? 650 : 500,
            padding: '0.5rem 1.2rem',
            cursor: 'pointer',
            borderRadius: '6px 6px 0 0',
            fontSize: '12.5px',
            transition: 'all 0.15s ease',
          }}
          className={activeTab !== 'audit' ? 'tab-btn' : ''}
        >
          📜 Audit Trails
        </button>
      </div>

      {/* TAB A: KNOWLEDGE DIRECTORY */}
      {activeTab === 'directory' && (
        <PageSection
          title="Knowledge Items"
          description="Manage all firm SOPs, templates, checklists, and instruction records."
          actions={null}
        >
          <FilterBar
            onClear={hasActiveFilters ? clearFilters : undefined}
            clearDisabled={!hasActiveFilters}
          >
            <input
              type="search"
              placeholder="Search by title, summary, type…"
              value={searchQ}
              onChange={(event) => setSearchQ(event.target.value)}
              aria-label="Search knowledge items"
              className="form-input"
              style={{ minWidth: '220px', height: '34px' }}
            />
            <select
              value={filterType}
              onChange={(event) => setFilterType(event.target.value)}
              aria-label="Filter by type"
              className="form-input"
              style={{ minWidth: '125px', height: '34px' }}
            >
              <option value="">All Types</option>
              {ITEM_TYPES.map((t) => (
                <option key={t} value={t}>{formatLabel(t)}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
              aria-label="Filter by status"
              className="form-input"
              style={{ minWidth: '125px', height: '34px' }}
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
            <select
              value={filterWorkType}
              onChange={(event) => setFilterWorkType(event.target.value)}
              aria-label="Filter by category"
              className="form-input"
              style={{ minWidth: '160px', height: '34px' }}
            >
              <option value="">All Categories</option>
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
              className="form-input"
              style={{ minWidth: '130px', height: '34px' }}
            />
          </FilterBar>

          <DataTable
            columns={columns}
            rows={tableRows}
            loading={loading}
            loadingLabel="Loading knowledge items…"
            emptyLabel="Your Knowledge Library is empty. Add your first SOP, checklist, or template."
            emptyLabelFiltered="No knowledge items match these filters. Clear filters or adjust your search."
            hasActiveFilters={hasActiveFilters}
            error={error}
            onRetry={() => void loadData()}
            retryLabel="Retry"
            pageSize={15}
            paginationLabel="Knowledge items pagination"
            sortState={sortState}
            onSortChange={setSortState}
          />
        </PageSection>
      )}

      {/* TAB B: AUDIT TRAILS */}
      {activeTab === 'audit' && (
        <PageSection
          title="Audit Trail Logs"
          description="Detailed chronological log of modifications, creation, and archiving operations."
        >
          {auditLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <span style={{ fontSize: '0.9rem', color: '#7a7870' }}>Loading audit trail logs…</span>
            </div>
          ) : auditError ? (
            <p className="inline-notice inline-notice--error" role="alert">{auditError}</p>
          ) : auditLogs.length === 0 ? (
            <div style={{
              background: '#ffffff',
              border: '1px solid #e8e6e0',
              borderRadius: '8px',
              padding: '3rem',
              textAlign: 'center',
              color: '#7a7870'
            }}>
              📂 No audit events recorded for Knowledge Items.
            </div>
          ) : (
            <div style={{ background: '#ffffff', border: '1px solid #e8e6e0', borderRadius: '8px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {auditLogs.map((entry) => {
                  let dotColor = '#3b82f6';
                  let dotBg = '#eff5ff';
                  let dotChar = '✏️';

                  if (entry.action === 'KNOWLEDGE_ITEM_CREATED') {
                    dotColor = '#10b981';
                    dotBg = '#d1fae5';
                    dotChar = '＋';
                  } else if (entry.action === 'KNOWLEDGE_ITEM_ARCHIVED') {
                    dotColor = '#ef4444';
                    dotBg = '#fee2e2';
                    dotChar = '📥';
                  }

                  return (
                    <div key={entry._id} className="timeline-item">
                      <div
                        className="timeline-dot"
                        style={{
                          background: dotBg,
                          color: dotColor,
                          border: `1.5px solid ${dotColor}`,
                        }}
                      >
                        {dotChar}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 650, color: '#1a1916' }}>
                            {entry.summary || 'Knowledge item action'}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: '#7a7870' }}>
                            {formatDateTime(entry.createdAt)}
                          </span>
                        </div>
                        {entry.metadata ? (
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>
                            {entry.metadata.title && (
                              <span style={{ fontSize: '0.75rem', background: '#fafaf8', border: '1px solid #e8e6e0', padding: '1px 6px', borderRadius: '4px', color: '#3d3c38' }}>
                                Item: {entry.metadata.title}
                              </span>
                            )}
                            {entry.metadata.type && (
                              <span style={{ fontSize: '0.75rem', background: '#fafaf8', border: '1px solid #e8e6e0', padding: '1px 6px', borderRadius: '4px', color: '#3d3c38' }}>
                                Type: {formatLabel(entry.metadata.type)}
                              </span>
                            )}
                            <span style={{
                              fontSize: '10px',
                              textTransform: 'uppercase',
                              fontWeight: 700,
                              background: entry.severity === 'medium' ? '#fffbeb' : '#fafaf8',
                              color: entry.severity === 'medium' ? '#b45309' : '#7a7870',
                              border: entry.severity === 'medium' ? '1px solid #fde68a' : '1px solid #e8e6e0',
                              padding: '1px 6px',
                              borderRadius: '4px'
                            }}>
                              Severity: {entry.severity || 'low'}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Audit Trail Pagination */}
              {auditTotalPages > 1 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '1.25rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid #e8e6e0'
                }}>
                  <span style={{ fontSize: '0.78rem', color: '#7a7870' }}>
                    Showing page {auditPage} of {auditTotalPages} · {auditTotal} logs
                  </span>
                  <div className="action-row" style={{ gap: '0.5rem' }}>
                    <button
                      type="button"
                      disabled={auditPage <= 1}
                      onClick={() => void loadAuditLogs(auditPage - 1)}
                      style={{ height: '30px', padding: '2px 10px', fontSize: '0.78rem' }}
                    >
                      ← Previous
                    </button>
                    <button
                      type="button"
                      disabled={auditPage >= auditTotalPages}
                      onClick={() => void loadAuditLogs(auditPage + 1)}
                      style={{ height: '30px', padding: '2px 10px', fontSize: '0.78rem' }}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </PageSection>
      )}

      {/* Premium Form Slide-over Panel (React Overlay Pattern) */}
      {formMode ? (
        <>
          <div
            onClick={closeForm}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(26,25,22,0.35)',
              zIndex: 199,
              backdropFilter: 'blur(1.5px)',
              animation: 'fadeIn 0.18s ease-out',
            }}
          />
          <aside
            aria-label={formMode === 'create' ? 'New Knowledge Item' : 'Edit Knowledge Item'}
            role="dialog"
            style={{ ...DRAWER_ASIDE_STYLE }}
          >
            {/* Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #e8e6e0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              background: '#ffffff'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1a1916' }}>
                {formMode === 'create' ? '📋 New Knowledge Item' : '✏️ Edit Knowledge Item'}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                aria-label="Close form panel"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#b0aea8' }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto', background: '#f7f7f5' }}>
              <KnowledgeItemForm
                initial={editingItem || {}}
                onSave={handleSave}
                onCancel={closeForm}
                saving={saving}
                saveError={saveError}
              />
            </div>
          </aside>
        </>
      ) : null}

      {/* Premium Detail Drawer Slide-over Panel (React Overlay Pattern) */}
      {drawerOpen ? (
        <>
          <div
            onClick={closeDrawer}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(26,25,22,0.35)',
              zIndex: 199,
              backdropFilter: 'blur(1.5px)',
              animation: 'fadeIn 0.18s ease-out',
            }}
          />
          {drawerLoading ? (
            <aside
              aria-label="Knowledge Item Detail"
              role="complementary"
              style={{ ...DRAWER_ASIDE_STYLE, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
            >
              <p style={{ fontSize: '0.85rem', color: '#7a7870' }}>Loading knowledge item…</p>
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
                <button type="button" onClick={closeDrawer} aria-label="Close detail drawer" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#b0aea8' }}>✕</button>
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
          )}
        </>
      ) : null}
    </PlatformShell>
  );
};

export default KnowledgeLibraryPage;
