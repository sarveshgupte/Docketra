import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { bulkUploadApi } from '../../api/bulkUpload.api';
import Papa from '../../../vendor/papaparse';
import { TYPE_FIELD_DESCRIPTIONS, TYPE_HELPER_TEXT } from '../../constants/bulkUploadConfig';
import { BULK_UPLOAD_SCHEMA, buildTemplateCsv, getBulkUploadFields, mapHeadersToSchema, validateRow } from '../../constants/bulkUploadSchema';

const DUPLICATE_MODES = [
  { value: 'skip', label: 'Skip duplicates' },
  { value: 'update', label: 'Update existing' },
  { value: 'fail', label: 'Fail on duplicates' },
];

const fileToBase64 = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};

const escapeCsvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const generateErrorCsv = (errors, rows, headers) => {
  const csvHeaders = ['row', ...headers, 'error'];
  const content = errors.map((entry) => {
    const rowData = rows.find((row) => row.rowIndex === entry.row)?.row || {};
    const rowValues = headers.map((header) => escapeCsvValue(rowData[header] || ''));
    return [entry.row, ...rowValues, escapeCsvValue(entry.error)].join(',');
  });
  return [csvHeaders.join(','), ...content].join('\n');
};

export const BulkUploadModal = ({ isOpen, onClose, type, title, onImported, showToast }) => {
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateMode, setDuplicateMode] = useState('skip');
  const [headerMapping, setHeaderMapping] = useState({});
  const [lastPayload, setLastPayload] = useState(null);
  const [job, setJob] = useState(null);
  const [clientValidationErrors, setClientValidationErrors] = useState([]);
  const [allValidationErrors, setAllValidationErrors] = useState([]);
  const [parsedRows, setParsedRows] = useState([]);
  const [parsedHeaders, setParsedHeaders] = useState([]);

  const typeLabel = useMemo(() => title || 'Bulk Upload', [title]);
  const schema = useMemo(() => BULK_UPLOAD_SCHEMA[type], [type]);
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

  const parseCsvRows = (csvContent) => {
    const result = Papa.parse(String(csvContent || ''), {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => String(header || '').trim(),
    });

    const headers = result.meta.fields || [];
    const rows = (result.data || []).map((row, index) => ({
      row,
      rowIndex: index + 2,
    }));

    return { headers, rows };
  };

  const runClientValidation = (csvContent) => {
    const { headers, rows } = parseCsvRows(csvContent);
    const { indexByField, missingRequired } = mapHeadersToSchema(type, headers);

    if (missingRequired.length) {
      return {
        blockingErrors: [`Missing required column(s): ${missingRequired.join(', ')}`],
        rowErrors: [],
      };
    }

    const rowErrors = rows
      .map(({ row, rowIndex }) => {
        const normalizedRow = Object.entries(indexByField).reduce((acc, [fieldKey, sourceIndex]) => {
          const sourceHeader = headers[sourceIndex];
          return { ...acc, [fieldKey]: row[sourceHeader] };
        }, {});

        const errors = validateRow(normalizedRow, type);
        if (!errors.length) return null;
        return { row: rowIndex, error: errors.join(', ') };
      })
      .filter(Boolean);

    return { blockingErrors: [], rowErrors };
  };

  const runPreview = async (payload) => {
    const response = await bulkUploadApi.preview(type, payload);
    setPreview(response?.data || null);
    const fieldKeys = (schema?.fields || []).map((field) => field.key);
    setHeaderMapping(response?.data?.receivedHeaders?.reduce((acc, header) => {
      const selectedField = Object.entries(response?.data?.fieldIndexMap || {}).find(([, idx]) => response?.data?.receivedHeaders?.[idx] === header)?.[0];
      return { ...acc, [header]: fieldKeys.includes(selectedField) ? selectedField : '' };
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

      if (isCsv) {
        const { headers, rows } = parseCsvRows(payload.csvContent);
        setParsedHeaders(headers);
        setParsedRows(rows);
        const validationResult = runClientValidation(payload.csvContent);
        setAllValidationErrors(validationResult.rowErrors);
        setClientValidationErrors(validationResult.rowErrors.slice(0, 5));
        if (validationResult.blockingErrors.length) {
          setPreview(null);
          showToast(validationResult.blockingErrors.join(' | '), 'error');
          return;
        }
        if (validationResult.rowErrors.length) {
          showToast(`CSV validation found ${validationResult.rowErrors.length} issue(s). Download error report to fix.`, 'error');
          return;
        }
      } else {
        setAllValidationErrors([]);
        setParsedRows([]);
        setParsedHeaders([]);
        setClientValidationErrors([]);
      }

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
    if ((preview?.summary?.invalidRows || 0) > 0) {
      showToast('Fix invalid rows before importing. Partial imports are blocked.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const response = await bulkUploadApi.confirm(type, preview.valid, duplicateMode, true, {
        sourcePayload: { ...(lastPayload || {}), headerMapping },
        validationSummary: preview.summary || {},
      });
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
        {getBulkUploadFields(type).length ? (
          <div style={{ marginTop: 8 }}>
            <div className="neo-info-text">Required fields: {getBulkUploadFields(type).filter((field) => field.required).map((field) => field.key).join(', ') || 'None'}</div>
          </div>
        ) : null}
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

        {clientValidationErrors.length ? (
          <div style={{ maxHeight: 140, overflow: 'auto', marginTop: 8 }}>
            <div className="neo-info-text">Missing/invalid fields detected (top 5)</div>
            {clientValidationErrors.map((entry) => (
              <div key={`${entry.row}-${entry.error}`}>Row {entry.row}: {entry.error}</div>
            ))}
          </div>
        ) : null}
        {allValidationErrors.length ? (
          <div style={{ marginTop: 8 }}>
            <Button
              type="button"
              variant="default"
              onClick={() => {
                const csv = generateErrorCsv(allValidationErrors, parsedRows, parsedHeaders);
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `${type}-bulk-errors.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
              }}
            >
              Download Error Report
            </Button>
          </div>
        ) : null}

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
                      {getBulkUploadFields(type).map((field) => <option key={field.key} value={field.key}>{field.key}</option>)}
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
          <Button type="button" variant="primary" onClick={handleImport} disabled={submitting || !preview?.valid?.length || allValidationErrors.length > 0}>
            {submitting ? 'Importing...' : 'Import Valid Rows'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
