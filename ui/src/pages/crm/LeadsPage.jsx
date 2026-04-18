import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Layout } from '../../components/common/Layout';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Loading } from '../../components/common/Loading';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { PageHeader } from '../../components/layout/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { crmApi } from '../../api/crm.api';
import { adminApi } from '../../api/admin.api';
import { formatDate } from '../../utils/formatters';

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
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();

  const normalizedRole = String(user?.role || '').trim().toUpperCase();
  const isAdmin = normalizedRole === 'ADMIN' || normalizedRole === 'PRIMARY_ADMIN' || Boolean(user?.isPrimaryAdmin);

  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [filters, setFilters] = useState({ stage: '', ownerXid: '', dueOnly: false });
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    source: 'manual',
    ownerXid: '',
    nextFollowUpAt: '',
  });
  const [detailForm, setDetailForm] = useState({
    stage: 'new',
    ownerXid: '',
    nextFollowUpAt: '',
    lastContactAt: '',
    lostReason: '',
    note: '',
  });

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const response = await crmApi.listLeads({
        ...(filters.stage ? { stage: filters.stage } : {}),
        ...(filters.ownerXid ? { ownerXid: filters.ownerXid } : {}),
        ...(filters.dueOnly ? { dueOnly: true } : {}),
      });
      setLeads(Array.isArray(response?.data) ? response.data : []);
    } catch (error) {
      showError(error?.message || 'Failed to load leads');
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [filters.dueOnly, filters.ownerXid, filters.stage, showError]);

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const response = await adminApi.getUsers();
      setUsers(Array.isArray(response?.data) ? response.data : []);
    } catch (_error) {
      setUsers([]);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const openModal = () => {
    setForm({ name: '', email: '', phone: '', source: 'manual', ownerXid: '', nextFollowUpAt: '' });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setForm({ name: '', email: '', phone: '', source: 'manual', ownerXid: '', nextFollowUpAt: '' });
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

  const closeDetail = () => {
    setSelectedLead(null);
    setShowDetail(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await crmApi.createLead({
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        source: form.source || 'manual',
        ownerXid: form.ownerXid || undefined,
        nextFollowUpAt: form.nextFollowUpAt ? new Date(`${form.nextFollowUpAt}T00:00:00.000Z`).toISOString() : undefined,
      });
      showSuccess('Lead created successfully');
      closeModal();
      loadLeads();
    } catch (error) {
      showError(error?.message || 'Failed to create lead');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStageUpdate = async (leadId, stage) => {
    setUpdatingId(leadId);
    try {
      if (stage === 'converted') {
        await crmApi.convertLead(leadId);
      } else {
        await crmApi.updateLead(leadId, { stage });
      }
      showSuccess(`Lead updated to ${LEAD_STAGE_LABEL[stage] || stage}`);
      await loadLeads();
    } catch (error) {
      showError(error?.message || 'Failed to update lead');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveDetail = async () => {
    if (!selectedLead?._id) return;
    setSaving(true);
    try {
      if (detailForm.stage === 'converted' && (selectedLead.stage || selectedLead.status) !== 'converted') {
        await crmApi.convertLead(selectedLead._id);
      }
      const payload = {
        ...(detailForm.stage !== 'converted' ? { stage: detailForm.stage } : {}),
        ownerXid: detailForm.ownerXid || null,
        nextFollowUpAt: detailForm.nextFollowUpAt ? new Date(`${detailForm.nextFollowUpAt}T00:00:00.000Z`).toISOString() : null,
        lastContactAt: detailForm.lastContactAt ? new Date(`${detailForm.lastContactAt}T00:00:00.000Z`).toISOString() : null,
        lostReason: detailForm.stage === 'lost' ? (detailForm.lostReason || null) : null,
        note: detailForm.note.trim() || undefined,
      };
      await crmApi.updateLead(selectedLead._id, payload);
      showSuccess('Lead updated');
      closeDetail();
      loadLeads();
    } catch (error) {
      showError(error?.message || 'Failed to update lead');
    } finally {
      setSaving(false);
    }
  };

  const stageStats = useMemo(() => STAGES.reduce((acc, stage) => {
    acc[stage] = leads.filter((lead) => (lead.stage || lead.status) === stage).length;
    return acc;
  }, {}), [leads]);

  const columns = [
    {
      key: 'name',
      header: 'Lead',
      render: (lead) => (
        <div>
          <div className="font-medium">{lead.name || '—'}</div>
          <div className="text-xs text-gray-500">{lead.email || lead.phone || 'No contact info'}</div>
        </div>
      ),
    },
    {
      key: 'stage',
      header: 'Stage',
      render: (lead) => {
        const stage = lead.stage || lead.status;
        return (
          <div className="flex items-center gap-2">
            <Badge status={LEAD_STAGE_MAP[stage] || 'Draft'}>
              {LEAD_STAGE_LABEL[stage] || stage || '—'}
            </Badge>
            {isOverdue(lead) ? <span className="text-xs text-amber-700">Overdue follow-up</span> : null}
          </div>
        );
      },
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (lead) => lead.owner?.name || lead.ownerXid || 'Unassigned',
    },
    {
      key: 'followUp',
      header: 'Next Follow-up',
      render: (lead) => formatDate(lead.nextFollowUpAt) || '—',
    },
    {
      key: 'conversion',
      header: 'Conversion',
      render: (lead) => {
        if ((lead.stage || lead.status) !== 'converted') return 'Not converted';
        return (
          <div className="text-xs">
            <div className="font-medium">Converted to {lead.convertedClientId || 'client'}</div>
            <div className="text-gray-500">{lead.hasDownstreamWork ? 'Tasks/Dockets started' : 'No downstream work yet'}</div>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (lead) => {
        const id = lead._id || lead.id;
        const stage = lead.stage || lead.status;
        const isUpdating = updatingId === id;
        return (
          <div className="flex items-center gap-2">
            {isAdmin && stage !== 'converted' ? (
              <select
                value={stage}
                onChange={(e) => handleQuickStageUpdate(id, e.target.value)}
                disabled={isUpdating}
                className="border border-gray-200 rounded px-2 py-1 text-xs"
              >
                {STAGES.map((option) => <option key={option} value={option}>{LEAD_STAGE_LABEL[option]}</option>)}
              </select>
            ) : null}
            <Button variant="outline" onClick={() => openDetail(lead)}>Manage</Button>
          </div>
        );
      },
    },
  ];

  return (
    <Layout>
      <PageHeader
        title="Leads"
        description="Run your CRM pipeline from intake to conversion and downstream handoff."
        actions={isAdmin ? (
          <Button onClick={openModal}>+ Add Lead</Button>
        ) : null}
      />

      <div className="grid gap-3 md:grid-cols-5 mb-4">
        {STAGES.map((stage) => (
          <Card key={stage} className="p-3">
            <p className="text-xs text-gray-500">{LEAD_STAGE_LABEL[stage]}</p>
            <p className="text-xl font-semibold">{stageStats[stage] || 0}</p>
          </Card>
        ))}
      </div>

      <Card className="mb-4">
        <div className="grid gap-3 md:grid-cols-4 p-4">
          <div>
            <label className="text-xs text-gray-600">Filter by stage</label>
            <select
              value={filters.stage}
              onChange={(e) => setFilters((prev) => ({ ...prev, stage: e.target.value }))}
              className="w-full border border-gray-200 rounded px-2 py-2 text-sm"
            >
              <option value="">All stages</option>
              {STAGES.map((stage) => <option key={stage} value={stage}>{LEAD_STAGE_LABEL[stage]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600">Filter by owner</label>
            <select
              value={filters.ownerXid}
              onChange={(e) => setFilters((prev) => ({ ...prev, ownerXid: e.target.value }))}
              className="w-full border border-gray-200 rounded px-2 py-2 text-sm"
            >
              <option value="">All owners</option>
              {users.map((item) => {
                const xid = item.xid || item.xID;
                return <option key={xid} value={xid}>{item.name} ({xid})</option>;
              })}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 mt-6">
            <input
              type="checkbox"
              checked={filters.dueOnly}
              onChange={(e) => setFilters((prev) => ({ ...prev, dueOnly: e.target.checked }))}
            />
            Follow-up overdue only
          </label>
          <div className="flex items-end">
            <Button variant="outline" onClick={loadLeads}>Apply Filters</Button>
          </div>
        </div>
      </Card>

      <Card>
        {loading ? (
          <Loading message="Loading leads..." />
        ) : (
          <DataTable
            columns={columns}
            rows={leads}
            rowKey="_id"
            emptyMessage={(
              <div className="p-8">
                <EmptyState
                  title="No leads yet"
                  description="Add your first lead to start building your pipeline."
                />
              </div>
            )}
          />
        )}
      </Card>

      <Modal isOpen={showModal} onClose={closeModal} title="Add New Lead" maxWidth="lg">
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <Input label="Name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
          <Input label="Source" value={form.source} onChange={(e) => setForm((prev) => ({ ...prev, source: e.target.value }))} placeholder="e.g. manual, referral, website" />
          {isAdmin ? (
            <div>
              <label className="block text-sm font-medium text-gray-700">Owner</label>
              <select value={form.ownerXid} onChange={(e) => setForm((prev) => ({ ...prev, ownerXid: e.target.value }))} className="w-full border border-gray-200 rounded px-2 py-2 text-sm">
                <option value="">Unassigned</option>
                {users.map((item) => {
                  const xid = item.xid || item.xID;
                  return <option key={xid} value={xid}>{item.name} ({xid})</option>;
                })}
              </select>
            </div>
          ) : null}
          <Input label="Next Follow-up" type="date" value={form.nextFollowUpAt} onChange={(e) => setForm((prev) => ({ ...prev, nextFollowUpAt: e.target.value }))} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Lead'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showDetail} onClose={closeDetail} title={`Manage Lead${selectedLead?.name ? `: ${selectedLead.name}` : ''}`} maxWidth="lg">
        <div className="grid gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Stage</label>
            <select value={detailForm.stage} onChange={(e) => setDetailForm((prev) => ({ ...prev, stage: e.target.value }))} className="w-full border border-gray-200 rounded px-2 py-2 text-sm">
              {STAGES.map((option) => <option key={option} value={option}>{LEAD_STAGE_LABEL[option]}</option>)}
            </select>
          </div>
          {isAdmin ? (
            <div>
              <label className="block text-sm font-medium text-gray-700">Owner</label>
              <select value={detailForm.ownerXid} onChange={(e) => setDetailForm((prev) => ({ ...prev, ownerXid: e.target.value }))} className="w-full border border-gray-200 rounded px-2 py-2 text-sm">
                <option value="">Unassigned</option>
                {users.map((item) => {
                  const xid = item.xid || item.xID;
                  return <option key={xid} value={xid}>{item.name} ({xid})</option>;
                })}
              </select>
            </div>
          ) : null}
          <Input label="Next Follow-up" type="date" value={detailForm.nextFollowUpAt} onChange={(e) => setDetailForm((prev) => ({ ...prev, nextFollowUpAt: e.target.value }))} />
          <Input label="Last Contact" type="date" value={detailForm.lastContactAt} onChange={(e) => setDetailForm((prev) => ({ ...prev, lastContactAt: e.target.value }))} />
          {detailForm.stage === 'lost' ? <Input label="Lost Reason" value={detailForm.lostReason} onChange={(e) => setDetailForm((prev) => ({ ...prev, lostReason: e.target.value }))} /> : null}
          <div>
            <label className="block text-sm font-medium text-gray-700">Add Note</label>
            <textarea value={detailForm.note} onChange={(e) => setDetailForm((prev) => ({ ...prev, note: e.target.value }))} rows={3} className="w-full border border-gray-200 rounded px-2 py-2 text-sm" placeholder="Capture qualification or relationship context" />
          </div>

          <div className="rounded bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-700 mb-2">Recent Activity</p>
            {Array.isArray(selectedLead?.activitySummary) && selectedLead.activitySummary.length > 0 ? (
              <ul className="text-xs text-gray-600 space-y-1">
                {selectedLead.activitySummary.slice(-5).reverse().map((item, idx) => (
                  <li key={`${item.createdAt || idx}-${item.message}`}>{formatDate(item.createdAt)} · {item.message}</li>
                ))}
              </ul>
            ) : <p className="text-xs text-gray-500">No activity yet.</p>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button type="button" variant="outline" onClick={closeDetail}>Cancel</Button>
            <Button type="button" onClick={handleSaveDetail} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
};
