import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Loading } from '../components/common/Loading';
import { Modal } from '../components/common/Modal';
import { Textarea } from '../components/common/Textarea';
import { PageHeader } from '../components/layout/PageHeader';
import { DataTable } from '../components/layout/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { clientService } from '../services/clientService';
import { formatDate } from '../utils/formatters';
import { formatDateTime } from '../utils/formatDateTime';

export const ClientsPage = () => {
  const navigate = useNavigate();
  const { firmSlug } = useParams();
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
  const fileInputRef = useRef(null);
  const isAdmin = user?.role === 'Admin';

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const response = await clientService.getClients(false);
      setClients(response?.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const selectedFactSheet = useMemo(
    () => editCfsClient?.clientFactSheet || {},
    [editCfsClient]
  );
  const selectedFiles = selectedFactSheet.attachments || [];

  const openEditCfsModal = useCallback(async (client) => {
    try {
      const response = await clientService.getClientById(client.clientId);
      const fullClient = response?.data || client;
      setEditCfsClient(fullClient);
      setDescriptionDraft(fullClient?.clientFactSheet?.description || '');
      setNotesDraft(fullClient?.clientFactSheet?.notes || '');
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to load client details');
    }
  }, [showError]);

  const columns = useMemo(() => [
    {
      key: 'clientId',
      header: 'Client ID',
      align: 'center',
      tabular: true,
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
    },
    {
      key: 'businessName',
      header: 'Business Name',
      headerClassName: 'w-full max-w-lg',
      cellClassName: 'w-full max-w-lg',
      contentClassName: 'truncate',
    },
    {
      key: 'businessEmail',
      header: 'Email',
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
      render: (client) => client.businessEmail || '—',
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
      render: (client) => <Badge status={client.status === 'ACTIVE' ? 'Approved' : 'Rejected'}>{client.status}</Badge>,
    },
    {
      key: 'createdAt',
      header: 'Created',
      align: 'right',
      tabular: true,
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
      render: (client) => formatDate(client.createdAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      headerClassName: 'w-[1px] whitespace-nowrap',
      cellClassName: 'w-[1px] whitespace-nowrap',
      render: (client) => (
        <div className="admin__actions justify-end">
          <Button size="small" onClick={() => navigate(`/app/firm/${firmSlug}/clients/${client.clientId}`)}>Workspace</Button>
          {isAdmin ? (
            <Button size="small" variant="warning" onClick={() => openEditCfsModal(client)}>Edit Fact Sheet</Button>
          ) : null}
        </div>
      ),
    },
  ], [navigate, firmSlug, isAdmin, openEditCfsModal]);

  const refreshSelectedClient = async () => {
    if (!editCfsClient?.clientId) return;
    const response = await clientService.getClientById(editCfsClient.clientId);
    const refreshedClient = response?.data || editCfsClient;
    setEditCfsClient(refreshedClient);
    setDescriptionDraft(refreshedClient?.clientFactSheet?.description || '');
    setNotesDraft(refreshedClient?.clientFactSheet?.notes || '');
  };

  const handleSaveCfsText = async () => {
    if (!editCfsClient?.clientId) return;
    setSavingText(true);
    try {
      await clientService.updateClientFactSheet(editCfsClient.clientId, descriptionDraft, notesDraft);
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
      await clientService.uploadClientCFSFile(editCfsClient.clientId, file);
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
      await clientService.deleteFactSheetFile(editCfsClient.clientId, fileId);
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
      <PageHeader title="All Clients" description="View and manage all registered client workspaces." />
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
