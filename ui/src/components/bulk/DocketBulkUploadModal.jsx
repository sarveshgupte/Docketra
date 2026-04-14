import { useMemo, useState } from 'react';
import Papa from '../../../vendor/papaparse';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { docketBulkUploadApi } from '../../api/docketBulkUpload.api';

const TEMPLATE_CSV = [
  'title,description,category,subcategory,workbasket,priority',
  'GST filing follow-up,Follow up with client,Compliance,GST Filing,Compliance Team,HIGH',
  'Prepare ROC forms,Q1 filing pack,Compliance,ROC Filing,Compliance Team,MEDIUM',
].join('\n');

const REQUIRED_COLUMNS = ['title', 'workbasket'];

const parseCsv = (content = '') => {
  const parsed = Papa.parse(String(content || ''), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => String(header || '').trim(),
  });

  return (parsed.data || []).map((row) => ({
    title: row.title,
    description: row.description,
    category: row.category,
    subcategory: row.subcategory,
    workbasket: row.workbasket,
    priority: row.priority,
  }));
};

const toErrorCsv = (invalidRows = []) => {
  const headers = ['rowIndex', 'errors'];
  const lines = invalidRows.map((row) => `${row.rowIndex},"${(row.errors || []).join(' | ').replace(/"/g, '""')}"`);
  return [headers.join(','), ...lines].join('\n');
};

export const DocketBulkUploadModal = ({ isOpen, onClose, showToast, onUploaded }) => {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadValidRowsOnly, setUploadValidRowsOnly] = useState(true);
  const [rejectOnInvalid, setRejectOnInvalid] = useState(false);
  const [result, setResult] = useState(null);

  const invalidRows = useMemo(() => (preview?.results || []).filter((entry) => !entry.isValid), [preview]);
  const validRows = useMemo(() => (preview?.results || []).filter((entry) => entry.isValid), [preview]);

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'dockets-bulk-template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handlePreview = async (nextRows) => {
    setLoadingPreview(true);
    setResult(null);
    try {
      const response = await docketBulkUploadApi.preview({ rows: nextRows });
      setPreview(response?.data || null);
      const invalidCount = response?.data?.summary?.invalidRows || 0;
      if (invalidCount > 0) {
        showToast(`${invalidCount} rows have errors`, 'error');
      }
    } catch (error) {
      showToast(error?.response?.data?.message || 'Preview failed', 'error');
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleFileInput = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const content = await file.text();
    const parsedRows = parseCsv(content);
    const missing = REQUIRED_COLUMNS.filter((key) => !Object.keys(parsedRows[0] || {}).includes(key));
    if (missing.length) {
      showToast(`Missing required column(s): ${missing.join(', ')}`, 'error');
      return;
    }

    setRows(parsedRows);
    setFileName(file.name);
    await handlePreview(parsedRows);
  };

  const handleUpload = async () => {
    if (!preview?.results?.length) {
      showToast('Preview rows first', 'error');
      return;
    }
    if (validRows.length === 0) {
      showToast('All rows are invalid. Fix the CSV and re-upload.', 'error');
      return;
    }

    setUploading(true);
    try {
      const response = await docketBulkUploadApi.upload({
        rows,
        uploadValidRowsOnly,
        rejectOnInvalid,
      });
      setResult(response?.data || null);
      showToast(`Bulk upload finished. Created ${response?.data?.created || 0} dockets.`, 'success');
      onUploaded?.();
    } catch (error) {
      showToast(error?.response?.data?.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bulk Upload Dockets">
      <div className="admin__create-form">
        <div className="neo-info-text">Step 1: Upload CSV</div>
        <div className="neo-info-text">Step 2: Preview Table</div>
        <div className="neo-info-text">Step 3: Fix Errors</div>
        <div className="neo-info-text">Step 4: Confirm Upload</div>

        <div className="neo-form-actions" style={{ marginTop: 8 }}>
          <Button type="button" variant="default" onClick={downloadTemplate}>Download Template</Button>
          <input type="file" accept=".csv,text/csv" onChange={handleFileInput} />
        </div>
        {fileName ? <div className="neo-info-text">Selected file: {fileName}</div> : null}

        {preview ? (
          <>
            <div className="neo-info-text" style={{ marginTop: 8 }}>
              Total: {preview.summary?.totalRows || 0} | Valid: {preview.summary?.validRows || 0} | Invalid: {preview.summary?.invalidRows || 0}
            </div>

            {invalidRows.length > 0 ? (
              <div className="neo-info-text" style={{ color: '#b91c1c' }}>{invalidRows.length} rows have errors</div>
            ) : null}

            <div style={{ maxHeight: 220, overflow: 'auto', marginTop: 8, border: '1px solid #ddd' }}>
              <table style={{ width: '100%', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Row #</th>
                    <th>Title</th>
                    <th>Workbasket</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {(preview.results || []).map((row) => (
                    <tr key={row.rowIndex} style={{ background: row.isValid ? 'transparent' : '#fee2e2' }}>
                      <td>{row.rowIndex}</td>
                      <td>{row.normalizedData?.title || rows[row.rowIndex - 1]?.title || '-'}</td>
                      <td>{row.normalizedData?.workbasketName || rows[row.rowIndex - 1]?.workbasket || '-'}</td>
                      <td>{row.normalizedData?.category || rows[row.rowIndex - 1]?.category || '-'}</td>
                      <td>{row.isValid ? 'Valid' : 'Invalid'}</td>
                      <td>{(row.errors || []).join(', ') || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {invalidRows.length > 0 ? (
              <Button
                type="button"
                variant="default"
                onClick={() => {
                  const blob = new Blob([toErrorCsv(invalidRows)], { type: 'text/csv;charset=utf-8;' });
                  const url = window.URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute('download', 'docket-bulk-errors.csv');
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  window.URL.revokeObjectURL(url);
                }}
                style={{ marginTop: 8 }}
              >
                Download Error Report
              </Button>
            ) : null}

            <div style={{ marginTop: 8 }}>
              <label>
                <input type="checkbox" checked={uploadValidRowsOnly} onChange={(e) => setUploadValidRowsOnly(e.target.checked)} /> Upload Valid Rows Only
              </label>
            </div>
            <div style={{ marginTop: 4 }}>
              <label>
                <input type="checkbox" checked={rejectOnInvalid} onChange={(e) => setRejectOnInvalid(e.target.checked)} /> Reject upload if any invalid rows exist
              </label>
            </div>
          </>
        ) : null}

        {(loadingPreview || uploading) ? <div className="neo-info-text" style={{ marginTop: 10 }}>Processing...</div> : null}

        {result ? (
          <div className="neo-info-text" style={{ marginTop: 8 }}>
            Upload summary — Success: {result.created || 0}, Failed: {result.failed || 0}
          </div>
        ) : null}

        <div className="neo-form-actions" style={{ marginTop: 16 }}>
          <Button type="button" variant="default" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleUpload}
            disabled={uploading || validRows.length === 0}
          >
            {uploading ? 'Uploading...' : 'Confirm Upload'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
