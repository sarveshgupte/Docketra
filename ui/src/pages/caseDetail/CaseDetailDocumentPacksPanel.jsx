import React, { useState, useEffect, useCallback } from 'react';
import { documentItemApi } from '../../api/documentItem.api';
import { caseApi } from '../../api/case.api';
import { Button } from '../../components/common/Button';
import { Textarea } from '../../components/common/Textarea';
import { Select } from '../../components/common/Select';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../hooks/useToast';
import { formatDateTime } from '../../utils/formatDateTime';

export const CaseDetailDocumentPacksPanel = ({ caseId, caseInternalId, attachments = [], onRefreshCase }) => {
  const { showSuccess, showError } = useToast();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDocId, setExpandedDocId] = useState(null);

  // Modal / Form States for creating a new Document Item
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Obligation Attachment');
  const [newNotes, setNewNotes] = useState('');
  const [newFileRef, setNewFileRef] = useState('');
  const [newChangeNote, setNewChangeNote] = useState('Initial ingestion');
  const [creating, setCreating] = useState(false);

  // Form States for uploading a new version to an existing Document Item
  const [selectedDocForVersion, setSelectedDocForVersion] = useState(null);
  const [versionFileRef, setVersionFileRef] = useState('');
  const [versionChangeNote, setVersionChangeNote] = useState('');
  const [uploadingVersion, setUploadingVersion] = useState(false);

  const loadDocuments = useCallback(async () => {
    if (!caseInternalId || caseInternalId.length !== 24) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await documentItemApi.getDocumentItems({ caseInternalId });
      if (response.success && Array.isArray(response.data)) {
        setDocuments(response.data);
      }
    } catch (err) {
      showError('Failed to load document packs: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [caseInternalId, showError]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleCreateDocument = async (e) => {
    e.preventDefault();
    if (!newName || !newFileRef) {
      showError('Document Name and Initial File Reference are required.');
      return;
    }

    setCreating(true);
    try {
      const payload = {
        caseInternalId,
        name: newName,
        category: newCategory,
        fileReference: newFileRef,
        notes: newNotes,
        changeNote: newChangeNote,
      };

      const res = await documentItemApi.createDocumentItem(payload);
      if (res.success) {
        showSuccess('Document pack item successfully created!');
        setShowCreateModal(false);
        // Reset form fields
        setNewName('');
        setNewNotes('');
        setNewFileRef('');
        setNewChangeNote('Initial ingestion');
        loadDocuments();
        if (onRefreshCase) onRefreshCase();
      }
    } catch (err) {
      showError('Failed to create document pack: ' + (err.response?.data?.message || err.message));
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (docId, newStatus) => {
    try {
      const res = await documentItemApi.updateDocumentStatus(docId, newStatus);
      if (res.success) {
        showSuccess(`Document status successfully updated to ${newStatus}`);
        loadDocuments();
        if (onRefreshCase) onRefreshCase();
      }
    } catch (err) {
      showError('Failed to update status: ' + err.message);
    }
  };

  const handleSelectActiveVersion = async (docId, versionNumber) => {
    try {
      const res = await documentItemApi.selectCurrentVersion(docId, versionNumber);
      if (res.success) {
        showSuccess(`Successfully set Version ${versionNumber} as the active current version.`);
        loadDocuments();
        if (onRefreshCase) onRefreshCase();
      }
    } catch (err) {
      showError('Failed to change active version: ' + err.message);
    }
  };

  const handleUploadVersion = async (e) => {
    e.preventDefault();
    if (!versionFileRef || !versionChangeNote) {
      showError('Please select a file reference and write a change note.');
      return;
    }

    setUploadingVersion(true);
    try {
      const res = await documentItemApi.addDocumentVersion(
        selectedDocForVersion._id,
        versionFileRef,
        versionChangeNote
      );

      if (res.success) {
        showSuccess('Successfully uploaded new document version!');
        setSelectedDocForVersion(null);
        setVersionFileRef('');
        setVersionChangeNote('');
        loadDocuments();
        if (onRefreshCase) onRefreshCase();
      }
    } catch (err) {
      showError('Failed to upload new version: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploadingVersion(false);
    }
  };

  const downloadFile = (fileReference) => {
    if (!fileReference) return;
    caseApi.downloadAttachment(caseId, fileReference._id || fileReference, fileReference.fileName || 'document-version');
  };

  const getStatusBadgeClass = (status) => {
    const s = String(status).toLowerCase();
    if (s === 'approved') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (s === 'under_review') return 'bg-amber-100 text-amber-800 border-amber-200';
    if (s === 'filed') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (s === 'archived') return 'bg-rose-100 text-rose-800 border-rose-200';
    return 'bg-gray-100 text-gray-800 border-gray-200'; // draft
  };

  const formatStatusText = (status) => {
    return String(status).replace('_', ' ').toUpperCase();
  };

  return (
    <section className="case-card case-detail-section" id="panel-document-packs" role="tabpanel">
      <div className="case-card__heading case-detail-section__heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Document Packs</h2>
          <p className="case-detail-section__subheading">Lightweight document pack control registry. Upload versions, trace logs, and prevent duplicate files.</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} variant="primary">
          ✚ Ingest Document Pack
        </Button>
      </div>

      {loading ? (
        <p className="case-detail__empty-note mt-3">Loading document packs…</p>
      ) : documents.length === 0 ? (
        <div className="text-center py-8 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 mt-3">
          <span className="text-3xl">🗂️</span>
          <p className="mt-2 text-sm text-gray-500 font-medium">No version-controlled document packs in this compliance docket yet.</p>
          <p className="text-xs text-gray-400 mt-1">Upload a normal attachment first, then click "Ingest Document Pack" to configure version tracking.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {documents.map((doc) => {
            const isExpanded = expandedDocId === doc._id;
            const currentVersion = doc.versions.find(v => v.versionNumber === doc.currentVersionNumber) || doc.versions[doc.versions.length - 1];
            const fileRef = currentVersion?.fileReference;
            
            return (
              <div key={doc._id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden hover:border-gray-300 transition-all duration-200">
                <div className="p-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ flex: '1', minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h3 className="text-sm font-semibold text-gray-900">{doc.name}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusBadgeClass(doc.status)}`}>
                        {formatStatusText(doc.status)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      <strong>Category:</strong> {doc.category} · <strong>Current Active:</strong> v{doc.currentVersionNumber} (Total: {doc.versions?.length})
                    </p>
                    {doc.notes && <p className="text-xs text-gray-400 mt-1 italic">"{doc.notes}"</p>}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {fileRef && (
                      <Button variant="outline" size="small" onClick={() => downloadFile(fileRef)}>
                        📥 Download Active (v{doc.currentVersionNumber})
                      </Button>
                    )}
                    <select
                      value={doc.status}
                      onChange={(e) => handleStatusChange(doc._id, e.target.value)}
                      className="px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-700 font-medium focus:outline-none"
                    >
                      <option value="draft">Draft</option>
                      <option value="under_review">Under Review</option>
                      <option value="approved">Approved</option>
                      <option value="filed">Filed</option>
                      <option value="archived">Archived</option>
                    </select>
                    <Button variant="outline" size="small" onClick={() => setSelectedDocForVersion(doc)}>
                      ✚ Push New Version
                    </Button>
                    <button
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors ml-2 px-2 py-1"
                      onClick={() => setExpandedDocId(isExpanded ? null : doc._id)}
                    >
                      {isExpanded ? '▲ Hide History' : '▼ View History'}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="bg-gray-50 border-t border-gray-100 p-4">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Version Control Timeline</h4>
                    <div className="relative border-l border-gray-200 ml-2 space-y-4">
                      {doc.versions.slice().reverse().map((ver) => {
                        const isCurrentActive = ver.versionNumber === doc.currentVersionNumber;
                        const vFileRef = ver.fileReference;
                        
                        return (
                          <div key={ver.versionNumber} className="relative pl-6">
                            <span className={`absolute left-0 top-1.5 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 ${
                              isCurrentActive ? 'bg-indigo-600 border-indigo-600 ring-4 ring-indigo-100' : 'bg-gray-300 border-white'
                            }`} />
                            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-inner text-xs">
                              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                <div>
                                  <span className="font-bold text-gray-900 text-sm">Version {ver.versionNumber}</span>
                                  {isCurrentActive && (
                                    <span className="ml-2 text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded">
                                      Active current pointer
                                    </span>
                                  )}
                                </div>
                                <span className="text-gray-400 text-[10px]">
                                  {formatDateTime(ver.uploadedAt)}
                                </span>
                              </div>
                              <p className="mt-1 text-gray-600">
                                <strong>Change Note:</strong> {ver.changeNote || 'No change note provided'}
                              </p>
                              <p className="mt-0.5 text-gray-400 text-[10px]">
                                <strong>Docket stage at upload:</strong> {ver.docketStageAtUpload} · <strong>Uploader:</strong> {ver.uploadedByXID}
                              </p>
                              <div className="mt-2.5 flex gap-2">
                                {vFileRef && (
                                  <Button variant="outline" size="small" onClick={() => downloadFile(vFileRef)}>
                                    📥 Download (v{ver.versionNumber})
                                  </Button>
                                )}
                                {!isCurrentActive && (
                                  <Button variant="outline" size="small" onClick={() => handleSelectActiveVersion(doc._id, ver.versionNumber)}>
                                    ⭐ Make current active
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Create Ingested Document Item */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Ingest Version-Controlled Document Pack"
        size="sm"
      >
        <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '16px' }}>
          Configure an immutable document pack. You must bind this pack to an already-uploaded case file reference.
        </p>
        <form onSubmit={handleCreateDocument} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label className="field-label" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Document Name *</label>
            <input type="text" className="neo-input w-full text-sm mt-1" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Approved PAN Card, Form 16, GST Challan" required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
            <div>
              <label className="field-label" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Category</label>
              <select className="neo-input w-full text-sm mt-1" value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                <option value="Obligation Attachment">Obligation Attachment</option>
                <option value="Client ID Evidence">Client ID Evidence</option>
                <option value="Filing Challan / Receipt">Filing Challan / Receipt</option>
                <option value="Review Draft">Review Draft</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="field-label" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Initial File Reference (from active attachments) *</label>
            <select className="neo-input w-full text-sm mt-1" value={newFileRef} onChange={e => setNewFileRef(e.target.value)} required>
              <option value="">Select file...</option>
              {attachments.map(a => (
                <option key={a._id} value={a._id}>{a.fileName || a.filename}</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">If your file is not listed, upload it in the Attachments tab first.</p>
          </div>
          <div>
            <Textarea label="Ingestion change note" value={newChangeNote} onChange={e => setNewChangeNote(e.target.value)} placeholder="Initial upload change note" rows={2} />
          </div>
          <div>
            <Textarea label="Document Pack internal notes" value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Provide internal notes for staff review guidelines" rows={2} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'end', gap: '8px', marginTop: '8px' }}>
            <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)} disabled={creating}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={creating}>
              {creating ? 'Ingesting pack…' : 'Ingest Document Pack'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Upload New Version */}
      <Modal
        isOpen={Boolean(selectedDocForVersion)}
        onClose={() => setSelectedDocForVersion(null)}
        title="Push New Version"
        size="sm"
      >
        {selectedDocForVersion && (
          <>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '16px' }}>
              Upload version {selectedDocForVersion.versions?.length + 1} to document pack **{selectedDocForVersion.name}**. Must map to an uploaded file reference.
            </p>
            <form onSubmit={handleUploadVersion} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="field-label" style={{ fontSize: '0.75rem', fontWeight: '600' }}>New File Reference *</label>
                <select className="neo-input w-full text-sm mt-1" value={versionFileRef} onChange={e => setVersionFileRef(e.target.value)} required>
                  <option value="">Select file...</option>
                  {attachments.map(a => (
                    <option key={a._id} value={a._id}>{a.fileName || a.filename}</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">If your file is not listed, upload it in the Attachments tab first.</p>
              </div>
              <div>
                <Textarea label="What changed in this version? (Required) *" value={versionChangeNote} onChange={e => setVersionChangeNote(e.target.value)} placeholder="e.g. Fixed address mismatch on page 2, updated salary details" rows={3} required />
              </div>
              <div style={{ display: 'flex', justifyContent: 'end', gap: '8px', marginTop: '8px' }}>
                <Button type="button" variant="outline" onClick={() => setSelectedDocForVersion(null)} disabled={uploadingVersion}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={uploadingVersion}>
                  {uploadingVersion ? 'Pushing version…' : 'Push Version'}
                </Button>
              </div>
            </form>
          </>
        )}
      </Modal>
    </section>
  );
};
