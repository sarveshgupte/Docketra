import React, { useState, useEffect, useCallback } from 'react';
import { emailCaptureApi } from '../../api/emailCapture.api';
import { Button } from '../../components/common/Button';
import { Textarea } from '../../components/common/Textarea';
import { Modal } from '../../components/common/Modal';
import { formatDateTime } from '../../utils/formatDateTime';
import { useToast } from '../../hooks/useToast';

export const CaseDetailEmailsPanel = ({ caseId, caseInfo, clientEmail, onRefreshCase }) => {
  const { showSuccess, showError } = useToast();
  const [emails, setEmailList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sending, setSending] = useState(false);

  // Compose Form states
  const [sendTo, setSendTo] = useState(clientEmail && clientEmail !== '—' ? clientEmail : '');
  const [sendSubject, setSendSubject] = useState('');
  const [sendBody, setSendBody] = useState('');

  useEffect(() => {
    if (clientEmail && clientEmail !== '—') {
      setSendTo(clientEmail);
    }
  }, [clientEmail]);

  useEffect(() => {
    const displayNum = caseInfo?.caseNumber || caseId;
    setSendSubject(`Request for Documents - Docket ${displayNum}`);
    setSendBody(
      `Dear Client,\n\nWe require documents to proceed with docket ${displayNum}.\n\nPlease access your client upload link to submit requested files and message our team directly.\n\nBest regards,\nDocketra Support`
    );
  }, [caseId, caseInfo]);

  const loadEmails = useCallback(async () => {
    setLoading(true);
    try {
      const response = await emailCaptureApi.getEmailCaptures({ caseId });
      if (response.success && Array.isArray(response.data)) {
        setEmailList(response.data);
      }
    } catch (err) {
      showError('Failed to load email captures: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [caseId, showError]);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (!sendTo || !sendSubject || !sendBody) {
      showError('Recipient Email, Subject, and Email Body are required.');
      return;
    }

    setSending(true);
    try {
      const payload = {
        to: sendTo,
        subject: sendSubject,
        body: sendBody,
      };

      const res = await emailCaptureApi.sendClientEmail(caseId, payload);
      if (res.success) {
        showSuccess('Email successfully sent to client!');
        setShowSendModal(false);
        loadEmails();
        onRefreshCase?.();
      }
    } catch (err) {
      showError('Failed to send email: ' + (err.response?.data?.message || err.message));
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="case-card case-detail-section" id="panel-emails" role="tabpanel">
      <div className="case-card__heading case-detail-section__heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2>Email Communications</h2>
          <p className="case-detail-section__subheading">Send document requests or communications directly to the client and track outbound messages for this docket.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button onClick={() => setShowSendModal(true)} variant="primary">
            ✉ Send Email to Client
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="case-detail__empty-note mt-3">Loading email communications…</p>
      ) : emails.length === 0 ? (
        <div className="text-center py-6 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 mt-3">
          <span className="text-3xl">📧</span>
          <p className="mt-2 text-sm text-gray-500 font-medium">No email communications logged for this docket yet.</p>
          <p className="text-xs text-gray-400 mt-1">Send a document request email to start tracking communications with the client.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {emails.map((email) => (
            <div key={email._id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{email.subject}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    <strong>From:</strong> {email.sender?.name} &lt;{email.sender?.email}&gt;
                  </p>
                  {email.recipients?.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      <strong>To:</strong> {email.recipients.join(', ')}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap bg-gray-100 px-2 py-0.5 rounded">
                  {formatDateTime(email.receivedAt)}
                </span>
              </div>
              <hr style={{ border: '0', borderTop: '1px solid #f3f4f6', margin: '10px 0' }} />
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-xs text-gray-700 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto leading-relaxed">
                {email.bodyExcerpt || email.body}
              </div>
              {email.classification && (
                <div className="mt-3 flex gap-2 items-center">
                  <span className="text-xs font-semibold text-gray-500">Classification:</span>
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                    email.classification === 'actionable' ? 'bg-indigo-100 text-indigo-800' :
                    email.classification === 'awaiting_reply' ? 'bg-amber-100 text-amber-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {email.classification.replace('_', ' ')}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* MODAL: Compose Email to Client */}
      <Modal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        title="Compose Document Request Email"
        size="sm"
      >
        <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '16px' }}>
          This will send an email to the client using your verified firm channel.
        </p>
        <form onSubmit={handleSendEmail} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label className="field-label" style={{ fontSize: '0.75rem', fontWeight: '600' }}>To (Client Email) *</label>
            <input type="email" className="neo-input w-full text-sm mt-1" value={sendTo} onChange={e => setSendTo(e.target.value)} placeholder="e.g. client@company.com" required />
          </div>
          <div>
            <label className="field-label" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Subject *</label>
            <input type="text" className="neo-input w-full text-sm mt-1" value={sendSubject} onChange={e => setSendSubject(e.target.value)} required />
          </div>
          <div>
            <Textarea label="Email Content (Body) *" value={sendBody} onChange={e => setSendBody(e.target.value)} rows={6} required />
          </div>
          <div style={{ display: 'flex', justifyContent: 'end', gap: '8px', marginTop: '8px' }}>
            <Button type="button" variant="outline" onClick={() => setShowSendModal(false)} disabled={sending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={sending}>
              {sending ? 'Sending email…' : 'Send Email'}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
};
