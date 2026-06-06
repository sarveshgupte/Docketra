import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Loading } from '../components/common/Loading';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { Textarea } from '../components/common/Textarea';
import { DataTable } from '../components/common/DataTable';
import { PlatformShell } from '../components/platform/PlatformShell';
import {
  ErrorState,
  EmptyState,
  FilterBar,
  PageSection,
  SectionToolbar,
  StatusMessageStack,
} from './platform/PlatformShared';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { clientApi } from '../api/client.api';
import { formatDate } from '../utils/formatters';
import { formatDateTime } from '../utils/formatDateTime';
import { BulkUploadModal } from '../components/bulk/BulkUploadModal';
import { buildTemplateCsv } from '../constants/bulkUploadSchema';
import { useUnsavedChangesPrompt } from '../hooks/useUnsavedChangesPrompt';
import { useQueryState } from '../hooks/useQueryState';
import { canManageClients as canManageClientsByRoleOrPermission } from '../utils/permissions';
import './ClientsPage.css';

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
const TENANT_KEY_MISSING_ADMIN_COPY = 'Client encryption setup needs repair. Contact admin or run encryption repair.';
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
  const [selectedClientId, setSelectedClientId] = useState('');
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
  const hasRowsRef = useRef(false);
  const retryTimerRef = useRef(null);
  const canManageClients = canManageClientsByRoleOrPermission(user);
  const [repairingEncryption, setRepairingEncryption] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      if (statusFilter === 'ACTIVE') return client.status === 'ACTIVE';
      if (statusFilter === 'INACTIVE') return client.status === 'INACTIVE';
      return true;
    });
  }, [clients, statusFilter]);

  const stats = useMemo(() => {
    const total = pagination.total || clients.length;
    const active = clients.filter((c) => c.status === 'ACTIVE').length;
    const inactive = clients.filter((c) => c.status === 'INACTIVE').length;
    const attachmentsCount = clients.reduce((acc, c) => acc + (c.clientFactSheet?.attachments?.length || 0), 0);
    return { total, active, inactive, attachmentsCount };
  }, [clients, pagination.total]);

  const initialClientSnapshot = useMemo(() => ({
    businessName: selectedClient?.businessName || selectedClient?.legalName || selectedClient?.name || '',
    businessEmail: selectedClient?.businessEmail || '',
    primaryContactNumber: selectedClient?.primaryContactNumber || '',
    businessAddress: selectedClient?.businessAddress || '',
    city: selectedClient?.city || '',
    state: selectedClient?.state || '',
    pincode: selectedClient?.pincode || '',
    contactPersonName: selectedClient?.contactPersonName || '',
    contactPersonEmail: selectedClient?.contactPersonEmail || selectedClient?.contactPersonEmailAddress || '',
    contactPersonPhone: selectedClient?.contactPersonPhone || selectedClient?.contactPersonPhoneNumber || '',
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
    if (code === 'TENANT_KEY_MISSING') return canManageClients ? TENANT_KEY_MISSING_ADMIN_COPY : TENANT_KEY_MISSING_COPY;
    if (code === 'FORBIDDEN') return FORBIDDEN_COPY;
    if (code === 'DUPLICATE') return DUPLICATE_COPY;
    return error?.response?.data?.message || error?.message || fallback;
  };

  const loadClients = useCallback(async ({ isRetry = false } = {}) => {
    // Use ref for has-rows check to avoid including `clients` in the dep array
    // (which would create a circular: clients change → new loadClients → useEffect → fetch → clients change)
    const hasRows = hasRowsRef.current;
    if (!isRetry) {
      setLoading(!hasRows);
      setIsRefreshing(hasRows);
    }
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

      hasRowsRef.current = normalizedClients.length > 0;
      setClients(normalizedClients);
      setPagination(response?.pagination || { page, pages: 1, total: normalizedClients.length, limit: 25 });
    } catch (error) {
      const status = error?.response?.status;
      // Auto-retry once on 500/network errors (covers server cold-start race conditions)
      // so the user never has to manually refresh after a transient boot failure.
      if (!isRetry && (!status || status >= 500)) {
        retryTimerRef.current = setTimeout(() => loadClients({ isRetry: true }), 2000);
        return;
      }
      const message = getClientErrorMessage(error, DEFAULT_LOAD_ERROR);
      setLoadError(message);
      showError(message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [showError, page, searchQuery]);

  const handleRepairEncryption = useCallback(async () => {
    try {
      setRepairingEncryption(true);
      await clientApi.repairEncryptionKey();
      showSuccess('Client encryption repair completed. Reloading clients.');
      await loadClients();
    } catch (error) {
      showError(getClientErrorMessage(error, 'Failed to repair client encryption setup'));
    } finally {
      setRepairingEncryption(false);
    }
  }, [loadClients, showError, showSuccess]);

  // Cleanup retry timer on unmount to avoid state updates on unmounted component
  useEffect(() => () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
  }, []);

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
    setSelectedClientId('');
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
    const resolvedClientId = client?.clientId || client?.id || client?._id || '';
    setSelectedClient({ ...client, clientId: resolvedClientId });
    setSelectedClientId(resolvedClientId);
    setClientForm({
      businessName: client.businessName || client.legalName || client.name || '',
      businessEmail: client.businessEmail || '',
      primaryContactNumber: client.primaryContactNumber || '',
      businessAddress: client.businessAddress || '',
      city: client.city || '',
      state: client.state || '',
      pincode: client.pincode || '',
      contactPersonName: client.contactPersonName || '',
      contactPersonEmail: client.contactPersonEmail || client.contactPersonEmailAddress || '',
      contactPersonPhone: client.contactPersonPhone || client.contactPersonPhoneNumber || '',
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
    if (email && !EMAIL_REGEX.test(email)) nextErrors.businessEmail = 'Enter a valid business email address.';
    if (clientForm.pincode.trim() && !PINCODE_REGEX.test(clientForm.pincode.trim())) nextErrors.pincode = 'Enter a valid 6-digit pincode.';
    if (clientForm.contactPersonEmail.trim() && !EMAIL_REGEX.test(clientForm.contactPersonEmail.trim())) nextErrors.contactPersonEmail = 'Enter a valid contact person email address.';

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
      if (selectedClient) {
        if (!selectedClientId) throw new Error('This client record is missing an ID. Please refresh the page and try again.');
        const response = await clientApi.updateClient(selectedClientId, {
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
          contactPersonEmailAddress: clientForm.contactPersonEmail,
          contactPersonPhoneNumber: clientForm.contactPersonPhone,
          ...(clientForm.PAN ? { PAN: clientForm.PAN } : {}),
          ...(clientForm.CIN ? { CIN: clientForm.CIN } : {}),
          ...(clientForm.TAN ? { TAN: clientForm.TAN } : {}),
          ...(clientForm.GST ? { GST: clientForm.GST } : {}),
        });
        if (!response?.success) throw new Error(response?.message || 'Failed to update client');
        setClients((prev) => prev.map((client) => (client.clientId === selectedClientId
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
          contactPersonEmailAddress: clientForm.contactPersonEmail,
          contactPersonPhoneNumber: clientForm.contactPersonPhone,
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
      cellClassName: 'whitespace-nowrap font-medium',
    },
    {
      key: 'businessName',
      header: 'Business Name',
      headerClassName: 'min-w-[14rem]',
      cellClassName: 'min-w-[14rem] whitespace-normal break-words',
      render: (client) => (
        <span className="clients-table-cell-multiline">{toDisplayString(client.businessName)}</span>
      ),
    },
    {
      key: 'businessEmail',
      header: 'Email',
      headerClassName: 'min-w-[14rem]',
      cellClassName: 'min-w-[14rem] whitespace-normal break-all',
      render: (client) => <span className="clients-table-cell-multiline">{toDisplayString(client.businessEmail)}</span>,
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
      cellClassName: 'whitespace-normal',
      render: (client) => <span className="clients-table-cell-multiline">{toDisplayString(client.primaryContactNumber)}</span>,
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
      cellClassName: 'min-w-[10rem]',
      render: (client) => (
        <div className="admin__actions clients-table-actions">
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
            </>
          ) : null}
        </div>
      ),
    },
  ], [canManageClients, openEditClientModal, handleToggleClientStatus, openEditCfsModal]);

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
          <div className="clients-page-actions flex items-center gap-2">
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
      {/* Telemetry Analytics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/70 backdrop-blur-md border border-slate-200/60 p-4 rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Registered</p>
            <h4 className="text-lg font-bold text-slate-800 mt-0.5">{stats.total}</h4>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-md border border-slate-200/60 p-4 rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Status</p>
            <h4 className="text-lg font-bold text-slate-800 mt-0.5">{stats.active}</h4>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-md border border-slate-200/60 p-4 rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inactive Status</p>
            <h4 className="text-lg font-bold text-slate-800 mt-0.5">{stats.inactive}</h4>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-md border border-slate-200/60 p-4 rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fact Sheet Docs</p>
            <h4 className="text-lg font-bold text-slate-800 mt-0.5">{stats.attachmentsCount}</h4>
          </div>
        </div>
      </div>

      <PageSection>
        <SectionToolbar>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
            <div className="flex-1 min-w-[280px] max-w-md relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                className="w-full pl-10 pr-4 py-2 bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder-slate-400"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by client name, ID, or email..."
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Status Filters Segmented Controls */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/30 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'ALL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  All Status
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('ACTIVE')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'ACTIVE' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-emerald-600'}`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('INACTIVE')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'INACTIVE' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-rose-600'}`}
                >
                  Inactive
                </button>
              </div>

              {/* View Mode Segmented Controls */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/30 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  title="Grid View"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  title="List View"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </SectionToolbar>

        <StatusMessageStack
          messages={[
            isRefreshing ? { tone: 'info', message: 'Refreshing clients in the background…' } : null,
          ]}
        />

        {loading ? (
          <Loading message="Loading clients..." />
        ) : loadError ? (
          <ErrorState
            title="Could not load clients"
            body={loadError}
            actionLabel="Retry"
            onAction={loadClients}
            secondaryActionLabel={canManageClients && loadError.includes('encryption') ? (repairingEncryption ? 'Repairing…' : 'Run encryption repair') : undefined}
            onSecondaryAction={canManageClients && loadError.includes('encryption') ? handleRepairEncryption : undefined}
          />
        ) : filteredClients.length === 0 ? (
          <EmptyState
            title="No clients available matching search/filters"
            body="Try adjusting your status toggle, search queries, or add a new client workspace."
            actionLabel={canManageClients ? 'Add Client' : undefined}
            onAction={canManageClients ? openCreateClientModal : undefined}
          />
        ) : viewMode === 'grid' ? (
          /* High-Fidelity Client Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients.map((client) => {
              const resolvedClientId = client?.clientId || client?.id || client?._id || '';
              const initials = (client.businessName || 'Client').trim().substring(0, 2).toUpperCase();
              const isProtectedClient = client?.isDefaultClient || client?.isSystemClient || client?.isInternal;
              
              return (
                <div
                  key={resolvedClientId}
                  className={`bg-white/70 backdrop-blur-md border border-slate-200/60 rounded-2xl p-6 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between h-full group hover:border-indigo-300`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center shadow-sm">
                          {initials}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors duration-200">
                            {toDisplayString(client.businessName)}
                          </h3>
                          <p className="text-xs font-semibold text-slate-400 mt-0.5">ID: {resolvedClientId}</p>
                        </div>
                      </div>
                      <Badge status={client.status === 'ACTIVE' ? 'Approved' : 'Rejected'}>
                        {client.status}
                      </Badge>
                    </div>

                    <div className="space-y-2.5 mt-4 text-sm text-slate-600 border-t border-slate-100/80 pt-4">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="truncate" title={client.businessEmail}>{toDisplayString(client.businessEmail)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span>{toDisplayString(client.primaryContactNumber)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="truncate">Contact: {toDisplayString(client.contactPersonName)}</span>
                      </div>
                      {client.GST && (
                        <div className="flex items-center gap-2 text-xs font-semibold bg-slate-50 text-slate-500 px-2 py-1 rounded w-fit border border-slate-100 mt-2">
                          <span>GST: {client.GST}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {canManageClients && (
                    <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-slate-100/80">
                      <button
                        type="button"
                        onClick={() => openEditClientModal(client)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all duration-200"
                      >
                        Edit Info
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditCfsModal(client)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-500 hover:text-white transition-all duration-200"
                      >
                        Edit Fact Sheet
                      </button>
                      {!isProtectedClient && (
                        <button
                          type="button"
                          onClick={() => handleToggleClientStatus(client)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-200 ${client.status === 'ACTIVE' ? 'bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white'}`}
                        >
                          {client.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* High-Density Data Table List */
          <Card>
            <DataTable
              columns={columns}
              rows={filteredClients}
              rowKey="clientId"
              emptyMessage={(
                <EmptyState
                  title="No clients available yet"
                  body="Add your first client to start creating dockets."
                  actionLabel={canManageClients ? 'Add Client' : undefined}
                  onAction={canManageClients ? openCreateClientModal : undefined}
                />
              )}
            />
          </Card>
        )}

        {!loading && !loadError ? (
          <div className="clients-page-pagination flex items-center justify-between border-t border-slate-100/85 mt-6 pt-4">
            <span className="clients-page-pagination__summary text-sm text-slate-500">
              Page {pagination.page} of {Math.max(pagination.pages || 1, 1)} · {pagination.total || 0} clients
            </span>
            <div className="clients-page-pagination__actions flex items-center gap-2">
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
      </PageSection>

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
        title={selectedClient ? `Edit Client • ${selectedClient.businessName || selectedClient.legalName || selectedClient.name || selectedClientId || 'Client'}` : 'Add New Client'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveClient} className="space-y-6">
          {clientFormMessage.text ? (
            <p className={`client-form-message ${clientFormMessage.type === 'error' ? 'client-form-message--error' : 'client-form-message--success'}`}>{clientFormMessage.text}</p>
          ) : null}
          
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Basic Organization Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input
                  label="Business Name"
                  value={clientForm.businessName}
                  onChange={(event) => handleClientFieldChange('businessName', event.target.value)}
                  required
                  error={clientFormErrors.businessName}
                  disabled={!canManageClients}
                />
              </div>
              <div className="md:col-span-2">
                <Input
                  label="Business Address"
                  value={clientForm.businessAddress}
                  onChange={(event) => handleClientFieldChange('businessAddress', event.target.value)}
                  error={clientFormErrors.businessAddress}
                />
              </div>
              <Input label="City" value={clientForm.city} onChange={(event) => handleClientFieldChange('city', event.target.value)} error={clientFormErrors.city} />
              <Input label="State" value={clientForm.state} onChange={(event) => handleClientFieldChange('state', event.target.value)} error={clientFormErrors.state} />
              <Input label="Pincode" value={clientForm.pincode} onChange={(event) => handleClientFieldChange('pincode', event.target.value)} error={clientFormErrors.pincode} />
            </div>
          </div>

          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Contact Person & Channels
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>
          </div>

          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Statutory & Registration Identification
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="PAN (Optional)" value={clientForm.PAN} onChange={(event) => handleClientFieldChange('PAN', event.target.value)} error={clientFormErrors.PAN} />
              <Input label="CIN (Optional)" value={clientForm.CIN} onChange={(event) => handleClientFieldChange('CIN', event.target.value)} error={clientFormErrors.CIN} />
              <Input label="TAN (Optional)" value={clientForm.TAN} onChange={(event) => handleClientFieldChange('TAN', event.target.value)} error={clientFormErrors.TAN} />
              <Input label="GST (Optional)" value={clientForm.GST} onChange={(event) => handleClientFieldChange('GST', event.target.value)} error={clientFormErrors.GST} />
            </div>
          </div>

          <div className="client-modal-actions">
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
        <div className="client-fact-sheet-grid overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Client Overview / Description
                </label>
                <Textarea
                  value={descriptionDraft}
                  onChange={(event) => setDescriptionDraft(event.target.value)}
                  rows={6}
                  placeholder="Explain the client's business, service tier, and expectations..."
                  className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Internal Compliance & Operational Notes
                </label>
                <Textarea
                  value={notesDraft}
                  onChange={(event) => setNotesDraft(event.target.value)}
                  rows={4}
                  placeholder="Add private billing guidelines, escalation matrices, or support schedules..."
                  className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="text-xs text-slate-400 pl-1">
                Last updated: {selectedFactSheet?.updatedAt ? formatDateTime(selectedFactSheet.updatedAt) : 'Never'}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4 flex flex-col h-full">
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex-1 flex flex-col justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                    Attachments & Documents
                  </label>
                  
                  <div
                    className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-white rounded-xl p-6 text-center cursor-pointer transition-all duration-200 group"
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(event) => event.key === 'Enter' && fileInputRef.current?.click()}
                  >
                    <span className="text-3xl block group-hover:scale-110 transition-transform duration-200">📎</span>
                    <span className="block text-sm font-semibold text-slate-700 mt-2">Click to upload a document</span>
                    <span className="block text-xs text-slate-400 mt-1">PDF, DOCX, XLSX, or images up to 25MB</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleUploadCfsFile}
                      disabled={uploadingFile}
                      className="hidden"
                    />
                  </div>
                  {uploadingFile && (
                    <div className="mt-3 text-xs text-indigo-600 font-semibold flex items-center gap-1">
                      <svg className="animate-spin h-3.5 w-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Uploading file...
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200/60 overflow-hidden">
                  <div className="max-h-[220px] overflow-y-auto pr-1">
                    {selectedFiles.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 text-sm">
                        No attachments uploaded yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedFiles.map((file) => {
                          const fileId = file.fileId || file._id || file.attachmentId;
                          return (
                            <div key={fileId} className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-lg shadow-sm text-xs">
                              <div className="min-w-0 flex-1 pr-2">
                                <p className="font-semibold text-slate-700 truncate" title={file.fileName}>{file.fileName}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  {formatFileSize(file.size)} • {file.uploadedAt ? formatDate(file.uploadedAt) : '—'}
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={deletingFileId === String(fileId)}
                                onClick={() => handleDeleteFile(fileId)}
                                className={`text-[10px] font-bold px-2 py-1 rounded bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shrink-0`}
                              >
                                {deletingFileId === String(fileId) ? 'Deleting…' : 'Remove'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
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
