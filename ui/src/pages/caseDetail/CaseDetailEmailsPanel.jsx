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
import {
  formatIndianPhoneNumber,
  buildWhatsAppShareUrl,
  buildWhatsAppDocumentRequestMessage,
  getValidityLabel,
  calculateValidityDate,
} from '../../utils/whatsapp';

function calculateDueDateStr(validity) {
  return calculateValidityDate(validity);
}

function getDocketDisplayTitle(caseInfo) {
  const rawTitle = String(caseInfo?.title || '').trim();
  if (rawTitle && rawTitle.toLowerCase() !== 'title' && rawTitle.toLowerCase() !== 'untitled docket') {
    return rawTitle;
  }
  const category = caseInfo?.category || caseInfo?.caseCategory || caseInfo?.categoryName;
  const subCategory = caseInfo?.subCategory || caseInfo?.caseSubCategory || caseInfo?.subCategoryName;
  const workType = caseInfo?.workType || caseInfo?.serviceType;

  if (category && subCategory) {
    return `${category} - ${subCategory}`;
  }
  if (subCategory) {
    return subCategory;
  }
  if (category) {
    return category;
  }
  if (workType) {
    return workType;
  }
  return '';
}

export const CaseDetailEmailsPanel = ({
  caseId,
  caseInfo,
  clientEmail,
  clientPhone = '',
  clientName = '',
  onRefreshCase,
}) => {
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();
  const [emails, setEmailList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Email Modal states
  const [showSendModal, setShowSendModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendTo, setSendTo] = useState(clientEmail && clientEmail !== '—' ? clientEmail : '');
  const [linkValidity, setLinkValidity] = useState('7d');
  const [requirePin, setRequirePin] = useState(false);
  const [autoPend, setAutoPend] = useState(true);
  const [sendSubject, setSendSubject] = useState('');
  const [sendBody, setSendBody] = useState('');

  // WhatsApp Modal states
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [waSending, setWaSending] = useState(false);
  const [waPhone, setWaPhone] = useState(clientPhone && clientPhone !== '—' ? clientPhone : '');
  const [waValidity, setWaValidity] = useState('7d');
  const [waRequirePin, setWaRequirePin] = useState(false);
  const [waAutoPend, setWaAutoPend] = useState(true);
  const [waCustomNote, setWaCustomNote] = useState('');

  const firmName = useMemo(() => {
    return user?.firmName || user?.firm?.name || caseInfo?.firmName || getFirmConfig()?.name || 'Our Firm';
  }, [user, caseInfo]);

  useEffect(() => {
    if (clientEmail && clientEmail !== '—') {
      setSendTo(clientEmail);
    }
  }, [clientEmail]);

  useEffect(() => {
    if (clientPhone && clientPhone !== '—') {
      setWaPhone(clientPhone);
    }
  }, [clientPhone]);

  const displayTitle = useMemo(() => getDocketDisplayTitle(caseInfo), [caseInfo]);

  useEffect(() => {
    const titleText = displayTitle ? `"${displayTitle}"` : 'your request';
    const dueDateStr = calculateDueDateStr(linkValidity);
    const validityText = getValidityLabel(linkValidity);

    setSendSubject(`Request for Documents${displayTitle ? ` - ${displayTitle}` : ''}`);
    setSendBody(
      `Dear Client,\n\nWe require documents to proceed with ${titleText}.\n\nPlease access your client upload link to submit requested files and message our team directly.\n\nLink Validity: ${validityText} (Valid until: ${dueDateStr})\n\nBest regards,\n${firmName}`
    );
  }, [caseId, displayTitle, firmName, linkValidity]);

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
        requirePin,
        autoPend,
        channel: 'EMAIL',
      };

      const res = await caseApi.generateUploadLink(caseId, payload);
      if (res.success) {
        showSuccess(
          autoPend
            ? 'Document request email sent & docket set to Waiting / Pending!'
            : 'Document request email with secure upload link sent to client!'
        );
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
        requirePin,
        channel: 'DIRECT',
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

  // 1-Click WhatsApp Document Request Handlers
  const handleOpenWhatsApp = async (e) => {
    if (e) e.preventDefault();
    setWaSending(true);
    try {
      const cleanPhone = formatIndianPhoneNumber(waPhone);
      const payload = {
        sendEmail: false,
        expiry: waValidity,
        requirePin: waRequirePin,
        autoPend: waAutoPend,
        channel: 'WHATSAPP',
        to: cleanPhone || undefined,
      };

      const res = await caseApi.generateUploadLink(caseId, payload);
      if (res.success && res.data?.link) {
        const fullMessage = buildWhatsAppDocumentRequestMessage({
          clientName,
          docketTitle: displayTitle,
          docketNumber: caseInfo?.caseNumber || caseInfo?.caseId,
          uploadLink: res.data.link,
          validity: waValidity,
          pin: res.data.pin || null,
          firmName,
        });

        const textToSend = waCustomNote.trim()
          ? `${waCustomNote.trim()}\n\n${fullMessage}`
          : fullMessage;

        // Copy text to clipboard as convenient backup
        if (navigator?.clipboard?.writeText) {
          try {
            await navigator.clipboard.writeText(textToSend);
          } catch (_clipErr) {
            // non-fatal
          }
        }

        const waUrl = buildWhatsAppShareUrl({
          phone: cleanPhone,
          text: textToSend,
        });

        // Open WhatsApp Web or Desktop application
        window.open(waUrl, '_blank', 'noopener,noreferrer');

        showSuccess(
          waAutoPend
            ? 'Upload link created, docket set to Waiting / Pending & WhatsApp opened!'
            : 'Upload link created & WhatsApp opened!'
        );
        setShowWhatsAppModal(false);
        onRefreshCase?.();
      }
    } catch (err) {
      showError('Failed to generate WhatsApp link: ' + (err.response?.data?.message || err.message));
    } finally {
      setWaSending(false);
    }
  };

  const handleCopyWhatsAppMessageOnly = async () => {
    setWaSending(true);
    try {
      const cleanPhone = formatIndianPhoneNumber(waPhone);
      const payload = {
        sendEmail: false,
        expiry: waValidity,
        requirePin: waRequirePin,
        autoPend: waAutoPend,
        channel: 'WHATSAPP',
        to: cleanPhone || undefined,
      };

      const res = await caseApi.generateUploadLink(caseId, payload);
      if (res.success && res.data?.link) {
        const fullMessage = buildWhatsAppDocumentRequestMessage({
          clientName,
          docketTitle: displayTitle,
          docketNumber: caseInfo?.caseNumber || caseInfo?.caseId,
          uploadLink: res.data.link,
          validity: waValidity,
          pin: res.data.pin || null,
          firmName,
        });

        const textToSend = waCustomNote.trim()
          ? `${waCustomNote.trim()}\n\n${fullMessage}`
          : fullMessage;

        await navigator.clipboard.writeText(textToSend);
        showSuccess('WhatsApp message with upload link copied to clipboard!');
        setShowWhatsAppModal(false);
        onRefreshCase?.();
      }
    } catch (err) {
      showError('Failed to generate link: ' + (err.response?.data?.message || err.message));
    } finally {
      setWaSending(false);
    }
  };

  return (
    <section className="case-card case-detail-section" id="panel-emails" role="tabpanel">
      <div className="case-card__heading case-detail-section__heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2>Client Communications & Document Requests</h2>
          <p className="case-detail-section__subheading">Send document requests via WhatsApp or email, and track communications for this docket.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowWhatsAppModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.634.054-1.748-.415-1.424-.601-2.336-2.038-2.408-2.133-.07-.095-.572-.76-.572-1.448 0-.689.362-1.028.49-1.168.129-.14.282-.175.376-.175.093 0 .188.001.27.005.087.004.204-.033.32.244.119.288.406.993.442 1.065.035.072.059.156.012.25-.047.094-.07.153-.14.235-.07.082-.148.184-.211.247-.07.07-.144.146-.062.287.082.141.365.602.784.975.54.48 1.002.628 1.144.698.141.07.225.059.308-.036.083-.095.355-.413.45-.554.094-.141.189-.118.318-.07.129.047.822.388.963.458.141.07.235.106.27.165.035.059.035.341-.109.746z"/>
            </svg>
            <span>Request via WhatsApp</span>
          </button>
          <Button onClick={() => setShowSendModal(true)} variant="primary">
            Request via Email
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="case-detail__empty-note mt-3">Loading email communications…</p>
      ) : emails.length === 0 ? (
        <div className="text-center py-6 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 mt-3">
          <svg className="mx-auto h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
          <p className="mt-2 text-sm text-gray-500 font-medium">No email communications logged for this docket yet.</p>
          <p className="text-xs text-gray-400 mt-1">Send a document request via WhatsApp or email to start tracking communications with the client.</p>
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
              <hr className="border-0 border-t border-gray-100 my-2.5" />
              <div className="bg-gray-50 p-3 rounded-md border border-gray-100 text-xs text-gray-700 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto leading-relaxed">
                {email.bodyExcerpt || email.body}
              </div>
              {email.classification && (
                <div className="mt-3 flex gap-2 items-center">
                  <span className="text-xs font-semibold text-gray-500">Classification:</span>
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-xs ${
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

      {/* MODAL 1: Request Documents via WhatsApp */}
      <Modal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        title="Request Documents via WhatsApp"
        size="sm"
      >
        <p className="text-xs text-gray-500 mb-3">
          Creates a secure drop link and opens WhatsApp with a pre-filled, polite message for your client.
        </p>
        <form onSubmit={handleOpenWhatsApp} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700">Client WhatsApp Number</label>
            <input
              type="tel"
              className="neo-input w-full text-sm mt-1"
              value={waPhone}
              onChange={(e) => setWaPhone(e.target.value)}
              placeholder="e.g. 9820012345 (Leave empty to choose any contact or group in WhatsApp)"
            />
            <p className="text-[11px] text-gray-400 mt-0.5">
              10-digit Indian mobile. If left blank, WhatsApp will let you pick any client or group chat.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">Link Validity / Expiry *</label>
            <select
              className="neo-input w-full text-sm mt-1 bg-white"
              value={waValidity}
              onChange={(e) => setWaValidity(e.target.value)}
            >
              <option value="24h">24 Hours (Due in 1 day)</option>
              <option value="48h">48 Hours (Due in 2 days)</option>
              <option value="7d">7 Days (Due in 1 week)</option>
              <option value="14d">14 Days (Due in 2 weeks)</option>
              <option value="30d">30 Days (Due in 1 month)</option>
            </select>
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={waAutoPend}
                onChange={(e) => setWaAutoPend(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Automatically set docket to Waiting / Pending while awaiting upload</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={waRequirePin}
                onChange={(e) => setWaRequirePin(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Require 4-digit PIN verification for client upload</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">Optional Extra Note for Client</label>
            <input
              type="text"
              className="neo-input w-full text-sm mt-1"
              value={waCustomNote}
              onChange={(e) => setWaCustomNote(e.target.value)}
              placeholder="e.g. Please send signed Form 3CD annexures today."
            />
          </div>

          {/* Message Preview */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-2.5">
            <p className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider mb-1">
              WhatsApp Message Preview:
            </p>
            <div className="text-xs text-gray-700 whitespace-pre-wrap font-sans bg-white border border-emerald-100 rounded p-2 leading-relaxed">
              {buildWhatsAppDocumentRequestMessage({
                clientName,
                docketTitle: displayTitle,
                docketNumber: caseInfo?.caseNumber || caseInfo?.caseId,
                uploadLink: 'https://docketra.in/upload/[auto-generated-token]',
                validity: waValidity,
                pin: waRequirePin ? '••••' : null,
                firmName,
              })}
            </div>
          </div>

          <div className="flex justify-between items-center gap-2 pt-2 border-t border-gray-150 flex-wrap">
            <button
              type="button"
              onClick={handleCopyWhatsAppMessageOnly}
              disabled={waSending}
              className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 underline underline-offset-2"
            >
              Copy Message & Link
            </button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowWhatsAppModal(false)} disabled={waSending}>
                Cancel
              </Button>
              <button
                type="submit"
                disabled={waSending}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs disabled:opacity-60"
              >
                <span>{waSending ? 'Opening…' : 'Open WhatsApp & Share →'}</span>
              </button>
            </div>
          </div>

          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={() => {
                setShowWhatsAppModal(false);
                setShowSendModal(true);
              }}
              className="text-[11px] text-gray-500 hover:text-blue-600 underline"
            >
              Prefer sending email instead? Switch to Email Request
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Compose Email to Client */}
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
          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={autoPend}
                onChange={(e) => setAutoPend(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Automatically set docket to Waiting / Pending while awaiting upload</span>
            </label>
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
            <Textarea label="Email Content (Body)" value={sendBody} onChange={e => setSendBody(e.target.value)} rows={6} required />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
            <Button type="button" variant="outline" onClick={handleCopyLinkOnly} disabled={sending}>
              Copy Link Only
            </Button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button type="button" variant="outline" onClick={() => setShowSendModal(false)} disabled={sending}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={sending}>
                {sending ? 'Sending...' : 'Send Email & Generate Link'}
              </Button>
            </div>
          </div>

          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={() => {
                setShowSendModal(false);
                setShowWhatsAppModal(true);
              }}
              className="text-[11px] text-emerald-700 hover:text-emerald-900 underline font-medium"
            >
              Need to share on WhatsApp instead? Switch to WhatsApp Request
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
};
