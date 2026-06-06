import React, { useState, useEffect, useCallback } from 'react';
import { emailCaptureApi } from '../../api/emailCapture.api';
import { Button } from '../../components/common/Button';
import { Textarea } from '../../components/common/Textarea';
import { formatDateTime } from '../../utils/formatDateTime';
import { useToast } from '../../hooks/useToast';

export const CaseDetailEmailsPanel = ({ caseId }) => {
  const { showSuccess, showError } = useToast();
  const [emails, setEmailList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState('');

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

  const handlePasteSubmit = async (e) => {
    e.preventDefault();
    if (!senderEmail || !subject || !body) {
      showError('Sender Email, Subject, and Email Body are required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        sender: { name: senderName || 'Manual Ingestion', email: senderEmail },
        subject,
        body,
        recipients: recipients ? recipients.split(',').map(r => r.trim()) : [],
        caseId,
      };

      const res = await emailCaptureApi.createEmailCapture(payload);
      if (res.success) {
        showSuccess('Forwarded email successfully parsed and captured!');
        setShowPasteModal(false);
        // Reset form
        setSenderName('');
        setSenderEmail('');
        setSubject('');
        setBody('');
        setRecipients('');
        loadEmails();
      }
    } catch (err) {
      showError('Email ingestion failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="case-card case-detail-section" id="panel-emails" role="tabpanel">
      <div className="case-card__heading case-detail-section__heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Email Ingestion Logs</h2>
          <p className="case-detail-section__subheading">Registry of client forwards and inbound obligational emails parsed for this docket.</p>
        </div>
        <Button onClick={() => setShowPasteModal(true)} variant="primary">
          ✚ Ingest Forwarded Email
        </Button>
      </div>

      {loading ? (
        <p className="case-detail__empty-note mt-3">Loading email captures…</p>
      ) : emails.length === 0 ? (
        <div className="text-center py-6 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 mt-3">
          <span className="text-3xl">📧</span>
          <p className="mt-2 text-sm text-gray-500 font-medium">No forwarded emails registered for this docket yet.</p>
          <p className="text-xs text-gray-400 mt-1">Ingest email content manually or forward client emails to link them directly.</p>
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

      {showPasteModal && (
        <div style={{
          position: 'fixed', inset: '0', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: '9999',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', maxWidth: '550px', width: '100%', padding: '24px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '4px' }}>Simulate Inbound Forwarded Email</h3>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '16px' }}>Paste forwarded headers and body to test the email parsing, auto-linking, and audit trail generation.</p>
            <form onSubmit={handlePasteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="field-label" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Sender Name</label>
                  <input type="text" className="neo-input w-full text-sm mt-1" value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="e.g. John Doe" />
                </div>
                <div>
                  <label className="field-label" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Sender Email *</label>
                  <input type="email" className="neo-input w-full text-sm mt-1" value={senderEmail} onChange={e => setSenderEmail(e.target.value)} placeholder="e.g. john@company.com" required />
                </div>
              </div>
              <div>
                <label className="field-label" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Subject Line *</label>
                <input type="text" className="neo-input w-full text-sm mt-1" value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Requesting Income Tax returns FY 2025-26" required />
              </div>
              <div>
                <label className="field-label" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Recipients (Comma separated)</label>
                <input type="text" className="neo-input w-full text-sm mt-1" value={recipients} onChange={e => setRecipients(e.target.value)} placeholder="e.g. support@docketra.com" />
              </div>
              <div>
                <Textarea label="Email Content (Body) *" value={body} onChange={e => setBody(e.target.value)} placeholder="Paste the forwarded email body or copy-paste plain text contents..." rows={5} required />
              </div>
              <div style={{ display: 'flex', justifyContent: 'end', gap: '8px', marginTop: '8px' }}>
                <Button type="button" variant="outline" onClick={() => setShowPasteModal(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Parsing email…' : 'Ingest and Parse'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
