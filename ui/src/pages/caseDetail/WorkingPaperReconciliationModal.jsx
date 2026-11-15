import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { caseApi } from '../../api/case.api';
import { formatDateTime } from '../../utils/formatDateTime';

const ShieldIcon = ({ className = 'h-4 w-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const SearchIcon = ({ className = 'h-3.5 w-3.5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

function parseCsv(text = '') {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };

  const parseRow = (line) => {
    const row = [];
    let insideQuotes = false;
    let field = '';
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        row.push(field.trim());
        field = '';
      } else {
        field += char;
      }
    }
    row.push(field.trim());
    return row;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);
  return { headers, rows };
}

export const WorkingPaperReconciliationModal = ({
  isOpen,
  onClose,
  attachment,
  caseId,
  isTraineeShieldActive = false,
  user = {},
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fileText, setFileText] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [filterQuery, setFilterQuery] = useState('');

  const filename = attachment?.fileName || attachment?.filename || 'working-paper';
  const fileExt = useMemo(() => filename.split('.').pop()?.toLowerCase() || '', [filename]);
  const isTabular = ['csv', 'tsv'].includes(fileExt);
  const isText = ['txt', 'json', 'xml', 'log'].includes(fileExt);
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(fileExt);
  const isPdf = fileExt === 'pdf';

  useEffect(() => {
    if (!isOpen || !attachment || !caseId) {
      setFileText(null);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setError(null);
      setFilterQuery('');
      return;
    }

    const attachmentId = attachment.id || attachment._id;
    let active = true;

    async function loadContent() {
      setLoading(true);
      setError(null);
      try {
        const response = await caseApi.getAttachmentBlob(caseId, attachmentId);
        if (!active) return;

        const blob = response?.data;
        if (!blob) throw new Error('No content returned');

        if (isTabular || isText) {
          const text = await blob.text();
          if (active) setFileText(text);
        } else if (isImage || isPdf) {
          const url = URL.createObjectURL(blob);
          if (active) setPreviewUrl(url);
        } else {
          setFileText(null);
        }
      } catch (err) {
        if (active) {
          setError(err?.message || 'Failed to load document content for reconciliation');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadContent();

    return () => {
      active = false;
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [isOpen, attachment, caseId, isTabular, isText, isImage, isPdf]);

  const parsedData = useMemo(() => {
    if (!isTabular || !fileText) return null;
    return parseCsv(fileText);
  }, [isTabular, fileText]);

  const filteredRows = useMemo(() => {
    if (!parsedData?.rows) return [];
    if (!filterQuery.trim()) return parsedData.rows;
    const q = filterQuery.toLowerCase();
    return parsedData.rows.filter((row) => row.some((cell) => String(cell).toLowerCase().includes(q)));
  }, [parsedData, filterQuery]);

  if (!isOpen || !attachment) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      title={`Reconciliation & Working Paper: ${filename}`}
      actions={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Uploaded {formatDateTime(attachment.createdAt || attachment.uploadedAt)}</span>
            <span>•</span>
            <span>By {attachment.createdByName || attachment.uploadedBy || 'Firm Staff'}</span>
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Trainee Shield Notice Banner */}
        {isTraineeShieldActive && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <div className="flex items-center gap-1.5 font-medium">
              <ShieldIcon className="h-4 w-4 text-amber-700 shrink-0" />
              <span>Trainee Laptop Shield: Safe Working-Paper Mode</span>
            </div>
            <span className="text-[11px] text-amber-800">
              Audited in-memory review • Personal laptop disk export restricted
            </span>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <p className="mt-3 text-xs font-medium">Streaming secure working paper from firm cloud storage…</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
            <p className="font-semibold">Unable to stream working paper</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {/* Tabular Spreadsheet / CSV View */}
        {!loading && !error && parsedData && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <SearchIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter rows (PAN, amount, invoice…)"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="w-full rounded-md border border-gray-200 pl-8 pr-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <span className="text-xs text-gray-500 font-mono">
                Showing {filteredRows.length} of {parsedData.rows.length} rows
              </span>
            </div>

            <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-200 bg-white">
              <table className="w-full text-left text-[11px] font-sans border-collapse">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                  <tr>
                    <th className="py-2 px-2.5 text-gray-500 font-medium text-center w-10">#</th>
                    {parsedData.headers.map((h, i) => (
                      <th key={i} className="py-2 px-3 text-gray-700 font-semibold uppercase tracking-wider">
                        {h || `Col ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-mono">
                  {filteredRows.slice(0, 250).map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-indigo-50/40 transition-colors">
                      <td className="py-1.5 px-2 text-center text-gray-400 select-none text-[10px]">{rIdx + 1}</td>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="py-1.5 px-3 text-gray-800 whitespace-nowrap max-w-xs truncate">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {filteredRows.length > 250 && (
                    <tr>
                      <td colSpan={parsedData.headers.length + 1} className="py-2 text-center text-xs text-gray-500 italic bg-gray-50">
                        Showing first 250 rows for in-memory reconciliation performance.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Text / JSON / XML View */}
        {!loading && !error && isText && fileText && (
          <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-200 bg-slate-900 p-3 text-xs font-mono text-slate-100">
            <pre className="whitespace-pre-wrap">{fileText}</pre>
          </div>
        )}

        {/* PDF / Image Safe Viewer */}
        {!loading && !error && previewUrl && (
          <div className="relative rounded-lg border border-gray-200 bg-gray-100 overflow-hidden max-h-[65vh] flex items-center justify-center p-2">
            {isPdf ? (
              <iframe
                src={`${previewUrl}#toolbar=0`}
                title={filename}
                className="w-full h-[60vh] rounded border-0"
              />
            ) : (
              <img
                src={previewUrl}
                alt={filename}
                className="max-h-[60vh] max-w-full object-contain rounded"
                onContextMenu={(e) => e.preventDefault()}
              />
            )}
            {isTraineeShieldActive && (
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-15 select-none"
                aria-hidden="true"
              >
                <span className="transform -rotate-45 text-2xl font-black uppercase tracking-widest text-slate-800">
                  DOCKETRA ENCLAVE • {user?.email || 'ARTICLE ASSISTANT'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Unsupported binary format summary */}
        {!loading && !error && !parsedData && !isText && !previewUrl && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
            <ShieldIcon className="mx-auto h-8 w-8 text-indigo-500 mb-2" />
            <h3 className="text-sm font-semibold text-gray-800">{filename}</h3>
            <p className="mt-1 text-xs text-gray-500 max-w-md mx-auto">
              This binary format is secured in firm cloud storage. To protect client confidentiality under Trainee Shield, direct export to personal laptops is disabled.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};
