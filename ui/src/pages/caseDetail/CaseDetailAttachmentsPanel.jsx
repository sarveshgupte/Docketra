import React, { useState } from 'react';
import { Button } from '../../components/common/Button';
import { Textarea } from '../../components/common/Textarea';
import { formatDateTime } from '../../utils/formatDateTime';
import { caseApi } from '../../api/case.api';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import { isFirmManagerOrAbove } from '../../utils/permissions';
import { getFirmConfig } from '../../utils/firmConfig';

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

  const firmConfig = getFirmConfig();
  const isManagerOrAbove = isFirmManagerOrAbove(user);
  const isTraineeShieldActive = Boolean(firmConfig.restrictTraineeDownloads) && !isManagerOrAbove;

  const handleView = (attachment) => {
    const attachmentId = attachment.id || attachment._id;
    if (!caseId || !attachmentId) return;
    caseApi.viewAttachment(caseId, attachmentId);
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
      <form className="rounded-xl border border-gray-200 bg-gray-50 p-3" onSubmit={onUploadFile}>
        <div className="flex flex-wrap items-center gap-2">
          <input type="file" className="hidden" id="docket-attachment-input" onChange={onFileSelect} />
          <Button variant="outline" type="button" onClick={() => document.getElementById('docket-attachment-input')?.click()} disabled={uploadingFile}>
            Select file
          </Button>
          <span className="text-xs text-gray-500">{selectedFile?.name || 'No file selected'}</span>
        </div>
        <Textarea
          label="Attachment comment (required)"
          value={fileDescription}
          onChange={(event) => onFileDescriptionChange(event.target.value)}
          rows={3}
          className="mt-3"
        />
        <div className="mt-3">
          <Button variant="primary" type="submit" disabled={uploadingFile || !selectedFile}>
            {uploadingFile ? `Uploading${uploadProgress ? ` ${uploadProgress}%` : '…'}` : 'Upload attachment'}
          </Button>
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
                    Preview in-app
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
    </section>
  );
};
