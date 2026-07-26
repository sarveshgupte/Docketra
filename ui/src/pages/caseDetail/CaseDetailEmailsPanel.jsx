import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { emailCaptureApi } from '../../api/emailCapture.api';
import { caseApi } from '../../api/case.api';
import { Button } from '../../components/common/Button';
import { Textarea } from '../../components/common/Textarea';
import { Modal } from '../../components/common/Modal';
import { formatDateTime } from '../../utils/formatDateTime';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import { getFirmConfig } from '../../utils/firmConfig';

function calculateDueDateStr(validity) {
  const daysMap = {
    '24h': 1,
    '48h': 2,
    '7d': 7,
    '14d': 14,
    '30d': 30,
  };
  const days = daysMap[validity] || 7;
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + days);

  return targetDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export const CaseDetailEmailsPanel = ({ caseId, caseInfo, clientEmail, onRefreshCase }) => {
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();
  const [emails, setEmailList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sending, setSending] = useState(false);

  // Compose Form states
  const [sendTo, setSendTo] = useState(clientEmail && clientEmail !== '—' ? clientEmail : '');
  const [linkValidity, setLinkValidity] = useState('7d');
  const [requirePin, setRequirePin] = useState(false);
  const [sendSubject, setSendSubject] = useState('');
  const [sendBody, setSendBody] = useState('');

  const firmName = useMemo(() => {
    return user?.firmName || user?.firm?.name || caseInfo?.firmName || getFirmConfig()?.name || 'Our Firm';
  }, [user, caseInfo]);

  useEffect(() => {
    if (clientEmail && clientEmail !== '—') {
      setSendTo(clientEmail);
    }
  }, [clientEmail]);

  useEffect(() => {
    const titleText = caseInfo?.title ? `"${caseInfo.title}"` : 'your request';
    const dueDateStr = calculateDueDateStr(linkValidity);
    const validityLabels = {
      '24h': '24 Hours',
      '48h': '48 Hours',
      '7d': '7 Days',
      '14d': '14 Days',
      '30d': '30 Days',
    };
    const validityText = validityLabels[linkValidity] || '7 Days';

    setSendSubject(`Request for Documents${caseInfo?.title ? ` - ${caseInfo.title}` : ''}`);
    setSendBody(
      `Dear Client,\n\nWe require documents to proceed with ${titleText}.\n\nPlease access your client upload link to submit requested files and message our team directly.\n\nLink Validity: ${validityText} (Valid until: ${dueDateStr})\n\nBest regards,\n${firmName}`
    );
  }, [caseId, caseInfo, firmName, linkValidity]);

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
    if (e) e.preventDefault();
    if (!sendTo || !sendSubject || !sendBody) {
      showError('Recipient Email, Subject, and Email Body are required.');
      return;
    }

    setSending(true);
    try {
      const payload = {
        to: sendTo,
        customSubject: sendSubject,
        customBody: sendBody,
        sendEmail: true,
        expiry: linkValidity,
        requirePin: requirePin,
      };

      const res = await caseApi.generateUploadLink(caseId, payload);
      if (res.success) {
        showSuccess('Document request email with secure upload link sent to client!');
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

  const handleCopyLinkOnly = async () => {
    setSending(true);
    try {
      const payload = {
        sendEmail: false,
        expiry: linkValidity,
        requirePin: requirePin,
      };

      const res = await caseApi.generateUploadLink(caseId, payload);
      if (res.success && res.data?.link) {
        await navigator.clipboard.writeText(res.data.link);
        showSuccess('Secure upload link copied to clipboard!');
        setShowSendModal(false);
        onRefreshCase?.();
      }
    } catch (err) {
      showError('Failed to generate link: ' + (err.response?.data?.message || err.message));
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
            <label className="field-label" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Link Validity / Due Date *</label>
            <select
              className="neo-input w-full text-sm mt-1 bg-white"
              value={linkValidity}
              onChange={(e) => setLinkValidity(e.target.value)}
            >
              <option value="24h">24 Hours (Due in 1 day)</option>
              <option value="48h">48 Hours (Due in 2 days)</option>
              <option value="7d">7 Days (Due in 1 week)</option>
              <option value="14d">14 Days (Due in 2 weeks)</option>
              <option value="30d">30 Days (Due in 1 month)</option>
            </select>
          </div>
          <div>
            <label className="field-label" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Subject *</label>
            <input type="text" className="neo-input w-full text-sm mt-1" value={sendSubject} onChange={e => setSendSubject(e.target.value)} required />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={requirePin}
                onChange={(e) => setRequirePin(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Require 4-digit PIN verification for upload</span>
            </label>
          </div>

          <div>
            <Textarea label="Email Content (Body) *" value={sendBody} onChange={e => setSendBody(e.target.value)} rows={6} required />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
            <Button type="button" variant="outline" onClick={handleCopyLinkOnly} disabled={sending}>
              📋 Copy Link Only
            </Button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button type="button" variant="outline" onClick={() => setShowSendModal(false)} disabled={sending}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={sending}>
                {sending ? 'Sending...' : '✉ Send Email & Generate Link'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </section>
  );
};
