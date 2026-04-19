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

const toDisplayString = (value, fallback = '—') => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === 'number') return String(value);
  return fallback;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


export const ClientsPage = () => {
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const [loading, setLoading] = useState(true);
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
  const [clientForm, setClientForm] = useState({
    businessName: '',
    businessAddress: '',
    primaryContactNumber: '',
    secondaryContactNumber: '',
    businessEmail: '',
    PAN: '',
    GST: '',
    TAN: '',
    CIN: '',
    contactPersonName: '',
    contactPersonDesignation: '',
    contactPersonPhoneNumber: '',
    contactPersonEmailAddress: '',
  });
  const [clientFormErrors, setClientFormErrors] = useState({});
  const [clientFormMessage, setClientFormMessage] = useState({ type: '', text: '' });
  const fileInputRef = useRef(null);
  const normalizedRole = String(user?.role || '').trim().toUpperCase();
  const isAdmin = normalizedRole === 'ADMIN' || normalizedRole === 'PRIMARY_ADMIN' || Boolean(user?.isPrimaryAdmin);

  const initialClientSnapshot = useMemo(() => ({
    businessName: selectedClient?.businessName || '',
    businessAddress: selectedClient?.businessAddress || '',
    primaryContactNumber: selectedClient?.primaryContactNumber || '',
    secondaryContactNumber: selectedClient?.secondaryContactNumber || '',
    businessEmail: selectedClient?.businessEmail || '',
    PAN: selectedClient?.PAN || '',
    GST: selectedClient?.GST || '',
    TAN: selectedClient?.TAN || '',
    CIN: selectedClient?.CIN || '',
    contactPersonName: selectedClient?.contactPersonName || '',
    contactPersonDesignation: selectedClient?.contactPersonDesignation || '',
    contactPersonPhoneNumber: selectedClient?.contactPersonPhoneNumber || '',
    contactPersonEmailAddress: selectedClient?.contactPersonEmailAddress || '',
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

  const loadClients = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await clientApi.getClients(false);
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
    } catch (error) {
      setClients([]);
      setLoadError(error?.response?.data?.message || error?.message || 'Failed to load clients');
      showError(error?.response?.data?.message || error?.message || 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

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
      businessAddress: '',
      primaryContactNumber: '',
      secondaryContactNumber: '',
      businessEmail: '',
      PAN: '',
      GST: '',
      TAN: '',
      CIN: '',
      contactPersonName: '',
      contactPersonDesignation: '',
      contactPersonPhoneNumber: '',
      contactPersonEmailAddress: '',
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
      businessAddress: client.businessAddress || '',
      primaryContactNumber: client.primaryContactNumber || '',
      secondaryContactNumber: client.secondaryContactNumber || '',
      businessEmail: client.businessEmail || '',
      PAN: client.PAN || '',
      GST: client.GST || '',
      TAN: client.TAN || '',
      CIN: client.CIN || '',
      contactPersonName: client.contactPersonName || '',
      contactPersonDesignation: client.contactPersonDesignation || '',
      contactPersonPhoneNumber: client.contactPersonPhoneNumber || '',
      contactPersonEmailAddress: client.contactPersonEmailAddress || '',
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
    const phone = clientForm.primaryContactNumber.trim();
    const email = clientForm.businessEmail.trim();
    const contactEmail = clientForm.contactPersonEmailAddress.trim();

    if (!name) nextErrors.businessName = 'Client name is required.';
    if (!phone) nextErrors.primaryContactNumber = 'Primary client phone number is required.';
    if (!email) nextErrors.businessEmail = 'Client email is required.';
    if (email && !EMAIL_REGEX.test(email)) nextErrors.businessEmail = 'Enter a valid client email address.';
    if (contactEmail && !EMAIL_REGEX.test(contactEmail)) nextErrors.contactPersonEmailAddress = 'Enter a valid contact person email address.';

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
    if (!isAdmin) return;
    if (!validateClientForm()) {
      setClientFormMessage({ type: 'error', text: 'Please resolve the highlighted fields before saving.' });
      return;
    }
    setSavingClient(true);
    try {
      if (selectedClient?.clientId) {
        const response = await clientApi.updateClient(selectedClient.clientId, {
          businessName: clientForm.businessName,
          ...(clientForm.businessAddress ? { businessAddress: clientForm.businessAddress } : {}),
          businessEmail: clientForm.businessEmail,
          primaryContactNumber: clientForm.primaryContactNumber,
          secondaryContactNumber: clientForm.secondaryContactNumber,
          PAN: clientForm.PAN,
          GST: clientForm.GST,
          TAN: clientForm.TAN,
          CIN: clientForm.CIN,
          contactPersonName: clientForm.contactPersonName,
          contactPersonDesignation: clientForm.contactPersonDesignation,
          contactPersonPhoneNumber: clientForm.contactPersonPhoneNumber,
          contactPersonEmailAddress: clientForm.contactPersonEmailAddress,
        });
        if (!response?.success) throw new Error(response?.message || 'Failed to update client');
        showSuccess('Client updated successfully');
      } else {
        const response = await clientApi.createClient({
          businessName: clientForm.businessName,
          businessEmail: clientForm.businessEmail,
          primaryContactNumber: clientForm.primaryContactNumber,
          ...(clientForm.businessAddress ? { businessAddress: clientForm.businessAddress } : {}),
          ...(clientForm.secondaryContactNumber ? { secondaryContactNumber: clientForm.secondaryContactNumber } : {}),
          ...(clientForm.PAN ? { PAN: clientForm.PAN } : {}),
          ...(clientForm.GST ? { GST: clientForm.GST } : {}),
          ...(clientForm.TAN ? { TAN: clientForm.TAN } : {}),
          ...(clientForm.CIN ? { CIN: clientForm.CIN } : {}),
          ...(clientForm.contactPersonName ? { contactPersonName: clientForm.contactPersonName } : {}),
          ...(clientForm.contactPersonDesignation ? { contactPersonDesignation: clientForm.contactPersonDesignation } : {}),
          ...(clientForm.contactPersonPhoneNumber ? { contactPersonPhoneNumber: clientForm.contactPersonPhoneNumber } : {}),
          ...(clientForm.contactPersonEmailAddress ? { contactPersonEmailAddress: clientForm.contactPersonEmailAddress } : {}),
        });
        if (!response?.success) throw new Error(response?.message || 'Failed to create client');
        showSuccess(`Client created successfully${response?.data?.clientId ? ` (${response.data.clientId})` : ''}`);
      }
      setClientFormMessage({ type: 'success', text: 'Client details saved successfully.' });
      await loadClients();
      closeClientModal();
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Failed to save client';
      setClientFormMessage({ type: 'error', text: message });
      showError(message);
    } finally {
      setSavingClient(false);
    }
  };

  const handleToggleClientStatus = async (client) => {
    if (!isAdmin) return;
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
      showSuccess(`Client ${isCurrentlyActive ? 'deactivated' : 'activated'} successfully`);
      await loadClients();
    } catch (error) {
      showError(error?.response?.data?.message || error?.message || `Failed to ${action} client`);
    }
  };

  const openEditCfsModal = useCallback(async (client) => {
    setEditCfsClient(client);
    setDescriptionDraft(client?.clientFactSheet?.description || '');
    setNotesDraft(client?.clientFactSheet?.notes || '');

    try {
      const response = await clientApi.getClientById(client.clientId);
      const fullClient = response?.data || client;
      setEditCfsClient(fullClient);
      setDescriptionDraft(fullClient?.clientFactSheet?.description || '');
      setNotesDraft(fullClient?.clientFactSheet?.notes || '');
    } catch (error) {
      showError(error?.response?.data?.message || error?.message || 'Failed to load latest client details');
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
          {isAdmin ? (
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
  ], [isAdmin, openEditCfsModal, openEditClientModal, handleToggleClientStatus]);

  const refreshSelectedClient = async () => {
    if (!editCfsClient?.clientId) return;
    const response = await clientApi.getClientById(editCfsClient.clientId);
    const refreshedClient = response?.data || editCfsClient;
    setEditCfsClient(refreshedClient);
    setDescriptionDraft(refreshedClient?.clientFactSheet?.description || '');
    setNotesDraft(refreshedClient?.clientFactSheet?.notes || '');
  };

  const handleSaveCfsText = async () => {
    if (!editCfsClient?.clientId) return;
    setSavingText(true);
    try {
      await clientApi.updateClientFactSheet(editCfsClient.clientId, descriptionDraft, notesDraft);
      showSuccess('Client Fact Sheet updated');
      await Promise.all([refreshSelectedClient(), loadClients()]);
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
      await Promise.all([refreshSelectedClient(), loadClients()]);
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to upload file');
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
      await Promise.all([refreshSelectedClient(), loadClients()]);
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
      actions={isAdmin ? (
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
        {loading ? <Loading message="Loading clients..." /> : loadError ? (
          <div className="p-8">
            <EmptyState
              title="Could not load clients"
              description="Please retry loading clients. If this continues, verify firm access and network connectivity."
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
                  description="Create your first client to begin organizing dockets and workspaces."
                />
              </div>
            )}
          />
        )}
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
          <Input
            label="Client Name"
            value={clientForm.businessName}
            onChange={(event) => handleClientFieldChange('businessName', event.target.value)}
            required
            error={clientFormErrors.businessName}
            disabled={!isAdmin}
          />
          <Input
            label="Business Address (Optional)"
            value={clientForm.businessAddress}
            onChange={(event) => handleClientFieldChange('businessAddress', event.target.value)}
            disabled={!isAdmin}
          />
          <Input
            label="Client Phone Number"
            value={clientForm.primaryContactNumber}
            onChange={(event) => handleClientFieldChange('primaryContactNumber', event.target.value)}
            required
            error={clientFormErrors.primaryContactNumber}
          />
          <Input
            label="Secondary Contact Number"
            value={clientForm.secondaryContactNumber}
            onChange={(event) => handleClientFieldChange('secondaryContactNumber', event.target.value)}
          />
          <Input
            label="Client Email"
            type="email"
            value={clientForm.businessEmail}
            onChange={(event) => handleClientFieldChange('businessEmail', event.target.value)}
            required
            error={clientFormErrors.businessEmail}
            helpText="We'll use this email for client communication records."
          />

          <Input
            label="PAN"
            value={clientForm.PAN}
            onChange={(event) => handleClientFieldChange('PAN', event.target.value)}
          />
          <Input
            label="GST Number"
            value={clientForm.GST}
            onChange={(event) => handleClientFieldChange('GST', event.target.value)}
          />
          <Input
            label="TAN"
            value={clientForm.TAN}
            onChange={(event) => handleClientFieldChange('TAN', event.target.value)}
          />
          <Input
            label="CIN"
            value={clientForm.CIN}
            onChange={(event) => handleClientFieldChange('CIN', event.target.value)}
          />
          <Input
            label="Contact Person Name"
            value={clientForm.contactPersonName}
            onChange={(event) => handleClientFieldChange('contactPersonName', event.target.value)}
          />
          <Input
            label="Contact Person Designation"
            value={clientForm.contactPersonDesignation}
            onChange={(event) => handleClientFieldChange('contactPersonDesignation', event.target.value)}
          />
          <Input
            label="Contact Person Phone Number"
            value={clientForm.contactPersonPhoneNumber}
            onChange={(event) => handleClientFieldChange('contactPersonPhoneNumber', event.target.value)}
          />
          <Input
            label="Contact Person Email Address"
            type="email"
            value={clientForm.contactPersonEmailAddress}
            onChange={(event) => handleClientFieldChange('contactPersonEmailAddress', event.target.value)}
            error={clientFormErrors.contactPersonEmailAddress}
          />

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
