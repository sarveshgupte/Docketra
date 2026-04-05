import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Loading } from '../components/common/Loading';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { Textarea } from '../components/common/Textarea';
import { PageHeader } from '../components/layout/PageHeader';
import { DataTable } from '../components/layout/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { clientApi } from '../api/client.api';
import { formatDate } from '../utils/formatters';
import { formatDateTime } from '../utils/formatDateTime';

export const ClientsPage = () => {
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const [loading, setLoading] = useState(true);
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
  const [clientForm, setClientForm] = useState({
    businessName: '',
    businessAddress: '',
    primaryContactNumber: '',
    secondaryContactNumber: '',
    businessEmail: '',
    PAN: '',
    TAN: '',
    CIN: '',
    contactPersonName: '',
    contactPersonDesignation: '',
    contactPersonPhoneNumber: '',
    contactPersonEmailAddress: '',
  });
  const fileInputRef = useRef(null);
  const isAdmin = user?.role === 'Admin';

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const response = await clientApi.getClients(false);
      const payload = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.clients)
          ? response.clients
          : [];

      const normalizedClients = payload.filter((client) => (
        client
        && typeof client === 'object'
        && typeof client.clientId === 'string'
        && client.clientId.trim().length > 0
      ));

      setClients(normalizedClients);
    } catch (error) {
      setClients([]);
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
    setClientForm({
      businessName: '',
      businessAddress: '',
      primaryContactNumber: '',
      secondaryContactNumber: '',
      businessEmail: '',
      PAN: '',
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

  const handleSaveClient = async (event) => {
    event.preventDefault();
    if (!isAdmin) return;
    if (!clientForm.businessName || !clientForm.businessAddress || !clientForm.primaryContactNumber || !clientForm.businessEmail) {
      showError('Please fill in business name, address, primary contact number, and business email');
      return;
    }
    setSavingClient(true);
    try {
      if (selectedClient?.clientId) {
        const response = await clientApi.updateClient(selectedClient.clientId, {
          businessName: clientForm.businessName,
          businessAddress: clientForm.businessAddress,
          businessEmail: clientForm.businessEmail,
          primaryContactNumber: clientForm.primaryContactNumber,
          secondaryContactNumber: clientForm.secondaryContactNumber,
          PAN: clientForm.PAN,
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
          businessAddress: clientForm.businessAddress,
          businessEmail: clientForm.businessEmail,
          primaryContactNumber: clientForm.primaryContactNumber,
          ...(clientForm.secondaryContactNumber ? { secondaryContactNumber: clientForm.secondaryContactNumber } : {}),
          ...(clientForm.PAN ? { PAN: clientForm.PAN } : {}),
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
      await loadClients();
      closeClientModal();
    } catch (error) {
      showError(error?.response?.data?.message || error?.message || 'Failed to save client');
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
      render: (client) => client.businessEmail || '—',
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
              <Button size="small" variant="warning" onClick={() => openEditCfsModal(client)}>Edit Fact Sheet</Button>
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
    <Layout>
      <PageHeader
        title="All Clients"
        description="View and manage all registered client workspaces."
        actions={isAdmin ? <Button onClick={openCreateClientModal}>+ Add Client</Button> : null}
      />
      <Card>
        {loading ? <Loading message="Loading clients..." /> : (
          <DataTable
            columns={columns}
            data={clients}
            rowKey="clientId"
            emptyContent={(
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
      <Modal
        isOpen={showClientModal}
        onClose={closeClientModal}
        title={selectedClient ? `Edit Client • ${selectedClient.businessName}` : 'Add New Client'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveClient} style={{ display: 'grid', gap: '1rem' }}>
          <Input
            label="Business Name"
            value={clientForm.businessName}
            onChange={(event) => setClientForm((prev) => ({ ...prev, businessName: event.target.value }))}
            required
            disabled={!isAdmin}
          />
          <Input
            label="Business Address"
            value={clientForm.businessAddress}
            onChange={(event) => setClientForm((prev) => ({ ...prev, businessAddress: event.target.value }))}
            required
            disabled={!isAdmin}
          />
          <Input
            label="Primary Contact Number"
            value={clientForm.primaryContactNumber}
            onChange={(event) => setClientForm((prev) => ({ ...prev, primaryContactNumber: event.target.value }))}
            required
          />
          <Input
            label="Secondary Contact Number"
            value={clientForm.secondaryContactNumber}
            onChange={(event) => setClientForm((prev) => ({ ...prev, secondaryContactNumber: event.target.value }))}
          />
          <Input
            label="Business Email"
            type="email"
            value={clientForm.businessEmail}
            onChange={(event) => setClientForm((prev) => ({ ...prev, businessEmail: event.target.value }))}
            required
          />

          <Input
            label="PAN"
            value={clientForm.PAN}
            onChange={(event) => setClientForm((prev) => ({ ...prev, PAN: event.target.value }))}
          />
          <Input
            label="TAN"
            value={clientForm.TAN}
            onChange={(event) => setClientForm((prev) => ({ ...prev, TAN: event.target.value }))}
          />
          <Input
            label="CIN"
            value={clientForm.CIN}
            onChange={(event) => setClientForm((prev) => ({ ...prev, CIN: event.target.value }))}
          />
          <Input
            label="Contact Person Name"
            value={clientForm.contactPersonName}
            onChange={(event) => setClientForm((prev) => ({ ...prev, contactPersonName: event.target.value }))}
          />
          <Input
            label="Contact Person Designation"
            value={clientForm.contactPersonDesignation}
            onChange={(event) => setClientForm((prev) => ({ ...prev, contactPersonDesignation: event.target.value }))}
          />
          <Input
            label="Contact Person Phone Number"
            value={clientForm.contactPersonPhoneNumber}
            onChange={(event) => setClientForm((prev) => ({ ...prev, contactPersonPhoneNumber: event.target.value }))}
          />
          <Input
            label="Contact Person Email Address"
            type="email"
            value={clientForm.contactPersonEmailAddress}
            onChange={(event) => setClientForm((prev) => ({ ...prev, contactPersonEmailAddress: event.target.value }))}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button type="button" variant="outline" onClick={closeClientModal}>Cancel</Button>
            <Button type="submit" disabled={savingClient}>{savingClient ? 'Saving…' : 'Save Client'}</Button>
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
    </Layout>
  );
};
