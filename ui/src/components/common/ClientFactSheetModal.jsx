/**
 * Client Fact Sheet Modal Component
 * 
 * Displays client fact sheet in read-only mode from case view
 * Shows description, notes, files, Directors Registry, and Past Filings
 * Includes automated compliance deadlines linking past filings to statutory dates
 */

import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { API_BASE_URL } from '../../utils/constants';
import { formatDateTime } from '../../utils/formatDateTime';
import { formatDate } from '../../utils/formatDate';
import { clientApi } from '../../api/client.api';
import './ClientFactSheetModal.css';

export const ClientFactSheetModal = ({ isOpen, onClose, factSheet, caseId, client }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [copiedDin, setCopiedDin] = useState(null);
  const [syncingDeadlines, setSyncingDeadlines] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState(null);
  const [sendingAlarmFor, setSendingAlarmFor] = useState(null);
  const [alarmFeedback, setAlarmFeedback] = useState(null);

  if (!isOpen || !factSheet) return null;

  const handleViewFile = (fileId) => {
    const viewUrl = `${API_BASE_URL}/cases/${caseId}/client-fact-sheet/files/${fileId}/view`;
    window.open(viewUrl, '_blank');
  };

  const handleCopyDin = (din) => {
    if (!din) return;
    navigator.clipboard?.writeText(din);
    setCopiedDin(din);
    setTimeout(() => setCopiedDin(null), 2000);
  };

  const handleSyncDeadlines = async () => {
    const targetClientId = factSheet.clientId || client?.clientId;
    if (!targetClientId) return;
    setSyncingDeadlines(true);
    setSyncFeedback(null);
    try {
      const res = await clientApi.syncComplianceDeadlines(targetClientId);
      if (res?.success) {
        setSyncFeedback({ type: 'success', message: res.message || 'Compliance deadlines synced to calendar.' });
      } else {
        throw new Error(res?.message || 'Failed to sync deadlines');
      }
    } catch (err) {
      setSyncFeedback({ type: 'error', message: err.message || 'Failed to sync compliance deadlines' });
    } finally {
      setSyncingDeadlines(false);
    }
  };

  const handleSendAlarm = async (deadline) => {
    const targetClientId = factSheet.clientId || client?.clientId;
    if (!targetClientId || !deadline?.formName) return;
    setSendingAlarmFor(deadline.formName);
    setAlarmFeedback(null);
    try {
      const res = await clientApi.sendComplianceAlarm(targetClientId, {
        formName: deadline.formName,
        targetDirectors: deadline.targetDirectors || [],
      });
      if (!res?.success) throw new Error(res?.message || 'Failed to dispatch alarm');
      setAlarmFeedback({
        type: 'success',
        message: res.message || `Statutory alert for ${deadline.formName} dispatched via WhatsApp & Email.`,
      });
      setTimeout(() => setAlarmFeedback(null), 5000);
    } catch (err) {
      setAlarmFeedback({
        type: 'error',
        message: err.message || 'Failed to dispatch compliance alarm',
      });
    } finally {
      setSendingAlarmFor(null);
    }
  };

  const attachments = factSheet.attachments || factSheet.files || [];
  const hasContent = factSheet.description || (attachments && attachments.length > 0);
  const businessName = factSheet.businessName || client?.businessName;
  const clientId = factSheet.clientId || client?.clientId;
  const mcaDossier = factSheet.mcaDossier || client?.mcaDossier || null;

  const directors = mcaDossier?.directors || [];
  const pastFilings = mcaDossier?.pastFilings || [];
  const complianceDeadlines = mcaDossier?.complianceDeadlines || [];
  const charges = mcaDossier?.charges || [];
  const openCharges = charges.filter((c) => c.status === 'Open');
  const totalOpenAmount = openCharges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Client Fact Sheet"
      maxWidth="4xl"
      actions={(
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      )}
    >
      <div className="client-fact-sheet-modal">
        <div className="client-fact-sheet-header">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <h3>{businessName}</h3>
              <p className="client-id">{clientId} {mcaDossier?.cin ? `• CIN: ${mcaDossier.cin}` : ''} {mcaDossier?.roc ? `• ${mcaDossier.roc}` : ''}</p>
            </div>
            {mcaDossier?.companyStatus && (
              <span className="self-start md:self-auto px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                {mcaDossier.companyStatus}
              </span>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 mt-4 gap-1">
            <button
              type="button"
              className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all ${activeTab === 'overview' ? 'border-indigo-600 text-indigo-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              onClick={() => setActiveTab('overview')}
            >
              Overview & Documents ({attachments.length})
            </button>
            <button
              type="button"
              className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all ${activeTab === 'directors' ? 'border-indigo-600 text-indigo-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              onClick={() => setActiveTab('directors')}
            >
              Directors Registry ({directors.length})
            </button>
            <button
              type="button"
              className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all ${activeTab === 'filings' ? 'border-indigo-600 text-indigo-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              onClick={() => setActiveTab('filings')}
            >
              Past Filings ({pastFilings.length})
            </button>
            <button
              type="button"
              className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all ${activeTab === 'charges' ? 'border-indigo-600 text-indigo-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              onClick={() => setActiveTab('charges')}
            >
              Index of Charges ({charges.length})
            </button>
            <button
              type="button"
              className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all ${activeTab === 'deadlines' ? 'border-indigo-600 text-indigo-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              onClick={() => setActiveTab('deadlines')}
            >
              Compliance Deadlines ({complianceDeadlines.length})
            </button>
          </div>
        </div>

        {/* Tab 1: Overview & Documents */}
        {activeTab === 'overview' && (
          <div>
            {!hasContent && (
              <div className="no-content">
                <p>No fact sheet description or documents available for this client.</p>
              </div>
            )}

            <div className="client-fact-sheet-grid">
              <div className="fact-sheet-section">
                <h4>Description</h4>
                <div className="fact-sheet-updated-at">
                  Updated: {factSheet.updatedAt ? formatDateTime(factSheet.updatedAt) : 'Never'}
                </div>
                <div className="fact-sheet-content notes">
                  {factSheet.description || 'No description provided.'}
                </div>
              </div>

              <div className="fact-sheet-section">
                <h4>Documents</h4>
                <div className="files-list">
                  {attachments.length === 0 ? <p className="file-date">No documents attached.</p> : attachments.map((file) => (
                    <div key={file.fileId || file._id} className="file-item">
                      <div className="file-info">
                        <svg className="file-icon h-4 w-4 text-slate-500 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <div className="file-details">
                          <span className="file-name">{file.fileName}</span>
                          <span className="file-date">
                            Attached On: {file.uploadedAt ? formatDateTime(file.uploadedAt) : '—'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-view-file"
                        onClick={() => handleViewFile(file.fileId || file._id)}
                        title="View or download file (opens in new tab)"
                      >
                        <span aria-hidden="true">Open</span>
                        <span className="sr-only"> document {file.fileName}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Directors Registry */}
        {activeTab === 'directors' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-800">Board of Directors & Designated Signatories</h4>
                <p className="text-xs text-slate-500">Official DIN registration and signatory authority mapped from MCA21 registry.</p>
              </div>
              <span className="text-xs text-slate-400 font-mono">{directors.length} active records</span>
            </div>

            {directors.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-sm text-slate-600 font-medium">No directors registry data linked to this client yet.</p>
                <p className="text-xs text-slate-400 mt-1">Ensure the client has a valid CIN or PAN saved, then use "Sync MCA" to import registry details.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Director Name</th>
                      <th className="py-2.5 px-3">DIN</th>
                      <th className="py-2.5 px-3">Designation</th>
                      <th className="py-2.5 px-3">Appointment Date</th>
                      <th className="py-2.5 px-3">Signatory Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {directors.map((dir, idx) => (
                      <tr key={dir.din || idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{dir.name}</td>
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => handleCopyDin(dir.din)}
                            className="inline-flex items-center gap-1 font-mono text-[11px] bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded text-slate-700 transition"
                            title="Click to copy DIN"
                          >
                            <span>{dir.din}</span>
                            <span className="text-[10px] text-slate-400">{copiedDin === dir.din ? '✓' : '⧉'}</span>
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{dir.designation || 'Director'}</td>
                        <td className="py-2.5 px-3 text-slate-500">{dir.appointmentDate ? formatDate(dir.appointmentDate) : '—'}</td>
                        <td className="py-2.5 px-3">
                          {dir.isSignatory ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Signatory
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                              Director
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Past Filings */}
        {activeTab === 'filings' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-800">Historical MCA Statutory Filings</h4>
                <p className="text-xs text-slate-500">Record of annual returns, financial statements, and statutory intimations filed with the RoC.</p>
              </div>
              <span className="text-xs text-slate-400 font-mono">{pastFilings.length} filings recorded</span>
            </div>

            {pastFilings.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-sm text-slate-600 font-medium">No past statutory filings records found for this client.</p>
                <p className="text-xs text-slate-400 mt-1">Past filings will be imported automatically when the company is synced with MCA21.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Form</th>
                      <th className="py-2.5 px-3">Filing Title</th>
                      <th className="py-2.5 px-3">SRN</th>
                      <th className="py-2.5 px-3">Financial Year</th>
                      <th className="py-2.5 px-3">Filing Date</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pastFilings.map((filing, idx) => (
                      <tr key={filing.srn || idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3">
                          <span className="px-1.5 py-0.5 font-bold font-mono text-[11px] bg-indigo-100 text-indigo-800 border border-indigo-200 rounded">
                            {filing.formName}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{filing.formTitle || filing.formName}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">{filing.srn || '—'}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-600">{filing.financialYear || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-500">{filing.filingDate ? formatDate(filing.filingDate) : '—'}</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {filing.status || 'Approved'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Automated Compliance Deadlines */}
        {activeTab === 'deadlines' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
              <div>
                <h4 className="text-sm font-bold text-indigo-950">Automated Statutory Deadlines (Companies Act, 2013)</h4>
                <p className="text-xs text-indigo-700/80">Computed from past filings history, company class, and active directors.</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={handleSyncDeadlines}
                disabled={syncingDeadlines || !clientId}
              >
                {syncingDeadlines ? 'Syncing to Calendar…' : 'Sync Deadlines to Calendar'}
              </Button>
            </div>

            {syncFeedback && (
              <div className={`p-2.5 rounded-lg text-xs ${syncFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                {syncFeedback.message}
              </div>
            )}

            {alarmFeedback && (
              <div className={`p-2.5 rounded-lg text-xs ${alarmFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                {alarmFeedback.message}
              </div>
            )}

            {complianceDeadlines.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-sm text-slate-600 font-medium">No compliance deadlines calculated yet.</p>
                <p className="text-xs text-slate-400 mt-1">Click "Sync Deadlines to Calendar" to generate statutory deadlines under Companies Act, 2013.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Form</th>
                      <th className="py-2.5 px-3">Obligation</th>
                      <th className="py-2.5 px-3">Statutory Due Date</th>
                      <th className="py-2.5 px-3">Target FY</th>
                      <th className="py-2.5 px-3">Legal Basis</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Statutory Alarm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {complianceDeadlines.map((item, idx) => (
                      <tr key={item.formName + idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3">
                          <span className="px-1.5 py-0.5 font-bold font-mono text-[11px] bg-amber-100 text-amber-800 border border-amber-200 rounded">
                            {item.formName}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{item.title}</td>
                        <td className="py-2.5 px-3 font-bold text-indigo-700 font-mono">
                          {item.dueDate ? formatDate(item.dueDate) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-medium">{item.financialYear || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px] max-w-xs">{item.basis || 'Companies Act, 2013'}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${item.isSyncedToCalendar ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-600'}`}>
                            {item.isSyncedToCalendar ? '✓ Synced to Calendar' : 'Upcoming'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors disabled:opacity-50"
                            onClick={() => handleSendAlarm(item)}
                            disabled={sendingAlarmFor === item.formName}
                            title="Send statutory reminder alarm to client via WhatsApp and Email"
                          >
                            {sendingAlarmFor === item.formName ? 'Sending…' : '🔔 Send Alert'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Index of Charges & Lending Registry */}
        {activeTab === 'charges' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Index of Charges & Hypothecation Registry</h4>
                <p className="text-xs text-slate-500">Official registry of borrowing charges registered with RoC under Sec 77 & 78 of Companies Act, 2013.</p>
              </div>
              <span className="text-xs font-mono text-slate-500 font-medium">
                {charges.length} registered charges ({openCharges.length} active open)
              </span>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200/60">
                <span className="text-xs text-amber-800 block mb-0.5 font-medium">Total Open Debt Secured</span>
                <span className="text-base font-bold text-amber-950 font-mono">
                  {totalOpenAmount ? `₹${totalOpenAmount.toLocaleString('en-IN')}` : '₹0'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-xs text-slate-500 block mb-0.5 font-medium">Active Open Charges</span>
                <span className="text-base font-bold text-slate-900 font-mono">{openCharges.length}</span>
              </div>
              <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-200/60">
                <span className="text-xs text-emerald-800 block mb-0.5 font-medium">Satisfied / Closed Charges</span>
                <span className="text-base font-bold text-emerald-950 font-mono">{charges.length - openCharges.length}</span>
              </div>
            </div>

            {charges.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-sm text-slate-600 font-medium">No registered charges found for this company.</p>
                <p className="text-xs text-slate-400 mt-1">Free of encumbrances or no banking charges registered under Section 77.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Charge ID</th>
                      <th className="py-2.5 px-3">Lender / Charge Holder</th>
                      <th className="py-2.5 px-3">Amount (₹)</th>
                      <th className="py-2.5 px-3">Creation Date</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Hypothecated Assets & Instrument</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {charges.map((charge, idx) => (
                      <tr key={charge.chargeId || idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                          {charge.chargeId || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {charge.chargeHolder}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {charge.amount ? `₹${Number(charge.amount).toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono">
                          {charge.dateOfCreation ? formatDate(charge.dateOfCreation) : '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${charge.status === 'Open' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}`}>
                            {charge.status || 'Open'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 max-w-xs text-slate-600">
                          <div className="text-[11px] font-medium text-slate-800">{charge.instrumentType || 'Hypothecation'}</div>
                          <div className="text-[10px] text-slate-500 truncate" title={charge.assetHypothecated}>{charge.assetHypothecated || '—'}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
