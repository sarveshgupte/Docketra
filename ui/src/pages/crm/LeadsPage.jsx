import React, { useCallback, useEffect, useState } from 'react';
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
import { formatDate } from '../../utils/formatters';

const LEAD_STATUS_MAP = { new: 'Pending', contacted: 'Pending', converted: 'Approved' };
const LEAD_STATUS_LABEL = { new: 'New', contacted: 'Contacted', converted: 'Converted' };

export const LeadsPage = () => {
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();

  const normalizedRole = String(user?.role || '').trim().toUpperCase();
  const isAdmin = normalizedRole === 'ADMIN' || normalizedRole === 'PRIMARY_ADMIN' || Boolean(user?.isPrimaryAdmin);

  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    source: 'manual',
  });

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const response = await crmApi.listLeads();
      setLeads(Array.isArray(response?.data) ? response.data : []);
    } catch (error) {
      showError(error?.message || 'Failed to load leads');
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const openModal = () => {
    setForm({ name: '', email: '', phone: '', source: 'manual' });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setForm({ name: '', email: '', phone: '', source: 'manual' });
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

  const handleUpdateStatus = async (leadId, newStatus) => {
    setUpdatingId(leadId);
    try {
      await crmApi.updateLeadStatus(leadId, newStatus);
      showSuccess(`Lead status updated to ${LEAD_STATUS_LABEL[newStatus] || newStatus}`);
      loadLeads();
    } catch (error) {
      showError(error?.message || 'Failed to update lead status');
    } finally {
      setUpdatingId(null);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (lead) => <span className="font-medium">{lead.name || '—'}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (lead) => lead.email || '—',
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (lead) => lead.phone || '—',
    },
    {
      key: 'source',
      header: 'Source',
      render: (lead) => lead.source || '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (lead) => (
        <Badge status={LEAD_STATUS_MAP[lead.status] || 'Draft'}>
          {LEAD_STATUS_LABEL[lead.status] || lead.status || '—'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (lead) => formatDate(lead.createdAt),
    },
    ...(isAdmin
      ? [
          {
            key: 'actions',
            header: 'Actions',
            render: (lead) => {
              const id = lead._id || lead.id;
              const isUpdating = updatingId === id;
              if (lead.status === 'new') {
                return (
                  <Button
                    variant="outline"
                    onClick={() => handleUpdateStatus(id, 'contacted')}
                    disabled={isUpdating}
                  >
                    {isUpdating ? 'Updating…' : 'Mark Contacted'}
                  </Button>
                );
              }
              if (lead.status === 'contacted') {
                return (
                  <Button
                    variant="outline"
                    onClick={() => handleUpdateStatus(id, 'converted')}
                    disabled={isUpdating}
                  >
                    {isUpdating ? 'Converting…' : 'Convert to CRM Client'}
                  </Button>
                );
              }
              return null;
            },
          },
        ]
      : []),
  ];

  return (
    <Layout>
      <PageHeader
        title="Leads"
        description="Manage your lead pipeline from first contact to conversion."
        actions={isAdmin ? (
          <Button onClick={openModal}>+ Add Lead</Button>
        ) : null}
      />
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

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title="Add New Lead"
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
          />
          <Input
            label="Source"
            value={form.source}
            onChange={(e) => setForm((prev) => ({ ...prev, source: e.target.value }))}
            placeholder="e.g. manual, referral, website"
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Lead'}</Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
};
