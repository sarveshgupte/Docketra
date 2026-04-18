import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { ROUTES, safeRoute } from '../../constants/routes';

const TYPE_LABELS = { individual: 'Individual', company: 'Company' };

export const CrmClientsPage = () => {
  const { firmSlug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();

  const normalizedRole = String(user?.role || '').trim().toUpperCase();
  const isAdmin = normalizedRole === 'ADMIN' || normalizedRole === 'PRIMARY_ADMIN' || Boolean(user?.isPrimaryAdmin);

  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'individual',
    email: '',
    phone: '',
    tags: '',
    leadSource: '',
    notes: '',
  });

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const response = await crmApi.listClients();
      const data = Array.isArray(response?.data) ? response.data : [];
      setClients(data);
    } catch (error) {
      showError(error?.message || 'Failed to load CRM clients');
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const resetForm = () => {
    setForm({ name: '', type: 'individual', email: '', phone: '', tags: '', leadSource: '', notes: '' });
  };

  const openModal = () => {
    resetForm();
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        leadSource: form.leadSource.trim() || undefined,
        notes: form.notes.trim() || undefined,
        tags: form.tags
          ? form.tags.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
      };
      await crmApi.createClient(payload);
      showSuccess('CRM client created successfully');
      closeModal();
      loadClients();
    } catch (error) {
      showError(error?.message || 'Failed to create CRM client');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (c) => <span className="font-medium">{c.businessName || c.name || '—'}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (c) => (
        <Badge status={c.crmType === 'company' ? 'Approved' : 'Pending'}>
          {TYPE_LABELS[c.crmType] || c.crmType || '—'}
        </Badge>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (c) => c.businessEmail || c.email || '—',
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (c) => c.primaryContactNumber || c.phone || '—',
    },
    {
      key: 'tags',
      header: 'Tags',
      render: (c) => {
        const tags = Array.isArray(c.tags) ? c.tags : [];
        if (tags.length === 0) return '—';
        return (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {tags.map((tag) => (
              <Badge key={tag} status="Draft">{tag}</Badge>
            ))}
          </div>
        );
      },
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (c) => formatDate(c.createdAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (c) => (
        <Button
          variant="outline"
          onClick={(event) => {
            event.stopPropagation();
            navigate(safeRoute(ROUTES.CRM_CLIENT_DETAIL(firmSlug, c._id || c.id)));
          }}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <Layout>
      <PageHeader
        title="CRM Clients"
        description="Manage your sales contacts and client pipeline."
        actions={isAdmin ? (
          <Button onClick={openModal}>+ Add Client</Button>
        ) : null}
      />
      <Card>
        {loading ? (
          <Loading message="Loading CRM clients..." />
        ) : (
          <DataTable
            columns={columns}
            rows={clients}
            rowKey="_id"
            onRowClick={(c) => navigate(safeRoute(ROUTES.CRM_CLIENT_DETAIL(firmSlug, c._id || c.id)))}
            emptyMessage={(
              <div className="p-8">
                <EmptyState
                  title="No CRM clients yet"
                  description="Add your first CRM client to start managing your pipeline."
                />
              </div>
            )}
          />
        )}
      </Card>

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title="Add New CRM Client"
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
          <div>
            <label className="neo-label" htmlFor="crm-client-type">Type</label>
            <select
              id="crm-client-type"
              className="neo-input"
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
            >
              <option value="individual">Individual</option>
              <option value="company">Company</option>
            </select>
          </div>
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
            label="Tags (comma-separated)"
            value={form.tags}
            onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
            placeholder="e.g. vip, gst-only, priority"
          />
          <Input
            label="Lead Source"
            value={form.leadSource}
            onChange={(e) => setForm((prev) => ({ ...prev, leadSource: e.target.value }))}
            placeholder="e.g. referral, website"
          />
          <Input
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Optional CRM notes"
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Client'}</Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
};
