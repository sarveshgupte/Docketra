import { useMemo, useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { bulkUploadApi } from '../../api/bulkUpload.api';

const TEMPLATES = {
  clients: ['businessName', 'businessAddress', 'primaryContactNumber', 'businessEmail', 'secondaryContactNumber', 'PAN', 'TAN', 'GST', 'CIN', 'contactPersonName', 'contactPersonDesignation', 'contactPersonPhoneNumber', 'contactPersonEmailAddress'],
  categories: ['name'],
  team: ['name', 'email', 'role'],
};

const buildTemplateCsv = (type) => `${(TEMPLATES[type] || []).join(',')}\n`;

export const BulkUploadModal = ({ isOpen, onClose, type, title, onImported, showToast }) => {
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const typeLabel = useMemo(() => title || 'Bulk Upload', [title]);

  const handleDownloadTemplate = () => {
    const csv = buildTemplateCsv(type);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${type}-bulk-template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    try {
      const csvContent = await file.text();
      const response = await bulkUploadApi.preview(type, csvContent);
      setPreview(response?.data || null);
    } catch (error) {
      setPreview(null);
      showToast(error?.response?.data?.error || error?.response?.data?.message || 'CSV preview failed', 'error');
    }
  };

  const handleImport = async () => {
    if (!preview?.valid?.length) {
      showToast('No valid rows available for import', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const response = await bulkUploadApi.confirm(type, preview.valid);
      showToast(response?.message || 'Import completed', 'success');
      onImported?.();
      setPreview(null);
      setFileName('');
      onClose();
    } catch (error) {
      showToast(error?.response?.data?.message || 'Import failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={typeLabel}>
      <div className="admin__create-form">
        <div className="neo-info-text">CSV headers must exactly match the template.</div>
        <div className="neo-form-actions">
          <Button type="button" variant="default" onClick={handleDownloadTemplate}>Download Template</Button>
          <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} />
        </div>
        {fileName ? <div className="neo-info-text">Selected: {fileName}</div> : null}

        {preview ? (
          <div>
            <div className="neo-info-text">
              Valid: {preview.summary?.validRows || 0} | Invalid: {preview.summary?.invalidRows || 0}
            </div>
            {preview.invalid?.length > 0 ? (
              <div style={{ maxHeight: 140, overflow: 'auto', marginTop: 8 }}>
                {preview.invalid.slice(0, 20).map((row) => (
                  <div key={`${row.row}-${row.error}`}>Row {row.row}: {row.error}</div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="neo-form-actions" style={{ marginTop: 16 }}>
          <Button type="button" variant="default" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="primary" onClick={handleImport} disabled={submitting || !preview?.valid?.length}>
            {submitting ? 'Importing...' : 'Import Valid Rows'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
