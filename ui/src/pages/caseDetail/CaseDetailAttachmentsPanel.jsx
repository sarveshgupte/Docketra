import React, { useState } from 'react';
import { Button } from '../../components/common/Button';
import { Textarea } from '../../components/common/Textarea';
import { formatDateTime } from '../../utils/formatDateTime';
import { caseApi } from '../../api/case.api';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import { isFirmManagerOrAbove } from '../../utils/permissions';
import { getFirmConfig } from '../../utils/firmConfig';
import { WorkingPaperReconciliationModal } from './WorkingPaperReconciliationModal';

export const CaseDetailAttachmentsPanel = ({
  caseId,
  attachments = [],
  sectionLoading = false,
  selectedFile = null,
  uploadingFile = false,
  uploadProgress = 0,
  fileDescription = '',
  onUploadFile,
  onFileSelect,
  onFileDescriptionChange,
}) => {
  const { showError, showWarning } = useToast();
  const { user } = useAuth();
  const [downloadingId, setDownloadingId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [intakeSource, setIntakeSource] = useState('DIRECT_DESKTOP');
  const [reconcileAttachment, setReconcileAttachment] = useState(null);

  const firmConfig = getFirmConfig();
  const isManagerOrAbove = isFirmManagerOrAbove(user);
  const isTraineeShieldActive = Boolean(firmConfig.restrictTraineeDownloads) && !isManagerOrAbove;

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && onFileSelect) {
      onFileSelect({ target: { files: [file] } });
      if (/whatsapp|img-wa|vid-wa|aud-wa|wa-/i.test(file.name)) {
        setIntakeSource('WHATSAPP_FORWARD');
        if (!fileDescription && onFileDescriptionChange) {
          onFileDescriptionChange('Client document forwarded via WhatsApp');
        }
      }
    }
  };

  const handleFileChange = (e) => {
    if (onFileSelect) {
      onFileSelect(e);
      const file = e.target.files?.[0];
      if (file && /whatsapp|img-wa|vid-wa|aud-wa|wa-/i.test(file.name)) {
        setIntakeSource('WHATSAPP_FORWARD');
        if (!fileDescription && onFileDescriptionChange) {
          onFileDescriptionChange('Client document forwarded via WhatsApp');
        }
      }
    }
  };

  const handleSubmit = (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!selectedFile) {
      showWarning('Please select or drop a file to upload');
      return;
    }
    const source = intakeSource === 'WHATSAPP_FORWARD' ? 'WHATSAPP_FORWARD' : 'upload';
    if (onUploadFile) {
      onUploadFile(e, {
        file: selectedFile,
        description: fileDescription,
        source,
      });
    }
  };

  const handleView = (attachment) => {
    const attachmentId = attachment?.id || attachment?._id;
    if (!caseId || !attachmentId) return;
    setReconcileAttachment(attachment);
  };

  const handleDownload = async (attachment) => {
    const attachmentId = attachment.id || attachment._id;
    const filename = attachment.fileName || attachment.filename || 'attachment';
    if (!caseId || !attachmentId) return;

    if (isTraineeShieldActive) {
      showWarning('Trainee Laptop Shield is active for your firm. File downloads to local laptops are restricted for article assistants. Please use in-app document preview.');
      return;
    }

    try {
      setDownloadingId(attachmentId);
      await caseApi.downloadAttachment(caseId, attachmentId, filename);
    } catch (err) {
      if (err?.code === 'TRAINEE_DOWNLOAD_RESTRICTED' || err?.message?.includes('Trainee Laptop Shield')) {
        showWarning('Trainee Laptop Shield is active: Raw client file downloads to personal devices are restricted for junior staff. Please use in-app document preview.');
      } else {
        showError(err?.message || 'Failed to download attachment');
      }
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <section className="case-card case-detail-section case-detail-section--attachments" id="panel-attachments" role="tabpanel" aria-labelledby="tab-attachments">
      <div className="case-card__heading case-detail-section__heading">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="attachments-heading">Attachments</h2>
            <p className="case-detail-section__subheading">Canonical document collection for this docket.</p>
          </div>
          {isTraineeShieldActive && (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              <svg className="h-3 w-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-13a9 9 0 00-9 9c0 5 9 13 9 13s9-8 9-13a9 9 0 00-9-9z" />
              </svg>
              Trainee Shield Active (Preview Only)
            </span>
          )}
        </div>
      </div>
      <p className="mb-3 text-xs text-gray-500">All docket document collection lives here. Upload files and retain metadata with the docket execution record.</p>

      {/* Desktop Intake Tray & Drag-and-Drop Dropzone */}
      <form className="rounded-xl border border-gray-200 bg-gray-50 p-3.5" onSubmit={handleSubmit}>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-all ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/80 ring-2 ring-indigo-200'
              : selectedFile
              ? 'border-emerald-300 bg-emerald-50/30'
              : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50/50'
          }`}
        >
          <input
            type="file"
            className="hidden"
            id="docket-attachment-input"
            onChange={handleFileChange}
            disabled={uploadingFile}
          />

          {!selectedFile ? (
            <div className="space-y-1">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-gray-800">
                Drag &amp; drop files here, or{' '}
                <button
                  type="button"
                  onClick={() => document.getElementById('docket-attachment-input')?.click()}
                  className="text-indigo-600 hover:text-indigo-700 underline font-semibold"
                >
                  browse files
                </button>
              </p>
              <p className="text-[11px] text-gray-500">
                Drop downloads directly from WhatsApp Web, Outlook, or your local drive
              </p>
            </div>
          ) : (
            <div className="flex w-full items-center justify-between gap-3 px-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-emerald-100 text-emerald-800 text-xs font-bold">
                  ✓
                </span>
                <div className="text-left min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate">{selectedFile.name}</p>
                  <p className="text-[10px] text-gray-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB • Ready to link to docket
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                type="button"
                size="sm"
                onClick={() => {
                  onFileSelect?.({ target: { files: [] } });
                }}
                disabled={uploadingFile}
              >
                Change
              </Button>
            </div>
          )}
        </div>

        {/* Intake Channel Selector */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200/80 pt-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-600">Intake Source:</span>
            <div className="inline-flex rounded-md bg-gray-200/80 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setIntakeSource('DIRECT_DESKTOP')}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  intakeSource === 'DIRECT_DESKTOP'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Direct / Desktop
              </button>
              <button
                type="button"
                onClick={() => {
                  setIntakeSource('WHATSAPP_FORWARD');
                  if (!fileDescription && onFileDescriptionChange) {
                    onFileDescriptionChange('Client document forwarded via WhatsApp');
                  }
                }}
                className={`flex items-center gap-1 rounded px-2.5 py-1 font-medium transition-colors ${
                  intakeSource === 'WHATSAPP_FORWARD'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>WhatsApp Forward</span>
              </button>
            </div>
          </div>
          {intakeSource === 'WHATSAPP_FORWARD' && (
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              Tagged as WhatsApp Client Intake
            </span>
          )}
        </div>

        <Textarea
          label="Attachment comment (required)"
          value={fileDescription}
          onChange={(event) => onFileDescriptionChange(event.target.value)}
          rows={2}
          className="mt-3"
          placeholder="e.g. Bank statement for FY 25-26, MCA filing receipt, client ledger..."
        />

        <div className="mt-3 flex items-center justify-between gap-2">
          <Button variant="primary" type="submit" disabled={uploadingFile || !selectedFile}>
            {uploadingFile ? `Uploading${uploadProgress ? ` ${uploadProgress}%` : '…'}` : 'Upload attachment'}
          </Button>
          <span className="text-[11px] text-gray-500 font-mono">
            Encrypted in sovereign firm cloud storage
          </span>
        </div>
      </form>

      {sectionLoading ? <p className="case-detail__empty-note mt-3">Loading attachments…</p> : null}
      {!sectionLoading && attachments.length === 0 ? (
        <p className="case-detail__empty-note mt-3">No attachments yet. Document collection belongs in this docket’s Attachments tab.</p>
      ) : null}

      {attachments.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {attachments.map((attachment, index) => {
            const attachmentId = attachment.id || attachment._id || index;
            const isDownloading = downloadingId === (attachment.id || attachment._id);
            const fname = attachment.fileName || attachment.filename || '';
            const isTabular = /\.(csv|tsv|xlsx?|json)$/i.test(fname);

            return (
              <li key={attachmentId} className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">{attachment.fileName || attachment.filename || 'Attachment'}</p>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {(String(attachment.source || '').toUpperCase() === 'WHATSAPP_FORWARD' || String(attachment.source || '').toLowerCase() === 'whatsapp_intake') ? (
                      <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        WhatsApp
                      </span>
                    ) : String(attachment.source || '').toUpperCase() === 'CLIENT_UPLOAD' ? (
                      <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        Client Portal
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">Uploaded {formatDateTime(attachment.createdAt || attachment.uploadedAt)}</p>
                <p className="mt-1 text-xs text-gray-500">By {attachment.createdByName || attachment.createdByXID || attachment.uploadedBy || attachment.createdBy || 'System'}</p>
                {attachment.description ? <p className="mt-1 text-xs text-gray-500">Comment: {attachment.description}</p> : null}
                
                <div className="mt-3 flex items-center gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => handleView(attachment)}
                    className="inline-flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                  >
                    <svg className="h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {isTabular ? 'Reconcile in-app' : 'Preview in-app'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(attachment)}
                    disabled={isDownloading}
                    className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition-colors ${
                      isTraineeShieldActive
                        ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    title={isTraineeShieldActive ? 'Download restricted by Trainee Laptop Shield. Please use in-app preview.' : 'Download raw file'}
                  >
                    <svg className="h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {isDownloading ? 'Downloading…' : isTraineeShieldActive ? 'Download restricted' : 'Download'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* Safe Working-Paper / Spreadsheet Reconciliation Modal */}
      {reconcileAttachment && (
        <WorkingPaperReconciliationModal
          isOpen={Boolean(reconcileAttachment)}
          onClose={() => setReconcileAttachment(null)}
          attachment={reconcileAttachment}
          caseId={caseId}
          isTraineeShieldActive={isTraineeShieldActive}
          user={user}
        />
      )}
    </section>
  );
};
