import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { crmApi } from '../../api/crm.api';
import { adminApi } from '../../api/admin.api';
import { ROUTES, safeRoute } from '../../constants/routes';
import { formatDate } from '../../utils/formatters';
import {
  DataTable,
  FilterBar,
  InlineNotice,
  PageSection,
  RefreshNotice,
  StatGrid,
} from '../platform/PlatformShared';
import { resolveCrmErrorMessage } from './crmUiUtils';

const LEAD_STAGE_MAP = { new: 'Draft', contacted: 'Pending', qualified: 'Pending', converted: 'Approved', lost: 'Rejected' };
const LEAD_STAGE_LABEL = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', converted: 'Converted', lost: 'Lost' };
const STAGES = ['new', 'contacted', 'qualified', 'converted', 'lost'];

const toDateInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const isOverdue = (lead) => {
  if (!lead?.nextFollowUpAt) return false;
  const stage = lead?.stage || lead?.status;
  if (stage === 'converted' || stage === 'lost') return false;
  return new Date(lead.nextFollowUpAt).getTime() < Date.now();
};

export const LeadsPage = () => {
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();

  const normalizedRole = String(user?.role || '').trim().toUpperCase();
  const isAdmin = normalizedRole === 'ADMIN' || normalizedRole === 'PRIMARY_ADMIN' || Boolean(user?.isPrimaryAdmin);

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [viewMode, setViewMode] = useState('list');
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [filters, setFilters] = useState({ stage: '', ownerXid: '', dueOnly: false });
  const [form, setForm] = useState({ name: '', email: '', phone: '', source: 'manual', ownerXid: '', nextFollowUpAt: '' });
  const [formErrors, setFormErrors] = useState({});
  const [detailForm, setDetailForm] = useState({ stage: 'new', ownerXid: '', nextFollowUpAt: '', lastContactAt: '', lostReason: '', note: '' });

  const loadLeads = useCallback(async ({ background = false } = {}) => {
    if (background) setRefreshing(true);
    else setInitialLoading(true);
    setError('');
    try {
      const response = await crmApi.listLeads({
        ...(filters.stage ? { stage: filters.stage } : {}),
        ...(filters.ownerXid ? { ownerXid: filters.ownerXid } : {}),
        ...(filters.dueOnly ? { dueOnly: true } : {}),
      });
      setLeads(Array.isArray(response?.data) ? response.data : []);
    } catch (loadError) {
      const message = resolveCrmErrorMessage(loadError, 'Unable to load leads right now.');
      setError(message);
      showError(message);
      setLeads([]);
    } finally {
      setRefreshing(false);
      setInitialLoading(false);
    }
  }, [filters.dueOnly, filters.ownerXid, filters.stage, showError]);

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const response = await adminApi.getUsers();
      setUsers(Array.isArray(response?.data) ? response.data : []);
    } catch {
      setUsers([]);
    }
  }, [isAdmin]);

  useEffect(() => { void loadLeads(); }, [loadLeads]);
  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const openModal = () => {
    setForm({ name: '', email: '', phone: '', source: 'manual', ownerXid: '', nextFollowUpAt: '' });
    setFormErrors({});
    setShowModal(true);
  };

  const openDetail = (lead) => {
    setSelectedLead(lead);
    setDetailForm({
      stage: lead.stage || lead.status || 'new',
      ownerXid: lead.ownerXid || '',
      nextFollowUpAt: toDateInputValue(lead.nextFollowUpAt),
      lastContactAt: toDateInputValue(lead.lastContactAt),
      lostReason: lead.lostReason || '',
      note: '',
    });
    setShowDetail(true);
  };

  const patchLeadInState = useCallback((leadId, update) => {
    let patchedLead = null;
    setLeads((current) => current.map((lead) => {
      const id = lead._id || lead.id;
      if (id !== leadId) return lead;
      const nextLead = typeof update === 'function' ? update(lead) : update;
      patchedLead = { ...lead, ...nextLead };
      return patchedLead;
    }));
    if (patchedLead && (selectedLead?._id || selectedLead?.id) === leadId) {
      setSelectedLead(patchedLead);
    }
    return patchedLead;
  }, [selectedLead]);

  const leadMatchesFilters = useCallback((lead) => {
    if (!lead) return false;
    const stage = lead.stage || lead.status;
    if (filters.stage && stage !== filters.stage) return false;
    if (filters.ownerXid && String(lead.ownerXid || '').toUpperCase() !== String(filters.ownerXid || '').toUpperCase()) return false;
    if (filters.dueOnly && !isOverdue(lead)) return false;
    return true;
  }, [filters.dueOnly, filters.ownerXid, filters.stage]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Lead name is required.';
    if (!form.email.trim() && !form.phone.trim()) nextErrors.contact = 'Add at least one contact method (email or phone).';
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      const response = await crmApi.createLead({
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        source: form.source || 'manual',
        ownerXid: form.ownerXid || undefined,
        nextFollowUpAt: form.nextFollowUpAt ? new Date(`${form.nextFollowUpAt}T00:00:00.000Z`).toISOString() : undefined,
      });
      showSuccess('Lead created successfully.');
      const createdLead = response?.data;
      if (leadMatchesFilters(createdLead)) setLeads((current) => [createdLead, ...current]);
      setShowModal(false);
    } catch (createError) {
      showError(resolveCrmErrorMessage(createError, 'Failed to create lead. Please review the form and try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStageUpdate = async (leadId, stage) => {
    setUpdatingId(leadId);
    const previousLead = leads.find((lead) => (lead._id || lead.id) === leadId) || null;
    const previousStage = previousLead?.stage || previousLead?.status || 'new';
    if (previousLead) patchLeadInState(leadId, { stage, status: stage });

    try {
      if (stage === 'converted') {
        const converted = await crmApi.convertLead(leadId);
        const convertedLead = converted?.data?.lead;
        if (convertedLead) patchLeadInState(leadId, convertedLead);
      } else {
        const updated = await crmApi.updateLead(leadId, { stage });
        if (updated?.data) patchLeadInState(leadId, updated.data);
      }
      showSuccess(`Lead updated to ${LEAD_STAGE_LABEL[stage] || stage}.`);
    } catch (updateError) {
      if (previousLead) patchLeadInState(leadId, { ...previousLead, stage: previousStage, status: previousStage });
      showError(resolveCrmErrorMessage(updateError, 'Failed to update lead.'));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveDetail = async () => {
    if (!selectedLead?._id) return;
    if (saving) return;
    setSaving(true);
    try {
      let convertedLeadPayload = null;
      if (detailForm.stage === 'converted' && (selectedLead.stage || selectedLead.status) !== 'converted') {
        const converted = await crmApi.convertLead(selectedLead._id);
        convertedLeadPayload = converted?.data?.lead || null;
        if (converted?.data?.legacyCrmClientId) {
          showSuccess('Lead converted. You can open client workspace from this lead now.');
        }
      }
      const payload = {
        ...(detailForm.stage !== 'converted' ? { stage: detailForm.stage } : {}),
        ownerXid: detailForm.ownerXid || null,
        nextFollowUpAt: detailForm.nextFollowUpAt ? new Date(`${detailForm.nextFollowUpAt}T00:00:00.000Z`).toISOString() : null,
        lastContactAt: detailForm.lastContactAt ? new Date(`${detailForm.lastContactAt}T00:00:00.000Z`).toISOString() : null,
        lostReason: detailForm.stage === 'lost' ? (detailForm.lostReason || null) : null,
        note: detailForm.note.trim() || undefined,
      };
      const response = await crmApi.updateLead(selectedLead._id, payload);
      const nextLead = response?.data || convertedLeadPayload;
      if (nextLead) patchLeadInState(selectedLead._id, nextLead);
      showSuccess('Lead details updated successfully.');
      setDetailForm((prev) => ({ ...prev, note: '' }));
    } catch (saveError) {
      showError(resolveCrmErrorMessage(saveError, 'Failed to update lead details.'));
    } finally {
      setSaving(false);
    }
  };

  const stageStats = useMemo(() => STAGES.reduce((acc, stage) => {
    acc[stage] = leads.filter((lead) => (lead.stage || lead.status) === stage).length;
    return acc;
  }, {}), [leads]);

  const leadsByStage = useMemo(() => STAGES.reduce((acc, stage) => {
    acc[stage] = leads.filter((lead) => (lead.stage || lead.status) === stage);
    return acc;
  }, {}), [leads]);

  const tableRows = leads.map((lead) => {
    const id = lead._id || lead.id;
    const stage = lead.stage || lead.status;
    const isUpdating = updatingId === id;
    return (
      <tr key={id}>
        <td>
          <div className="font-medium">{lead.name || '—'}</div>
          <div className="text-xs text-gray-500">{lead.email || lead.phone || 'No contact info'}</div>
        </td>
        <td>
          <div className="flex items-center gap-2">
            <Badge status={LEAD_STAGE_MAP[stage] || 'Draft'}>{LEAD_STAGE_LABEL[stage] || stage || '—'}</Badge>
            {isOverdue(lead) ? <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Overdue follow-up</span> : null}
          </div>
        </td>
        <td>{lead.owner?.name || lead.ownerXid || 'Unassigned'}</td>
        <td>{formatDate(lead.nextFollowUpAt) || '—'}</td>
        <td>
          <div className="action-row">
            {isAdmin && stage !== 'converted' ? (
              <select value={stage} onChange={(event) => handleQuickStageUpdate(id, event.target.value)} disabled={isUpdating} className="rounded border border-gray-300 px-2 py-1 text-xs">
                {STAGES.map((option) => <option key={option} value={option}>{LEAD_STAGE_LABEL[option]}</option>)}
              </select>
            ) : null}
            <Button variant="outline" onClick={() => openDetail(lead)}>Manage</Button>
          </div>
        </td>
      </tr>
    );
  });

  return (
    <PlatformShell moduleLabel="CRM" title="Leads" subtitle="Track pipeline stages, follow-up commitments, and conversion readiness.">
      <InlineNotice tone="error" message={error} />
      <RefreshNotice refreshing={refreshing} message="Refreshing leads in the background…" />

      <PageSection title="Quick actions" description="Keep terminology and controls aligned with CRM overview and client management.">
        <div className="action-row">
          {isAdmin ? <Button onClick={openModal}>New Lead</Button> : null}
          <Button variant="outline" onClick={() => setViewMode('list')}>List View</Button>
          <Button variant="outline" onClick={() => setViewMode('pipeline')}>Pipeline View</Button>
        </div>
      </PageSection>

      <StatGrid items={STAGES.map((stage) => ({ label: LEAD_STAGE_LABEL[stage], value: stageStats[stage] || 0 }))} />

      <PageSection title="Filters" description="Filter by stage, owner, and overdue follow-up status.">
        <FilterBar>
          <div>
            <label className="block text-xs text-gray-600" htmlFor="lead-filter-stage">Stage</label>
            <select id="lead-filter-stage" value={filters.stage} onChange={(event) => setFilters((prev) => ({ ...prev, stage: event.target.value }))} className="mt-1 w-full rounded border border-gray-300 px-2 py-2 text-sm">
              <option value="">All stages</option>
              {STAGES.map((stage) => <option key={stage} value={stage}>{LEAD_STAGE_LABEL[stage]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600" htmlFor="lead-filter-owner">Owner</label>
            <select id="lead-filter-owner" value={filters.ownerXid} onChange={(event) => setFilters((prev) => ({ ...prev, ownerXid: event.target.value }))} className="mt-1 w-full rounded border border-gray-300 px-2 py-2 text-sm">
              <option value="">All owners</option>
              {users.map((item) => {
                const xid = item.xid || item.xID;
                return <option key={xid} value={xid}>{item.name} ({xid})</option>;
              })}
            </select>
          </div>
          <label className="mt-6 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={filters.dueOnly} onChange={(event) => setFilters((prev) => ({ ...prev, dueOnly: event.target.checked }))} />
            Follow-up overdue only
          </label>
          <Button variant="outline" onClick={() => void loadLeads({ background: leads.length > 0 })} loading={refreshing} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Apply Filters'}
          </Button>
        </FilterBar>
      </PageSection>

      <PageSection title={viewMode === 'pipeline' ? 'Pipeline board' : 'Lead queue'} description="Operational lead tracking surface.">
        {viewMode === 'pipeline' ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {STAGES.map((stage) => (
              <div key={stage} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">{LEAD_STAGE_LABEL[stage]}</p>
                  <span className="rounded border border-gray-200 bg-white px-2 py-0.5 text-xs">{leadsByStage[stage]?.length || 0}</span>
                </div>
                <div className="space-y-2">
                  {(leadsByStage[stage] || []).length ? leadsByStage[stage].map((lead) => (
                    <button key={lead._id || lead.id} type="button" onClick={() => openDetail(lead)} className="w-full rounded border border-gray-200 bg-white p-2 text-left text-xs hover:border-gray-300">
                      <p className="font-semibold text-sm">{lead.name || '—'}</p>
                      <p className="text-gray-600">Owner: {lead.owner?.name || lead.ownerXid || 'Unassigned'}</p>
                      <p className="text-gray-600">Follow-up: {lead.nextFollowUpAt ? formatDate(lead.nextFollowUpAt) : 'Not set'}</p>
                    </button>
                  )) : <p className="rounded border border-dashed border-gray-300 bg-white p-2 text-xs text-gray-500">No leads in this stage</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <DataTable
            columns={['Lead', 'Stage', 'Owner', 'Next Follow-up', 'Actions']}
            rows={tableRows}
            loading={initialLoading}
            error={error}
            onRetry={() => void loadLeads()}
            emptyLabel="No leads yet. Use New Lead to start your pipeline."
            hasActiveFilters={Boolean(filters.stage || filters.ownerXid || filters.dueOnly)}
            emptyLabelFiltered="No leads match current filters."
          />
        )}
      </PageSection>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Lead" maxWidth="lg">
        <form onSubmit={handleSubmit} className="grid gap-4">
          <Input label="Name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required error={formErrors.name} />
          <Input label="Email" type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} error={formErrors.contact && form.phone.trim() ? '' : formErrors.contact} />
          <Input label="Phone" value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} error={formErrors.contact && form.email.trim() ? '' : formErrors.contact} />
          <Input label="Source" value={form.source} onChange={(event) => setForm((prev) => ({ ...prev, source: event.target.value }))} />
          {isAdmin ? (
            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="lead-owner">Owner</label>
              <select id="lead-owner" value={form.ownerXid} onChange={(event) => setForm((prev) => ({ ...prev, ownerXid: event.target.value }))} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm">
                <option value="">Unassigned</option>
                {users.map((item) => {
                  const xid = item.xid || item.xID;
                  return <option key={xid} value={xid}>{item.name} ({xid})</option>;
                })}
              </select>
            </div>
          ) : null}
          <Input label="Next Follow-up" type="date" value={form.nextFollowUpAt} onChange={(event) => setForm((prev) => ({ ...prev, nextFollowUpAt: event.target.value }))} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving} disabled={saving}>Create Lead</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title={`Manage Lead${selectedLead?.name ? `: ${selectedLead.name}` : ''}`} maxWidth="lg">
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="detail-stage">Stage</label>
            <select id="detail-stage" value={detailForm.stage} onChange={(event) => setDetailForm((prev) => ({ ...prev, stage: event.target.value }))} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm">
              {STAGES.map((option) => <option key={option} value={option}>{LEAD_STAGE_LABEL[option]}</option>)}
            </select>
          </div>
          {isAdmin ? (
            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="detail-owner">Owner</label>
              <select id="detail-owner" value={detailForm.ownerXid} onChange={(event) => setDetailForm((prev) => ({ ...prev, ownerXid: event.target.value }))} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm">
                <option value="">Unassigned</option>
                {users.map((item) => {
                  const xid = item.xid || item.xID;
                  return <option key={xid} value={xid}>{item.name} ({xid})</option>;
                })}
              </select>
            </div>
          ) : null}
          <Input label="Next Follow-up" type="date" value={detailForm.nextFollowUpAt} onChange={(event) => setDetailForm((prev) => ({ ...prev, nextFollowUpAt: event.target.value }))} />
          <Input label="Last Contact" type="date" value={detailForm.lastContactAt} onChange={(event) => setDetailForm((prev) => ({ ...prev, lastContactAt: event.target.value }))} />
          {detailForm.stage === 'lost' ? <Input label="Lost Reason" value={detailForm.lostReason} onChange={(event) => setDetailForm((prev) => ({ ...prev, lostReason: event.target.value }))} /> : null}
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="detail-note">Add Note</label>
            <textarea id="detail-note" value={detailForm.note} onChange={(event) => setDetailForm((prev) => ({ ...prev, note: event.target.value }))} rows={3} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" placeholder="Capture qualification context" />
          </div>
          <div className="rounded bg-gray-50 p-3">
            <p className="mb-2 text-xs font-semibold text-gray-700">Recent Activity</p>
            {Array.isArray(selectedLead?.activitySummary) && selectedLead.activitySummary.length > 0 ? (
              <ul className="space-y-1 text-xs text-gray-600">
                {selectedLead.activitySummary.slice(-5).reverse().map((item, idx) => (
                  <li key={`${item.createdAt || idx}-${item.message}`}>{formatDate(item.createdAt)} · {item.message}</li>
                ))}
              </ul>
            ) : <p className="text-xs text-gray-500">No activity yet.</p>}
          </div>
          <div className="flex justify-end gap-2">
            {selectedLead?.linkedClientId ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(safeRoute(ROUTES.CRM_CLIENT_DETAIL(firmSlug, selectedLead.linkedClientId)))}
              >
                Open Client Workspace
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => setShowDetail(false)}>Cancel</Button>
            <Button type="button" onClick={handleSaveDetail} loading={saving} disabled={saving}>Save Changes</Button>
          </div>
        </div>
      </Modal>
    </PlatformShell>
  );
};
