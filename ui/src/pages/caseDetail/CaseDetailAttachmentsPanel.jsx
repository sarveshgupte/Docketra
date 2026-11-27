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
  onOpenRequestTab,
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

  const applySelectedFile = (file, fileEvent) => {
    if (!onFileSelect) return;
    onFileSelect(fileEvent || { target: { files: file ? [file] : [] } });
    if (file && /whatsapp|img-wa|vid-wa|aud-wa|wa-/i.test(file.name)) {
      setIntakeSource('WHATSAPP_FORWARD');
      if (!fileDescription && onFileDescriptionChange) {
        onFileDescriptionChange('Client document forwarded via WhatsApp');
      }
    }
  };

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
    if (file) {
      applySelectedFile(file);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    applySelectedFile(file, e);
  };

  const handleSubmit = (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!selectedFile) {
      showWarning('Select or drop a file to upload.');
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
    <section
      className="case-card case-detail-section case-detail-section--attachments"
      id="panel-attachments"
      role="tabpanel"
      aria-labelledby="tab-attachments"
    >
      <div className="case-card__heading case-detail-section__heading">
        <div>
          <p className="docket-section-kicker">Document Custody</p>
          <h2 id="attachments-heading">Attachments</h2>
          <p className="case-detail-section__subheading">Upload files, tag WhatsApp forwards, or inspect working papers in-app.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isTraineeShieldActive ? (
            <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900">
              Trainee Shield Active (Preview Only)
            </span>
          ) : null}
          {onOpenRequestTab ? (
            <Button variant="outline" size="sm" onClick={onOpenRequestTab}>
              Request from Client
            </Button>
          ) : null}
        </div>
      </div>

      <form className="rounded-md border border-slate-200 bg-slate-50/70 p-3.5" onSubmit={handleSubmit}>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative flex flex-col items-center justify-center rounded-md border-2 border-dashed p-4 text-center transition-colors ${
            isDragging
              ? 'border-blue-600 bg-blue-50/70'
              : selectedFile
                ? 'border-emerald-400 bg-emerald-50/40'
                : 'border-slate-300 bg-white hover:border-slate-400'
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
              <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-slate-800">
                Drag and drop files here, or{' '}
                <button
                  type="button"
                  onClick={() => document.getElementById('docket-attachment-input')?.click()}
                  className="rounded font-semibold text-blue-700 underline hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                >
                  browse files
                </button>
              </p>
              <p className="text-[11px] text-slate-500">
                Supports files from WhatsApp Web, Outlook, or your local drive
              </p>
            </div>
          ) : (
            <div className="flex w-full items-center justify-between gap-3 px-1">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-emerald-100 text-xs font-bold text-emerald-800" aria-hidden="true">
                  ✓
                </span>
                <div className="min-w-0 text-left">
                  <p className="truncate text-xs font-semibold text-slate-900">{selectedFile.name}</p>
                  <p className="text-[11px] tabular-nums text-slate-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB · Ready to upload
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                type="button"
                size="sm"
                onClick={() => applySelectedFile(null, { target: { files: [] } })}
                disabled={uploadingFile}
              >
                Change
              </Button>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-600">Intake Source:</span>
            <div className="inline-flex rounded-md bg-slate-200/80 p-0.5 text-[11px]" role="group" aria-label="Attachment intake source">
              <button
                type="button"
                aria-pressed={intakeSource === 'DIRECT_DESKTOP'}
                onClick={() => setIntakeSource('DIRECT_DESKTOP')}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  intakeSource === 'DIRECT_DESKTOP'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Direct / Desktop
              </button>
              <button
                type="button"
                aria-pressed={intakeSource === 'WHATSAPP_FORWARD'}
                onClick={() => {
                  setIntakeSource('WHATSAPP_FORWARD');
                  if (!fileDescription && onFileDescriptionChange) {
                    onFileDescriptionChange('Client document forwarded via WhatsApp');
                  }
                }}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  intakeSource === 'WHATSAPP_FORWARD'
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                WhatsApp Forward
              </button>
            </div>
          </div>
          {intakeSource === 'WHATSAPP_FORWARD' ? (
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-900">
              Tagged as WhatsApp Client Intake
            </span>
          ) : null}
        </div>

        <Textarea
          label="Attachment comment (required)"
          value={fileDescription}
          onChange={(event) => onFileDescriptionChange(event.target.value)}
          rows={2}
          className="mt-3"
          placeholder="e.g. Bank statement for FY 25-26, MCA filing receipt, client ledger..."
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Button variant="primary" type="submit" disabled={uploadingFile || !selectedFile || !fileDescription?.trim()}>
            {uploadingFile ? `Uploading${uploadProgress ? ` ${uploadProgress}%` : '…'}` : 'Upload attachment'}
          </Button>
          <span className="text-[11px] text-slate-500">
            Stored in firm cloud storage
          </span>
        </div>
      </form>

      {sectionLoading ? <p className="case-detail__empty-note mt-3">Loading attachments…</p> : null}
      {!sectionLoading && attachments.length === 0 ? (
        <p className="case-detail__empty-note mt-3">No attachments yet. Upload files or request documents from the client to store them here.</p>
      ) : null}

      {attachments.length > 0 ? (
        <ul className="mt-4 space-y-2.5">
          {attachments.map((attachment, index) => {
            const attachmentId = attachment.id || attachment._id || index;
            const isDownloading = downloadingId === (attachment.id || attachment._id);
            const fname = attachment.fileName || attachment.filename || '';
            const isTabular = /\.(csv|tsv|xlsx?|json)$/i.test(fname);
            const sourceUpper = String(attachment.source || '').toUpperCase();

            return (
              <li key={attachmentId} className="rounded-md border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="break-words text-sm font-medium text-slate-900">{fname || 'Attachment'}</p>
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    {(sourceUpper === 'WHATSAPP_FORWARD' || sourceUpper === 'WHATSAPP_INTAKE') ? (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900">
                        WhatsApp
                      </span>
                    ) : sourceUpper === 'CLIENT_UPLOAD' ? (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">
                        Client Portal
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="mt-1 text-xs tabular-nums text-slate-500">
                  Uploaded {formatDateTime(attachment.createdAt || attachment.uploadedAt)} · By{' '}
                  {attachment.createdByName || attachment.createdByXID || attachment.uploadedBy || attachment.createdBy || 'System'}
                </p>
                {attachment.description ? (
                  <p className="mt-1 text-xs text-slate-600">{attachment.description}</p>
                ) : null}

                <div className="mt-2.5 flex items-center gap-2 border-t border-slate-100 pt-2">
                  <button
                    type="button"
                    onClick={() => handleView(attachment)}
                    className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                  >
                    <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {isTabular ? 'Reconcile in-app' : 'Preview in-app'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(attachment)}
                    disabled={isDownloading}
                    aria-disabled={isTraineeShieldActive || undefined}
                    className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                      isTraineeShieldActive
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                    title={isTraineeShieldActive ? 'Download restricted by Trainee Laptop Shield. Use in-app preview.' : 'Download raw file'}
                  >
                    <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
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

      {reconcileAttachment ? (
        <WorkingPaperReconciliationModal
          isOpen={Boolean(reconcileAttachment)}
          onClose={() => setReconcileAttachment(null)}
          attachment={reconcileAttachment}
          caseId={caseId}
          isTraineeShieldActive={isTraineeShieldActive}
          user={user}
        />
      ) : null}
    </section>
  );
};
