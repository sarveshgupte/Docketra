import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Loading } from '../components/common/Loading';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { Textarea } from '../components/common/Textarea';
import { DataTable } from '../components/common/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { PlatformShell } from '../components/platform/PlatformShell';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { clientApi } from '../api/client.api';
import { formatDate } from '../utils/formatters';
import { formatDateTime } from '../utils/formatDateTime';
import { BulkUploadModal } from '../components/bulk/BulkUploadModal';
import { buildTemplateCsv } from '../constants/bulkUploadSchema';
import { useUnsavedChangesPrompt } from '../hooks/useUnsavedChangesPrompt';
import { useQueryState } from '../hooks/useQueryState';
import { ROUTES } from '../constants/routes';
import { canManageClients as canManageClientsByRoleOrPermission } from '../utils/permissions';

const toDisplayString = (value, fallback = '—') => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === 'number') return String(value);
  return fallback;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;
const TENANT_KEY_MISSING_COPY = 'Client encryption setup needs repair before clients can be loaded.';
const FORBIDDEN_COPY = 'Client management requires Admin access.';
const DUPLICATE_COPY = 'A client with this name or identifier already exists.';
const DEFAULT_LOAD_ERROR = 'Failed to load clients';
const resolveCfsDescription = (factSheet = {}) => (
  factSheet?.description
  ?? factSheet?.overview
  ?? ''
);
const resolveCfsNotes = (factSheet = {}) => (
  factSheet?.notes
  ?? factSheet?.internalNotes
  ?? ''
);


export const ClientsPage = () => {
  const { user } = useAuth();
  const firmSlug = user?.firmSlug || window.location.pathname.split('/')[3] || '';
  const { showError, showSuccess } = useToast();
  const { query, setQuery } = useQueryState({ page: '1', q: '' });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [clients, setClients] = useState([]);
  const [editCfsClient, setEditCfsClient] = useState(null);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [savingText, setSavingText] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState('');
  const [showClientModal, setShowClientModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [savingClient, setSavingClient] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [page, setPage] = useState(Math.max(Number.parseInt(query.page, 10) || 1, 1));
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 25 });
  const [searchInput, setSearchInput] = useState(query.q || '');
  const [searchQuery, setSearchQuery] = useState(query.q || '');
  const [clientForm, setClientForm] = useState({
    businessName: '',
    businessEmail: '',
    primaryContactNumber: '',
    businessAddress: '',
    city: '',
    state: '',
    pincode: '',
    contactPersonName: '',
    contactPersonEmail: '',
    contactPersonPhone: '',
    PAN: '',
    CIN: '',
    TAN: '',
    GST: '',
  });
  const [clientFormErrors, setClientFormErrors] = useState({});
  const [clientFormMessage, setClientFormMessage] = useState({ type: '', text: '' });
  const fileInputRef = useRef(null);
  const searchDebounceRef = useRef(null);
  const canManageClients = canManageClientsByRoleOrPermission(user);

  const initialClientSnapshot = useMemo(() => ({
    businessName: selectedClient?.businessName || '',
    businessEmail: selectedClient?.businessEmail || '',
    primaryContactNumber: selectedClient?.primaryContactNumber || '',
    businessAddress: selectedClient?.businessAddress || '',
    city: selectedClient?.city || '',
    state: selectedClient?.state || '',
    pincode: selectedClient?.pincode || '',
    contactPersonName: selectedClient?.contactPersonName || '',
    contactPersonEmail: selectedClient?.contactPersonEmail || '',
    contactPersonPhone: selectedClient?.contactPersonPhone || '',
    PAN: selectedClient?.PAN || '',
    CIN: selectedClient?.CIN || '',
    TAN: selectedClient?.TAN || '',
    GST: selectedClient?.GST || '',
  }), [selectedClient]);

  const isClientFormDirty = useMemo(() => {
    if (!showClientModal) return false;
    return Object.keys(clientForm).some((key) => String(clientForm[key] || '').trim() !== String(initialClientSnapshot[key] || '').trim());
  }, [clientForm, initialClientSnapshot, showClientModal]);

  const { confirmLeaveIfDirty: confirmLeaveClientForm } = useUnsavedChangesPrompt({
    isDirty: isClientFormDirty,
    isEnabled: showClientModal && !savingClient,
    message: 'You have unsaved client changes. Close this form without saving?',
  });

  const getClientErrorCode = (error) => {
    const nestedCode = error?.response?.data?.code;
    const rootCode = error?.code;
    const message = String(error?.response?.data?.message || error?.message || '');
    if (rootCode === 'TENANT_KEY_MISSING' || nestedCode === 'TENANT_KEY_MISSING' || message.includes('TENANT_KEY_MISSING')) return 'TENANT_KEY_MISSING';
    if (error?.response?.status === 403) return 'FORBIDDEN';
    if (error?.response?.status === 409 || nestedCode === 'DUPLICATE_CLIENT' || /duplicate|already exists|E11000/i.test(message)) return 'DUPLICATE';
    return '';
  };

  const getClientErrorMessage = (error, fallback = DEFAULT_LOAD_ERROR) => {
    const code = getClientErrorCode(error);
    if (code === 'TENANT_KEY_MISSING') return TENANT_KEY_MISSING_COPY;
    if (code === 'FORBIDDEN') return FORBIDDEN_COPY;
    if (code === 'DUPLICATE') return DUPLICATE_COPY;
    return error?.response?.data?.message || error?.message || fallback;
  };

  const loadClients = useCallback(async () => {
    const hasRows = clients.length > 0;
    setLoading(!hasRows);
    setIsRefreshing(hasRows);
    setLoadError('');
    try {
      const response = await clientApi.getClients(false, false, { page, limit: 25, search: searchQuery || undefined });
      const payload = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.clients)
          ? response.clients
          : [];

      const normalizedClients = payload
        .filter((client) => (
          client
          && typeof client === 'object'
          && typeof client.clientId === 'string'
          && client.clientId.trim().length > 0
        ))
        .map((client) => ({
          ...client,
          businessEmail: toDisplayString(client.businessEmail, ''),
          contactPersonEmailAddress: toDisplayString(client.contactPersonEmailAddress, ''),
        }));

      setClients(normalizedClients);
      setPagination(response?.pagination || { page, pages: 1, total: normalizedClients.length, limit: 25 });
    } catch (error) {
      const message = getClientErrorMessage(error, DEFAULT_LOAD_ERROR);
      setLoadError(message);
      showError(message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [clients.length, showError, page, searchQuery]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setPage(1);
      setSearchQuery(searchInput.trim());
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchInput]);

  useEffect(() => {
    const requestedPage = Math.max(Number.parseInt(query.page, 10) || 1, 1);
    if (requestedPage !== page) setPage(requestedPage);
    if ((query.q || '') !== searchInput) {
      setSearchInput(query.q || '');
      setSearchQuery(query.q || '');
    }
  }, [page, query.page, query.q, searchInput]);

  useEffect(() => {
    setQuery({ page: page > 1 ? page : null, q: searchQuery || null });
  }, [page, searchQuery, setQuery]);

  const selectedFactSheet = useMemo(
    () => editCfsClient?.clientFactSheet || {},
    [editCfsClient]
  );
  const selectedFiles = selectedFactSheet.attachments || [];

  const resetClientForm = useCallback(() => {
    setSelectedClient(null);
    setClientFormErrors({});
    setClientFormMessage({ type: '', text: '' });
    setClientForm({
      businessName: '',
      businessEmail: '',
      primaryContactNumber: '',
      businessAddress: '',
      city: '',
      state: '',
      pincode: '',
      contactPersonName: '',
      contactPersonEmail: '',
      contactPersonPhone: '',
      PAN: '',
      CIN: '',
      TAN: '',
      GST: '',
    });
  }, []);

  const openCreateClientModal = () => {
    resetClientForm();
    setShowClientModal(true);
  };

  const openEditClientModal = (client) => {
    setSelectedClient(client);
    setClientForm({
      businessName: client.businessName || '',
      businessEmail: client.businessEmail || '',
      primaryContactNumber: client.primaryContactNumber || '',
      businessAddress: client.businessAddress || '',
      city: client.city || '',
      state: client.state || '',
      pincode: client.pincode || '',
      contactPersonName: client.contactPersonName || '',
      contactPersonEmail: client.contactPersonEmail || '',
      contactPersonPhone: client.contactPersonPhone || '',
      PAN: client.PAN || '',
      CIN: client.CIN || '',
      TAN: client.TAN || '',
      GST: client.GST || '',
    });
    setShowClientModal(true);
  };

  const closeClientModal = () => {
    setShowClientModal(false);
    resetClientForm();
  };

  const requestCloseClientModal = () => confirmLeaveClientForm();

  const validateClientForm = () => {
    const nextErrors = {};
    const name = clientForm.businessName.trim();
    const email = clientForm.businessEmail.trim();

    if (!name) nextErrors.businessName = 'Business name is required.';
    if (!email) nextErrors.businessEmail = 'Business email is required.';
    if (email && !EMAIL_REGEX.test(email)) nextErrors.businessEmail = 'Enter a valid business email address.';
    if (!clientForm.primaryContactNumber.trim()) nextErrors.primaryContactNumber = 'Business contact number is required.';
    if (!clientForm.businessAddress.trim()) nextErrors.businessAddress = 'Business address is required.';
    if (!clientForm.city.trim()) nextErrors.city = 'City is required.';
    if (!clientForm.state.trim()) nextErrors.state = 'State is required.';
    if (!clientForm.pincode.trim()) nextErrors.pincode = 'Pincode is required.';
    if (clientForm.pincode.trim() && !PINCODE_REGEX.test(clientForm.pincode.trim())) nextErrors.pincode = 'Enter a valid 6-digit pincode.';
    if (!clientForm.contactPersonName.trim()) nextErrors.contactPersonName = 'Contact person name is required.';
    if (!clientForm.contactPersonEmail.trim()) nextErrors.contactPersonEmail = 'Contact person email is required.';
    if (clientForm.contactPersonEmail.trim() && !EMAIL_REGEX.test(clientForm.contactPersonEmail.trim())) nextErrors.contactPersonEmail = 'Enter a valid contact person email address.';
    if (!clientForm.contactPersonPhone.trim()) nextErrors.contactPersonPhone = 'Contact person phone is required.';

    setClientFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleClientFieldChange = (field, value) => {
    setClientForm((prev) => ({ ...prev, [field]: value }));
    setClientFormErrors((prev) => ({ ...prev, [field]: '' }));
    setClientFormMessage({ type: '', text: '' });
  };

  const handleSaveClient = async (event) => {
    event.preventDefault();
    if (!canManageClients) return;
    if (!validateClientForm()) {
      setClientFormMessage({ type: 'error', text: 'Please resolve the highlighted fields before saving.' });
      return;
    }
    setSavingClient(true);
    try {
      if (selectedClient?.clientId) {
        const response = await clientApi.updateClient(selectedClient.clientId, {
          businessName: clientForm.businessName,
          businessEmail: clientForm.businessEmail,
          primaryContactNumber: clientForm.primaryContactNumber,
          businessAddress: clientForm.businessAddress,
          city: clientForm.city,
          state: clientForm.state,
          pincode: clientForm.pincode,
          contactPersonName: clientForm.contactPersonName,
          contactPersonEmail: clientForm.contactPersonEmail,
          contactPersonPhone: clientForm.contactPersonPhone,
          ...(clientForm.PAN ? { PAN: clientForm.PAN } : {}),
          ...(clientForm.CIN ? { CIN: clientForm.CIN } : {}),
          ...(clientForm.TAN ? { TAN: clientForm.TAN } : {}),
          ...(clientForm.GST ? { GST: clientForm.GST } : {}),
        });
        if (!response?.success) throw new Error(response?.message || 'Failed to update client');
        setClients((prev) => prev.map((client) => (client.clientId === selectedClient.clientId
          ? { ...client, ...response?.data, ...clientForm }
          : client)));
        showSuccess('Client updated successfully');
      } else {
        const response = await clientApi.createClient({
          businessName: clientForm.businessName,
          businessEmail: clientForm.businessEmail,
          primaryContactNumber: clientForm.primaryContactNumber,
          businessAddress: clientForm.businessAddress,
          city: clientForm.city,
          state: clientForm.state,
          pincode: clientForm.pincode,
          contactPersonName: clientForm.contactPersonName,
          contactPersonEmail: clientForm.contactPersonEmail,
          contactPersonPhone: clientForm.contactPersonPhone,
          ...(clientForm.PAN ? { PAN: clientForm.PAN } : {}),
          ...(clientForm.CIN ? { CIN: clientForm.CIN } : {}),
          ...(clientForm.TAN ? { TAN: clientForm.TAN } : {}),
          ...(clientForm.GST ? { GST: clientForm.GST } : {}),
        });
        if (!response?.success) throw new Error(response?.message || 'Failed to create client');
        if (response?.data?.clientId) {
          setClients((prev) => ([{ ...response.data, clientId: response.data.clientId }, ...prev]));
        }
        showSuccess(`Client created successfully${response?.data?.clientId ? ` (${response.data.clientId})` : ''}`);
      }
      setClientFormMessage({ type: 'success', text: 'Client details saved successfully.' });
      closeClientModal();
    } catch (error) {
      const message = getClientErrorMessage(error, 'Failed to save client');
      setClientFormMessage({ type: 'error', text: message });
      showError(message);
    } finally {
      setSavingClient(false);
    }
  };

  const handleToggleClientStatus = async (client) => {
    if (!canManageClients) return;
    const isProtectedClient = client?.isDefaultClient || client?.isSystemClient || client?.isInternal;
    if (isProtectedClient) {
      showError('Default client cannot be deactivated');
      return;
    }
    const isCurrentlyActive = client.status === 'ACTIVE';
    const action = isCurrentlyActive ? 'deactivate' : 'activate';
    const confirmed = window.confirm(`Are you sure you want to ${action} ${client.businessName}?`);
    if (!confirmed) return;
    try {
      const response = await clientApi.toggleClientStatus(client.clientId, !isCurrentlyActive);
      if (!response?.success) throw new Error(response?.message || `Failed to ${action} client`);
      setClients((prev) => prev.map((row) => (row.clientId === client.clientId
        ? { ...row, status: isCurrentlyActive ? 'INACTIVE' : 'ACTIVE' }
        : row)));
      showSuccess(`Client ${isCurrentlyActive ? 'deactivated' : 'activated'} successfully`);
    } catch (error) {
      showError(error?.response?.data?.message || error?.message || `Failed to ${action} client`);
    }
  };

  const openEditCfsModal = useCallback(async (client) => {
    const initialFactSheet = client?.clientFactSheet || {};
    setEditCfsClient(client);
    setDescriptionDraft(resolveCfsDescription(initialFactSheet));
    setNotesDraft(resolveCfsNotes(initialFactSheet));

    try {
      const response = await clientApi.getClientById(client.clientId);
      const fullClient = response?.data || client;
      const latestFactSheet = fullClient?.clientFactSheet || {};
      setEditCfsClient(fullClient);
      setDescriptionDraft(resolveCfsDescription(latestFactSheet));
      setNotesDraft(resolveCfsNotes(latestFactSheet));
    } catch (error) {
      showError(getCfsFetchErrorMessage(error));
    }
  }, [showError]);

  const columns = useMemo(() => [
    {
      key: 'clientId',
      header: 'Client ID',
      align: 'center',
      tabular: true,
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'businessName',
      header: 'Business Name',
      headerClassName: 'min-w-[16rem]',
      cellClassName: 'min-w-[16rem]',
      contentClassName: 'truncate',
    },
    {
      key: 'businessEmail',
      header: 'Email',
      headerClassName: 'min-w-[14rem]',
      cellClassName: 'min-w-[14rem]',
      contentClassName: 'truncate',
      render: (client) => toDisplayString(client.businessEmail),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'whitespace-nowrap',
      render: (client) => <Badge status={client.status === 'ACTIVE' ? 'Approved' : 'Rejected'}>{client.status}</Badge>,
    },
    {
      key: 'primaryContactNumber',
      header: 'Phone',
      headerClassName: 'min-w-[10rem]',
      render: (client) => toDisplayString(client.primaryContactNumber),
    },
    {
      key: 'createdAt',
      header: 'Created',
      align: 'right',
      tabular: true,
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'whitespace-nowrap',
      render: (client) => formatDate(client.createdAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'min-w-[15rem]',
      render: (client) => (
        <div className="admin__actions justify-end">
          {canManageClients ? (
            <>
              <Button size="small" variant="secondary" onClick={() => openEditClientModal(client)}>Edit Client</Button>
              {!(client.isDefaultClient || client.isSystemClient || client.isInternal) && (
                <Button
                  size="small"
                  variant={client.status === 'ACTIVE' ? 'danger' : 'success'}
                  onClick={() => handleToggleClientStatus(client)}
                >
                  {client.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                </Button>
              )}
              <Button size="small" variant="warning" onClick={() => openEditCfsModal(client)}>Edit CFS</Button>
              <Button size="small" variant="outline" onClick={() => window.location.assign(`${ROUTES.CREATE_CASE(firmSlug)}?clientId=${encodeURIComponent(client.clientId)}`)}>
                Create Docket
              </Button>
            </>
          ) : null}
        </div>
      ),
    },
  ], [canManageClients, openEditClientModal, handleToggleClientStatus, openEditCfsModal, firmSlug]);

  const refreshSelectedClient = async () => {
    if (!editCfsClient?.clientId) return;
    const response = await clientApi.getClientById(editCfsClient.clientId);
    const refreshedClient = response?.data || editCfsClient;
    const refreshedFactSheet = refreshedClient?.clientFactSheet || {};
    setEditCfsClient(refreshedClient);
    setClients((prev) => prev.map((client) => (client.clientId === refreshedClient.clientId ? { ...client, ...refreshedClient } : client)));
    setDescriptionDraft(resolveCfsDescription(refreshedFactSheet));
    setNotesDraft(resolveCfsNotes(refreshedFactSheet));
  };

  const handleSaveCfsText = async () => {
    if (!editCfsClient?.clientId) return;
    setSavingText(true);
    try {
      await clientApi.updateClientFactSheet(editCfsClient.clientId, descriptionDraft, notesDraft);
      showSuccess('Client Fact Sheet updated');
      await refreshSelectedClient();
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to update Client Fact Sheet');
    } finally {
      setSavingText(false);
    }
  };

  const handleUploadCfsFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !editCfsClient?.clientId) return;
    setUploadingFile(true);
    try {
      await clientApi.uploadClientCFSFile(editCfsClient.clientId, file);
      showSuccess('Document attached successfully');
      await refreshSelectedClient();
    } catch (error) {
      const stage = error?.stage || 'upload failed';
      const safeMessage = error?.response?.data?.message || error?.message || 'Failed to upload file';
      const suffix = [
        error?.status ? `status ${error.status}` : null,
        error?.requestId ? `requestId ${error.requestId}` : null,
      ].filter(Boolean).join(' · ');
      showError(`${stage}: ${safeMessage}${suffix ? ` (${suffix})` : ''}`);
    } finally {
      event.target.value = '';
      setUploadingFile(false);
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (!editCfsClient?.clientId || !fileId) return;
    setDeletingFileId(fileId);
    try {
      await clientApi.deleteFactSheetFile(editCfsClient.clientId, fileId);
      showSuccess('Document removed');
      await refreshSelectedClient();
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to delete file');
    } finally {
      setDeletingFileId('');
    }
  };

  const formatFileSize = (sizeInBytes) => {
    if (!Number.isFinite(sizeInBytes) || sizeInBytes <= 0) return '—';
    if (sizeInBytes < 1024) return `${sizeInBytes} B`;
    if (sizeInBytes < 1024 * 1024) return `${(sizeInBytes / 1024).toFixed(1)} KB`;
    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <PlatformShell
      moduleLabel="Operations"
      title="Clients"
      subtitle="View and manage registered client workspaces, compliance notes, and attachments."
      actions={canManageClients ? (
          <div className="flex items-center gap-2">
            <Button variant="default" onClick={() => setShowBulkUpload(true)}>Bulk Upload</Button>
            <Button variant="default" onClick={() => {
              const blob = new Blob([buildTemplateCsv('clients')], { type: 'text/csv;charset=utf-8;' });
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.setAttribute('download', 'clients-bulk-template.csv');
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(url);
            }}>Download Template</Button>
            <Button onClick={openCreateClientModal}>+ Add Client</Button>
          </div>
        ) : null}
    >
      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <Input
            label="Search clients"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by client name, ID, or email"
          />
        </div>
        {loading ? <Loading message="Loading clients..." /> : loadError ? (
          <div className="p-8">
            <EmptyState
              title="Could not load clients"
              description={loadError}
              actionLabel="Retry"
              onAction={loadClients}
            />
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={clients}
            rowKey="clientId"
            emptyMessage={(
              <div className="p-8">
                <EmptyState
                  title="No clients available yet"
                  description="Add your first client to start creating dockets."
                  actionLabel={canManageClients ? 'Add Client' : undefined}
                  onAction={canManageClients ? openCreateClientModal : undefined}
                />
              </div>
            )}
          />
        )}
        {!loading && !loadError ? (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
            <span>
              Page {pagination.page} of {Math.max(pagination.pages || 1, 1)} · {pagination.total || 0} clients
              {isRefreshing ? ' · Refreshing…' : ''}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={page >= Math.max(pagination.pages || 1, 1)}
                onClick={() => setPage((prev) => prev + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
      <BulkUploadModal
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        type="clients"
        title="Bulk Upload Clients"
        onImported={loadClients}
        showToast={(message, level) => (level === 'error' ? showError(message) : showSuccess(message))}
      />
      <Modal
        isOpen={showClientModal}
        onClose={closeClientModal}
        onRequestClose={requestCloseClientModal}
        title={selectedClient ? `Edit Client • ${selectedClient.businessName}` : 'Add New Client'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveClient} style={{ display: 'grid', gap: '1rem' }}>
          {clientFormMessage.text ? (
            <p className={`rounded-md border px-3 py-2 text-sm ${clientFormMessage.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{clientFormMessage.text}</p>
          ) : null}
          <h3 className="text-sm font-semibold text-gray-700">Basic Details</h3>
          <Input
            label="Business Name"
            value={clientForm.businessName}
            onChange={(event) => handleClientFieldChange('businessName', event.target.value)}
            required
            error={clientFormErrors.businessName}
            disabled={!canManageClients}
          />
          <Input
            label="Business Address"
            value={clientForm.businessAddress}
            onChange={(event) => handleClientFieldChange('businessAddress', event.target.value)}
            error={clientFormErrors.businessAddress}
          />
          <Input label="City" value={clientForm.city} onChange={(event) => handleClientFieldChange('city', event.target.value)} error={clientFormErrors.city} />
          <Input label="State" value={clientForm.state} onChange={(event) => handleClientFieldChange('state', event.target.value)} error={clientFormErrors.state} />
          <Input label="Pincode" value={clientForm.pincode} onChange={(event) => handleClientFieldChange('pincode', event.target.value)} error={clientFormErrors.pincode} />
          <h3 className="text-sm font-semibold text-gray-700">Contact Details</h3>
          <Input
            label="Business Contact Number"
            value={clientForm.primaryContactNumber}
            onChange={(event) => handleClientFieldChange('primaryContactNumber', event.target.value)}
            error={clientFormErrors.primaryContactNumber}
          />
          <Input
            label="Business Email"
            type="email"
            value={clientForm.businessEmail}
            onChange={(event) => handleClientFieldChange('businessEmail', event.target.value)}
            error={clientFormErrors.businessEmail}
          />
          <Input
            label="Contact Person Name"
            value={clientForm.contactPersonName}
            onChange={(event) => handleClientFieldChange('contactPersonName', event.target.value)}
            error={clientFormErrors.contactPersonName}
          />
          <Input label="Contact Person Email" type="email" value={clientForm.contactPersonEmail} onChange={(event) => handleClientFieldChange('contactPersonEmail', event.target.value)} error={clientFormErrors.contactPersonEmail} />
          <Input label="Contact Person Phone" value={clientForm.contactPersonPhone} onChange={(event) => handleClientFieldChange('contactPersonPhone', event.target.value)} error={clientFormErrors.contactPersonPhone} />
          <h3 className="text-sm font-semibold text-gray-700">Statutory / Registration Details</h3>
          <Input label="PAN (Optional)" value={clientForm.PAN} onChange={(event) => handleClientFieldChange('PAN', event.target.value)} error={clientFormErrors.PAN} />
          <Input label="CIN (Optional)" value={clientForm.CIN} onChange={(event) => handleClientFieldChange('CIN', event.target.value)} error={clientFormErrors.CIN} />
          <Input label="TAN (Optional)" value={clientForm.TAN} onChange={(event) => handleClientFieldChange('TAN', event.target.value)} error={clientFormErrors.TAN} />
          <Input label="GST (Optional)" value={clientForm.GST} onChange={(event) => handleClientFieldChange('GST', event.target.value)} error={clientFormErrors.GST} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button type="button" variant="outline" onClick={() => requestCloseClientModal() && closeClientModal()}>Cancel</Button>
            <Button type="submit" disabled={savingClient || !isClientFormDirty}>{savingClient ? 'Saving…' : 'Save Client'}</Button>
          </div>
        </form>
      </Modal>
      <Modal
        isOpen={Boolean(editCfsClient)}
        onClose={() => {
          setEditCfsClient(null);
          setDescriptionDraft('');
          setNotesDraft('');
        }}
        title={`Edit Fact Sheet • ${editCfsClient?.businessName || ''}`}
        maxWidth="4xl"
        actions={(
          <>
            <Button type="button" variant="outline" onClick={() => setEditCfsClient(null)}>
              Close
            </Button>
            <Button type="button" variant="primary" onClick={handleSaveCfsText} disabled={savingText}>
              {savingText ? 'Saving…' : 'Save Changes'}
            </Button>
          </>
        )}
      >
        <div style={{ display: 'grid', gap: '1rem' }}>
          <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>Client Overview / Description</h3>
            <Textarea
              value={descriptionDraft}
              onChange={(event) => setDescriptionDraft(event.target.value)}
              rows={6}
              placeholder="Add overview for this client"
            />
            <Textarea
              value={notesDraft}
              onChange={(event) => setNotesDraft(event.target.value)}
              rows={4}
              placeholder="Add internal notes"
            />
            <div style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '0.5rem' }}>
              Last updated: {selectedFactSheet?.updatedAt ? formatDateTime(selectedFactSheet.updatedAt) : 'Never'}
            </div>
          </section>

          <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>Attachments / Documents</h3>
            <div
              className="neo-dropzone"
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => event.key === 'Enter' && fileInputRef.current?.click()}
              style={{ marginBottom: '0.75rem' }}
            >
              <div className="neo-dropzone__icon" aria-hidden="true">📎</div>
              <div className="neo-dropzone__label">Click to upload a document</div>
              <div className="neo-dropzone__sub">PDF, DOCX, XLSX, images up to 25MB</div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleUploadCfsFile}
                disabled={uploadingFile}
                style={{ display: 'none' }}
              />
            </div>
            {uploadingFile ? <p style={{ color: '#6b7280' }}>Uploading…</p> : null}
            <table className="neo-table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Size</th>
                  <th>Attached On</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {selectedFiles.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No attachments uploaded yet.</td>
                  </tr>
                ) : selectedFiles.map((file) => (
                  <tr key={file.fileId || file._id || file.attachmentId}>
                    <td>{file.fileName}</td>
                    <td>{formatFileSize(file.size)}</td>
                    <td>{file.uploadedAt ? formatDateTime(file.uploadedAt) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Button
                        size="small"
                        variant="default"
                        disabled={deletingFileId === String(file.fileId || file._id || file.attachmentId)}
                        onClick={() => handleDeleteFile(file.fileId || file._id || file.attachmentId)}
                      >
                        {deletingFileId === String(file.fileId || file._id || file.attachmentId) ? 'Deleting…' : 'Remove'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </Modal>
    </PlatformShell>
  );
};


const getCfsFetchErrorMessage = (error) => {
  const status = error?.response?.status;
  const serverMessage = error?.response?.data?.message;

  if (status === 403) return 'Client management requires Admin access.';
  if (status === 404) return 'Client not found or no longer available';
  if (status === 503) return 'Client record loaded, but some fact sheet resources are unavailable right now. Please try again shortly.';
  if (typeof serverMessage === 'string' && serverMessage.trim()) return serverMessage;

  return 'Failed to load latest client details';
};
