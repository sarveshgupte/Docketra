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
import { formatDate } from '../../utils/formatters';
import { ROUTES, safeRoute } from '../../constants/routes';
import {
  DataTable,
  FilterBar,
  InlineNotice,
  PageSection,
  RefreshNotice,
  StatGrid,
} from '../platform/PlatformShared';
import { normalizeRows, resolveCrmErrorMessage } from './crmUiUtils';

const TYPE_LABELS = { individual: 'Individual', company: 'Company' };

export const CrmClientsPage = () => {
  const { firmSlug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();

  const normalizedRole = String(user?.role || '').trim().toUpperCase();
  const isAdmin = normalizedRole === 'ADMIN' || normalizedRole === 'PRIMARY_ADMIN' || Boolean(user?.isPrimaryAdmin);

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [clients, setClients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState(null);
  const [form, setForm] = useState({
    name: '',
    type: 'individual',
    email: '',
    phone: '',
    tags: '',
    leadSource: '',
    notes: '',
  });

  const loadClients = useCallback(async ({ background = false } = {}) => {
    if (background) {
      setRefreshing(true);
    } else {
      setInitialLoading(true);
    }

    setError('');
    try {
      const response = await crmApi.listClients();
      setClients(normalizeRows(response));
    } catch (loadError) {
      const message = resolveCrmErrorMessage(loadError, 'Unable to load CRM clients right now.');
      setError(message);
      showError(message);
      setClients([]);
    } finally {
      setRefreshing(false);
      setInitialLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const resetForm = () => {
    setForm({ name: '', type: 'individual', email: '', phone: '', tags: '', leadSource: '', notes: '' });
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingClient(null);
    resetForm();
  };

  const openEditModal = (client) => {
    setEditingClient(client);
    setForm({
      name: client.businessName || client.name || '',
      type: client.crmType || 'individual',
      email: client.businessEmail || client.email || '',
      phone: client.primaryContactNumber || client.phone || '',
      tags: Array.isArray(client.tags) ? client.tags.join(', ') : '',
      leadSource: client.leadSource || '',
      notes: client.notes || '',
    });
    setShowModal(true);
  };

  const filteredClients = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return clients.filter((item) => {
      if (typeFilter && (item.crmType || 'individual') !== typeFilter) return false;
      if (statusFilter && (item.status || 'active') !== statusFilter) return false;
      if (tagFilter.trim()) {
        const tags = Array.isArray(item.tags) ? item.tags.map((tag) => String(tag).toLowerCase()) : [];
        if (!tags.includes(tagFilter.trim().toLowerCase())) return false;
      }
      if (sourceFilter.trim()) {
        if (String(item.leadSource || '').trim().toLowerCase() !== sourceFilter.trim().toLowerCase()) return false;
      }
      if (!needle) return true;
      const searchable = [
        item.businessName,
        item.name,
        item.businessEmail,
        item.email,
        item.primaryContactNumber,
        item.phone,
        ...(Array.isArray(item.tags) ? item.tags : []),
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(needle);
    });
  }, [clients, query, sourceFilter, statusFilter, tagFilter, typeFilter]);

  const cards = useMemo(() => {
    const total = clients.length;
    const companies = clients.filter((item) => item.crmType === 'company').length;
    const individuals = clients.filter((item) => item.crmType !== 'company').length;
    const tagged = clients.filter((item) => Array.isArray(item.tags) && item.tags.length > 0).length;
    return [
      { label: 'Total clients', value: initialLoading ? '…' : total },
      { label: 'Companies', value: initialLoading ? '…' : companies },
      { label: 'Individuals', value: initialLoading ? '…' : individuals },
      { label: 'Tagged records', value: initialLoading ? '…' : tagged },
    ];
  }, [clients, initialLoading]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!form.name.trim()) {
      showError('Client name is required.');
      return;
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      showError('Please enter a valid email address.');
      return;
    }
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
          ? form.tags.split(',').map((value) => value.trim()).filter(Boolean)
          : [],
      };

      if (editingClient?._id || editingClient?.id) {
        await crmApi.updateClient(editingClient._id || editingClient.id, payload);
        showSuccess('Client updated successfully.');
      } else {
        await crmApi.createClient(payload);
        showSuccess('New client added successfully.');
      }
      closeModal();
      await loadClients({ background: true });
    } catch (createError) {
      showError(resolveCrmErrorMessage(createError, 'Failed to create CRM client. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const rows = filteredClients.map((item) => {
    const clientId = item._id || item.id;
    return (
      <tr
        key={clientId}
        className="cursor-pointer"
        role="link"
        tabIndex={0}
        onClick={() => navigate(safeRoute(ROUTES.CRM_CLIENT_DETAIL(firmSlug, clientId)))}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            navigate(safeRoute(ROUTES.CRM_CLIENT_DETAIL(firmSlug, clientId)));
          }
        }}
      >
        <td>{item.businessName || item.name || '—'}</td>
        <td>
            <Badge status={item.crmType === 'company' ? 'Approved' : 'Pending'}>
              {TYPE_LABELS[item.crmType] || item.crmType || '—'}
            </Badge>
          </td>
        <td>{item.businessEmail || item.email || '—'}</td>
        <td>{item.primaryContactNumber || item.phone || '—'}</td>
        <td>{Array.isArray(item.tags) && item.tags.length > 0 ? item.tags.join(', ') : '—'}</td>
        <td>
          <Badge status={(item.status || 'active') === 'inactive' ? 'Rejected' : 'Approved'}>
            {item.status || 'active'}
          </Badge>
        </td>
        <td>{formatDate(item.createdAt)}</td>
        <td>
          <div className="action-row">
            {isAdmin ? (
              <>
                <Button variant="outline" size="sm" onClick={(event) => { event.stopPropagation(); openEditModal(item); }}>
                  Edit
                </Button>
                {(item.status || 'active') !== 'inactive' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async (event) => {
                      event.stopPropagation();
                      if (deactivatingId) return;
                      setDeactivatingId(clientId);
                      try {
                        await crmApi.deactivateClient(clientId);
                        showSuccess('Client deactivated.');
                        await loadClients({ background: true });
                      } catch (deactivateError) {
                        showError(resolveCrmErrorMessage(deactivateError, 'Failed to deactivate client.'));
                      } finally {
                        setDeactivatingId(null);
                      }
                    }}
                    disabled={deactivatingId === clientId}
                    loading={deactivatingId === clientId}
                  >
                    {deactivatingId === clientId ? 'Deactivating…' : 'Deactivate'}
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        </td>
      </tr>
    );
  });

  return (
    <PlatformShell
      moduleLabel="CRM"
      title="Client Management"
      subtitle="Manage client records, ownership, and conversion readiness in one consistent workspace."
      actions={isAdmin ? <Button onClick={() => setShowModal(true)}>New Client</Button> : null}
    >
      <InlineNotice tone="error" message={error} />
      <RefreshNotice refreshing={refreshing} message="Refreshing client records in the background…" />
      <StatGrid items={cards} />

      <PageSection title="Quick actions" description="Use the same CRM language across overview, leads, and client detail.">
        <div className="action-row">
          {isAdmin ? <Button onClick={() => setShowModal(true)}>New Client</Button> : null}
          <Button variant="outline" onClick={() => navigate(safeRoute(ROUTES.CRM_LEADS(firmSlug)))}>Go to Leads Queue</Button>
        </div>
      </PageSection>

      <PageSection title="Client records" description="Search and open CRM client profiles.">
        <FilterBar>
          <Input
            label="Search clients"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, email, phone, or tag"
          />
          <div>
            <label className="block text-xs text-gray-600" htmlFor="crm-client-filter-type">Type</label>
            <select id="crm-client-filter-type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-2 text-sm">
              <option value="">All types</option>
              <option value="individual">Individual</option>
              <option value="company">Company</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600" htmlFor="crm-client-filter-status">Status</label>
            <select id="crm-client-filter-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-2 text-sm">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="lead">Lead</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <Input label="Tag filter" value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} placeholder="vip" />
          <Input label="Source filter" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} placeholder="referral" />
          <Button variant="outline" onClick={() => void loadClients({ background: clients.length > 0 })} loading={refreshing} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </FilterBar>

        <DataTable
          columns={['Client', 'Type', 'Email', 'Phone', 'Tags', 'Status', 'Created', 'Actions']}
          rows={rows}
          loading={initialLoading}
          error={error}
          onRetry={() => void loadClients()}
          emptyLabel="No clients yet. Create your first CRM client using New Client."
          hasActiveFilters={Boolean(query.trim() || typeFilter || statusFilter || tagFilter.trim() || sourceFilter.trim())}
          emptyLabelFiltered="No clients match your current search."
        />
      </PageSection>

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingClient ? 'Edit Client' : 'New Client'}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="grid gap-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="crm-client-type">Type</label>
            <select
              id="crm-client-type"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.type}
              onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
            >
              <option value="individual">Individual</option>
              <option value="company">Company</option>
            </select>
          </div>
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
          />
          <Input
            label="Tags (comma-separated)"
            value={form.tags}
            onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
            placeholder="e.g. vip, priority"
          />
          <Input
            label="Lead Source"
            value={form.leadSource}
            onChange={(event) => setForm((prev) => ({ ...prev, leadSource: event.target.value }))}
            placeholder="e.g. referral, website"
          />
          <Input
            label="Notes"
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            placeholder="Optional relationship notes"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={saving} disabled={saving}>{saving ? 'Saving…' : (editingClient ? 'Save Changes' : 'Create Client')}</Button>
          </div>
        </form>
      </Modal>
    </PlatformShell>
  );
};
