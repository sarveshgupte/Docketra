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
    resetForm();
  };

  const filteredClients = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((item) => {
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
  }, [clients, query]);

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

      await crmApi.createClient(payload);
      showSuccess('New Client added successfully.');
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
        onClick={() => navigate(safeRoute(ROUTES.CRM_CLIENT_DETAIL(firmSlug, clientId)))}
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
        <td>{formatDate(item.createdAt)}</td>
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
          <Button variant="outline" onClick={() => navigate(safeRoute(ROUTES.CRM_CLIENTS(firmSlug)))}>Import Clients (CSV)</Button>
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
          <Button variant="outline" onClick={() => void loadClients({ background: clients.length > 0 })} loading={refreshing} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </FilterBar>

        <DataTable
          columns={['Client', 'Type', 'Email', 'Phone', 'Tags', 'Created']}
          rows={rows}
          loading={initialLoading}
          error={error}
          onRetry={() => void loadClients()}
          emptyLabel="No clients yet. Create your first CRM client using New Client."
          hasActiveFilters={Boolean(query.trim())}
          emptyLabelFiltered="No clients match your current search."
        />
      </PageSection>

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title="New Client"
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
            <Button type="submit" loading={saving} disabled={saving}>{saving ? 'Saving…' : 'Create Client'}</Button>
          </div>
        </form>
      </Modal>
    </PlatformShell>
  );
};
