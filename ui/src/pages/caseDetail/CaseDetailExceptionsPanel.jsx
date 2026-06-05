import React, { useState, useEffect, useCallback } from 'react';
import { docketExceptionApi } from '../../api/docketException.api';
import { Button } from '../../components/common/Button';
import { Textarea } from '../../components/common/Textarea';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../hooks/useToast';
import { formatDateTime } from '../../utils/formatDateTime';
import { formatDate } from '../../utils/formatters';

export const CaseDetailExceptionsPanel = ({ caseInternalId, onRefreshCase }) => {
  const { showSuccess, showError } = useToast();
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logging, setLogging] = useState(false);

  // Form States for logging a new exception
  const [exceptionType, setExceptionType] = useState('portal_issue');
  const [description, setDescription] = useState('');
  const [ticketNumber, setTicketNumber] = useState('');
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 10));
  const [revisedEta, setRevisedEta] = useState('');

  const loadExceptions = useCallback(async () => {
    if (!caseInternalId || caseInternalId.length !== 24) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await docketExceptionApi.getDocketExceptions({ caseInternalId });
      if (response.success && Array.isArray(response.data)) {
        setExceptions(response.data);
      }
    } catch (err) {
      showError('Failed to load compliance blockers: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [caseInternalId, showError]);

  useEffect(() => {
    loadExceptions();
  }, [loadExceptions]);

  const handleLogException = async (e) => {
    e.preventDefault();
    if (!description) {
      showError('Please write a blocker description.');
      return;
    }

    setLogging(true);
    try {
      const payload = {
        caseInternalId,
        exceptionType,
        description,
        ticketNumber: ticketNumber || undefined,
        occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
        revisedETA: revisedEta ? new Date(revisedEta) : undefined,
      };

      const res = await docketExceptionApi.createDocketException(payload);
      if (res.success) {
        showSuccess('Blocker exception successfully logged!');
        setShowLogModal(false);
        // Reset form
        setExceptionType('portal_issue');
        setDescription('');
        setTicketNumber('');
        setOccurredAt(new Date().toISOString().slice(0, 10));
        setRevisedEta('');
        loadExceptions();
        if (onRefreshCase) onRefreshCase();
      }
    } catch (err) {
      showError('Failed to log blocker: ' + (err.response?.data?.message || err.message));
    } finally {
      setLogging(false);
    }
  };

  const handleResolveException = async (id, status = 'resolved') => {
    try {
      const res = await docketExceptionApi.updateDocketException(id, { status });
      if (res.success) {
        showSuccess(`Blocker marked as ${status}!`);
        loadExceptions();
        if (onRefreshCase) onRefreshCase();
      }
    } catch (err) {
      showError('Failed to resolve exception: ' + err.message);
    }
  };

  const formatTypeLabel = (type) => {
    const map = {
      portal_issue: 'Regulatory Portal Issue',
      query_raised: 'Clarification Query Raised',
      DSC_authorisation_pending: 'DSC / Authorisation Pending',
      client_delay: 'Client Document Delay',
      payment_pending: 'Government Fee Payment Pending',
      data_mismatch: 'Client Data Mismatch',
      other: 'Other Blocker Exception',
    };
    return map[type] || String(type).replace('_', ' ');
  };

  const getTypeBadgeClass = (type) => {
    const map = {
      portal_issue: 'bg-rose-100 text-rose-800 border-rose-200',
      query_raised: 'bg-amber-100 text-amber-800 border-amber-200',
      DSC_authorisation_pending: 'bg-violet-100 text-violet-800 border-violet-200',
      client_delay: 'bg-orange-100 text-orange-800 border-orange-200',
      payment_pending: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      data_mismatch: 'bg-purple-100 text-purple-800 border-purple-200',
      other: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return map[type] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusLabelClass = (status) => {
    const s = String(status).toLowerCase();
    if (s === 'open') return 'text-red-700 bg-red-50 border-red-200';
    if (s === 'monitoring') return 'text-amber-700 bg-amber-50 border-amber-200';
    if (s === 'resolved') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    return 'text-gray-700 bg-gray-50 border-gray-200'; // closed_no_action
  };

  const getEtaLabel = (eta) => {
    if (!eta) return 'No ETA specified';
    const dueDate = new Date(eta);
    const now = new Date();
    dueDate.setHours(0,0,0,0);
    now.setHours(0,0,0,0);
    
    const diff = dueDate - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) return <span className="text-rose-600 font-semibold">Overdue by {Math.abs(days)} day(s)</span>;
    if (days === 0) return <span className="text-orange-500 font-semibold">Due today</span>;
    return <span className="text-gray-700">{days} day(s) remaining (ETA: {formatDate(eta)})</span>;
  };

  return (
    <section className="case-card case-detail-section" id="panel-exceptions" role="tabpanel">
      <div className="case-card__heading case-detail-section__heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Blockers & Exception Log</h2>
          <p className="case-detail-section__subheading">Log portal downtime, DSC issues, or regulatory queries blocking compliance filing execution.</p>
        </div>
        <Button onClick={() => setShowLogModal(true)} variant="primary">
          ✚ Log Blocker Exception
        </Button>
      </div>

      {loading ? (
        <p className="case-detail__empty-note mt-3">Loading exceptions log…</p>
      ) : exceptions.length === 0 ? (
        <div className="text-center py-8 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 mt-3">
          <span className="text-3xl">⚠️</span>
          <p className="mt-2 text-sm text-gray-500 font-medium">No blocker exceptions currently logged on this compliance docket.</p>
          <p className="text-xs text-gray-400 mt-1">Filing proceeding smoothly? Nice. If portal issues or client delays arise, log them here.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {exceptions.map((exc) => {
            const isOpen = exc.status === 'open' || exc.status === 'monitoring';
            return (
              <div key={exc._id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow transition-shadow">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getTypeBadgeClass(exc.exceptionType)}`}>
                        {formatTypeLabel(exc.exceptionType)}
                      </span>
                      <span className={`text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded border ${getStatusLabelClass(exc.status)}`}>
                        {exc.status.replace('_', ' ')}
                      </span>
                    </div>
                    {exc.ticketNumber && (
                      <p className="text-[10px] font-mono text-gray-500 mt-1.5">
                        <strong>Ticket / Ref Number:</strong> {exc.ticketNumber}
                      </p>
                    )}
                    <p className="text-xs text-gray-800 mt-2 font-medium leading-relaxed">
                      {exc.description}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-2">
                      Occurred: {formatDate(exc.occurredAt)} · Logger: {exc.ownerXID || 'System'}
                    </p>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end', gap: '8px' }}>
                    <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                      📅 {getEtaLabel(exc.revisedETA)}
                    </div>
                    {isOpen && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {exc.status === 'open' && (
                          <Button variant="outline" size="small" onClick={() => handleResolveException(exc._id, 'monitoring')}>
                            🔍 Monitor Blocker
                          </Button>
                        )}
                        <Button variant="outline" size="small" onClick={() => handleResolveException(exc._id, 'resolved')}>
                          ✓ Mark Resolved
                        </Button>
                        <Button variant="outline" size="small" onClick={() => handleResolveException(exc._id, 'closed_no_action')}>
                          ✖ Close (No action)
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Log Blocker Exception */}
      <Modal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        title="Log Blocker Exception"
        size="sm"
      >
        <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '16px' }}>
          Log regulatory portal issues, client action delay blockers, or expired DSCs. This dynamically overrides client portal status views.
        </p>
        <form onSubmit={handleLogException} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label className="field-label" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Blocker Category *</label>
            <select className="neo-input w-full text-sm mt-1" value={exceptionType} onChange={e => setExceptionType(e.target.value)}>
              <option value="portal_issue">Regulatory Portal Downtime / Tech Issue</option>
              <option value="query_raised">Regulatory Clarification Query Raised</option>
              <option value="DSC_authorisation_pending">DSC Authorization Pending from Client</option>
              <option value="client_delay">Client Document / Asset Delivery Delay</option>
              <option value="payment_pending">Government Fee / Challan Payment Pending</option>
              <option value="data_mismatch">Data Mismatch in Client Records</option>
              <option value="other">Other Blocker Exception</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="field-label" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Occurred At Date *</label>
              <input type="date" className="neo-input w-full text-sm mt-1" value={occurredAt} onChange={e => setOccurredAt(e.target.value)} required />
            </div>
            <div>
              <label className="field-label" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Revised Filing ETA</label>
              <input type="date" className="neo-input w-full text-sm mt-1" value={revisedEta} onChange={e => setRevisedEta(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="field-label" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Portal Reference / Ticket Number (optional)</label>
            <input type="text" className="neo-input w-full text-sm mt-1" value={ticketNumber} onChange={e => setTicketNumber(e.target.value)} placeholder="e.g. GSTN-108395810, MCA-ACK-93284" />
          </div>
          <div>
            <Textarea label="Blocker Description *" value={description} onChange={e => setDescription(e.target.value)} placeholder="Provide full details on what is blocking this filing, what active steps are being taken, or what exact documents are required from the client..." rows={4} required />
          </div>
          <div style={{ display: 'flex', justifyContent: 'end', gap: '8px', marginTop: '8px' }}>
            <Button type="button" variant="outline" onClick={() => setShowLogModal(false)} disabled={logging}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={logging}>
              {logging ? 'Logging blocker…' : 'Log Blocker'}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
};
