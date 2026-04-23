import { Button } from '../../components/common/Button';
import { Textarea } from '../../components/common/Textarea';
import { formatDateTime } from '../../utils/formatDateTime';

export const CaseDetailAttachmentsPanel = ({
  attachments,
  sectionLoading,
  selectedFile,
  uploadingFile,
  uploadProgress,
  fileDescription,
  onUploadFile,
  onFileSelect,
  onFileDescriptionChange,
}) => (
  <section className="case-card case-detail-section case-detail-section--attachments" id="panel-attachments" role="tabpanel" aria-labelledby="tab-attachments">
    <div className="case-card__heading case-detail-section__heading">
      <h2 id="attachments-heading">Attachments</h2>
      <p className="case-detail-section__subheading">Canonical document collection for this docket.</p>
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
        {attachments.map((attachment, index) => (
          <li key={attachment.id || attachment._id || index} className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-sm font-medium text-gray-900">{attachment.fileName || attachment.filename || 'Attachment'}</p>
            <p className="mt-1 text-xs text-gray-500">Uploaded {formatDateTime(attachment.createdAt || attachment.uploadedAt)}</p>
            <p className="mt-1 text-xs text-gray-500">By {attachment.createdByName || attachment.createdByXID || attachment.uploadedBy || attachment.createdBy || 'System'}</p>
            {attachment.description ? <p className="mt-1 text-xs text-gray-500">Comment: {attachment.description}</p> : null}
          </li>
        ))}
      </ul>
    ) : null}
  </section>
);
