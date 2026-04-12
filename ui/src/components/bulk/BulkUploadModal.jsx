import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { bulkUploadApi } from '../../api/bulkUpload.api';

const TEMPLATES = {
  clients: ['businessName', 'businessEmail', 'primaryContactNumber', 'contactPersonName'],
  categories: ['category', 'subcategory'],
  team: ['name', 'email', 'role', 'department'],
};

const TYPE_HELPER_TEXT = {
  team: ['Role must be Admin/User'],
  categories: ['Subcategory optional'],
  clients: ['Email required'],
};

const TYPE_FIELD_DESCRIPTIONS = {
  team: ['name: full name', 'email: work email', 'role: Admin or User', 'department: optional'],
  categories: ['category: top-level category', 'subcategory: optional nested value'],
  clients: ['businessName: client legal name', 'businessEmail: required', 'primaryContactNumber: optional', 'contactPersonName: optional'],
};

const DUPLICATE_MODES = [
  { value: 'skip', label: 'Skip duplicates' },
  { value: 'update', label: 'Update existing' },
  { value: 'fail', label: 'Fail on duplicates' },
];

const buildTemplateCsv = (type) => `${(TEMPLATES[type] || []).join(',')}\n`;

const fileToBase64 = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};

export const BulkUploadModal = ({ isOpen, onClose, type, title, onImported, showToast }) => {
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateMode, setDuplicateMode] = useState('skip');
  const [headerMapping, setHeaderMapping] = useState({});
  const [lastPayload, setLastPayload] = useState(null);
  const [job, setJob] = useState(null);

  const typeLabel = useMemo(() => title || 'Bulk Upload', [title]);
  const duplicateModes = useMemo(
    () => (type === 'categories'
      ? DUPLICATE_MODES.filter((mode) => mode.value !== 'update')
      : DUPLICATE_MODES),
    [type],
  );

  useEffect(() => {
    if (!job?.jobId || job?.status === 'completed' || job?.status === 'failed') return undefined;

    const interval = setInterval(async () => {
      try {
        const response = await bulkUploadApi.jobStatus(job.jobId);
        const data = response?.data;
        setJob({ ...data, jobId: job.jobId });
        if (['completed', 'failed'].includes(data?.status)) {
          clearInterval(interval);
          if (data?.status === 'completed') {
            showToast('Bulk import completed', 'success');
            onImported?.();
          } else {
            showToast('Bulk import failed', 'error');
          }
        }
      } catch (error) {
        clearInterval(interval);
        showToast(error?.response?.data?.message || 'Failed to track job status', 'error');
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [job?.jobId, job?.status, onImported, showToast]);

  useEffect(() => {
    if (type === 'categories' && duplicateMode === 'update') {
      setDuplicateMode('skip');
    }
  }, [type, duplicateMode]);

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

  const runPreview = async (payload) => {
    const response = await bulkUploadApi.preview(type, payload);
    setPreview(response?.data || null);
    setHeaderMapping(response?.data?.receivedHeaders?.reduce((acc, header) => {
      const selectedField = Object.entries(response?.data?.fieldIndexMap || {}).find(([, idx]) => response?.data?.receivedHeaders?.[idx] === header)?.[0];
      return { ...acc, [header]: selectedField || '' };
    }, {}) || {});
    setLastPayload(payload);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    try {
      const isCsv = file.name.toLowerCase().endsWith('.csv');
      const payload = isCsv
        ? { csvContent: await file.text(), duplicateMode }
        : { fileName: file.name, fileContentBase64: await fileToBase64(file), duplicateMode };
      await runPreview(payload);
    } catch (error) {
      setPreview(null);
      showToast(error?.response?.data?.error || error?.response?.data?.message || 'Preview failed', 'error');
    }
  };

  const handleRemap = async () => {
    if (!lastPayload) return;
    try {
      await runPreview({ ...lastPayload, duplicateMode, headerMapping });
    } catch (error) {
      showToast(error?.response?.data?.error || error?.response?.data?.message || 'Remapping failed', 'error');
    }
  };

  const handleImport = async () => {
    if (!preview?.valid?.length) {
      showToast('No valid rows available for import', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const response = await bulkUploadApi.confirm(type, preview.valid, duplicateMode, true);
      const jobId = response?.data?.jobId;
      if (jobId) {
        setJob({ jobId, status: 'processing', progress: 0, success: 0, failed: 0 });
        showToast('Import started. Tracking progress...', 'success');
      } else {
        showToast(response?.message || 'Import completed', 'success');
        onImported?.();
        onClose();
      }
    } catch (error) {
      showToast(error?.response?.data?.message || 'Import failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const progress = job?.progress || 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={typeLabel}>
      <div className="admin__create-form">
        <div className="neo-info-text">Supports CSV and XLSX. Column order can vary.</div>
        {(TYPE_HELPER_TEXT[type] || []).map((text) => (
          <div key={text} className="neo-info-text">{text}</div>
        ))}
        {(TYPE_FIELD_DESCRIPTIONS[type] || []).length ? (
          <div style={{ marginTop: 8 }}>
            <div className="neo-info-text">Template fields</div>
            {(TYPE_FIELD_DESCRIPTIONS[type] || []).map((entry) => (
              <div key={entry} className="neo-info-text">• {entry}</div>
            ))}
          </div>
        ) : null}
        <div className="neo-form-actions">
          <Button type="button" variant="default" onClick={handleDownloadTemplate}>Download Template</Button>
          <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFileUpload} />
        </div>
        <div style={{ marginTop: 8 }}>
          <label htmlFor="duplicateMode">Duplicate handling: </label>
          <select id="duplicateMode" value={duplicateMode} onChange={(e) => setDuplicateMode(e.target.value)}>
            {duplicateModes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
          </select>
        </div>

        {fileName ? <div className="neo-info-text">Selected: {fileName}</div> : null}

        {preview ? (
          <div>
            <div className="neo-info-text">
              Valid: {preview.summary?.validRows || 0} | Invalid: {preview.summary?.invalidRows || 0} | Skipped: {preview.summary?.skippedRows || 0}
            </div>
            {preview.receivedHeaders?.length ? (
              <div style={{ marginTop: 8 }}>
                <div className="neo-info-text">Column mapping</div>
                {preview.receivedHeaders.map((sourceHeader) => (
                  <div key={sourceHeader} style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <span style={{ minWidth: 180 }}>{sourceHeader}</span>
                    <select
                      value={headerMapping[sourceHeader] || ''}
                      onChange={(e) => setHeaderMapping((prev) => ({ ...prev, [sourceHeader]: e.target.value }))}
                    >
                      <option value="">Ignore</option>
                      {(TEMPLATES[type] || []).map((field) => <option key={field} value={field}>{field}</option>)}
                    </select>
                  </div>
                ))}
                <Button type="button" variant="default" onClick={handleRemap} style={{ marginTop: 8 }}>Apply Mapping</Button>
              </div>
            ) : null}
            {preview.invalid?.length > 0 ? (
              <div style={{ maxHeight: 140, overflow: 'auto', marginTop: 8 }}>
                {preview.invalid.slice(0, 20).map((row) => (
                  <div key={`${row.row}-${row.error}`}>Row {row.row}: {row.error}</div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {job ? (
          <div style={{ marginTop: 12 }}>
            <div className="neo-info-text">Job status: {job.status} ({progress}%)</div>
            <progress value={progress} max="100" style={{ width: '100%' }} />
            <div className="neo-info-text">Success: {job.success || 0} | Failed: {job.failed || 0}</div>
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
