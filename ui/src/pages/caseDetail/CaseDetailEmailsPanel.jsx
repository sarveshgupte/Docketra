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

function getDocketDisplayTitle(caseInfo) {
  const rawTitle = String(caseInfo?.title || '').trim();
  if (rawTitle && rawTitle.toLowerCase() !== 'title' && rawTitle.toLowerCase() !== 'untitled docket') {
    return rawTitle;
  }
  const category = caseInfo?.category || caseInfo?.caseCategory || caseInfo?.categoryName;
  const subCategory = caseInfo?.subCategory || caseInfo?.caseSubCategory || caseInfo?.subCategoryName;
  const workType = caseInfo?.workType || caseInfo?.serviceType;

  if (category && subCategory) return `${category} - ${subCategory}`;
  return subCategory || category || workType || '';
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

  const [showSendModal, setShowSendModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendTo, setSendTo] = useState(clientEmail && clientEmail !== '—' ? clientEmail : '');
  const [linkValidity, setLinkValidity] = useState('7d');
  const [requirePin, setRequirePin] = useState(false);
  const [autoPend, setAutoPend] = useState(true);
  const [sendSubject, setSendSubject] = useState('');
  const [sendBody, setSendBody] = useState('');

  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [waSending, setWaSending] = useState(false);
  const [waPhone, setWaPhone] = useState(clientPhone && clientPhone !== '—' ? clientPhone : '');
  const [waValidity, setWaValidity] = useState('7d');
  const [waRequirePin, setWaRequirePin] = useState(false);
  const [waAutoPend, setWaAutoPend] = useState(true);
  const [waCustomNote, setWaCustomNote] = useState('');

  const firmName = useMemo(
    () => user?.firmName || user?.firm?.name || caseInfo?.firmName || getFirmConfig()?.name || 'Our Firm',
    [user, caseInfo],
  );

  useEffect(() => {
    if (clientEmail && clientEmail !== '—') setSendTo(clientEmail);
  }, [clientEmail]);

  useEffect(() => {
    if (clientPhone && clientPhone !== '—') setWaPhone(clientPhone);
  }, [clientPhone]);

  const displayTitle = useMemo(() => getDocketDisplayTitle(caseInfo), [caseInfo]);

  useEffect(() => {
    const titleText = displayTitle ? `"${displayTitle}"` : 'your request';
    const dueDateStr = calculateValidityDate(linkValidity);
    const validityText = getValidityLabel(linkValidity);

    setSendSubject(`Request for Documents${displayTitle ? ` - ${displayTitle}` : ''}`);
    setSendBody(
      `Dear Client,\n\nWe require documents to proceed with ${titleText}.\n\nPlease access your client upload link to submit requested files and message our team directly.\n\nLink Validity: ${validityText} (Valid until: ${dueDateStr})\n\nBest regards,\n${firmName}`,
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
      showError(`Failed to load email captures: ${err.message}`);
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
      const res = await caseApi.generateUploadLink(caseId, {
        to: sendTo,
        customSubject: sendSubject,
        customBody: sendBody,
        sendEmail: true,
        expiry: linkValidity,
        requirePin,
        autoPend,
        channel: 'EMAIL',
      });
      if (res.success) {
        showSuccess(
          autoPend
            ? 'Document request email sent and docket set to Pending.'
            : 'Document request email with secure upload link sent.',
        );
        setShowSendModal(false);
        loadEmails();
        onRefreshCase?.();
      }
    } catch (err) {
      showError(`Failed to send email: ${err.response?.data?.message || err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleCopyLinkOnly = async () => {
    setSending(true);
    try {
      const res = await caseApi.generateUploadLink(caseId, {
        sendEmail: false,
        expiry: linkValidity,
        requirePin,
        channel: 'DIRECT',
      });
      if (res.success && res.data?.link) {
        await navigator.clipboard.writeText(res.data.link);
        showSuccess('Secure upload link copied to clipboard.');
        setShowSendModal(false);
        onRefreshCase?.();
      }
    } catch (err) {
      showError(`Failed to generate link: ${err.response?.data?.message || err.message}`);
    } finally {
      setSending(false);
    }
  };

  const buildWhatsAppPayload = (cleanPhone) => ({
    sendEmail: false,
    expiry: waValidity,
    requirePin: waRequirePin,
    autoPend: waAutoPend,
    channel: 'WHATSAPP',
    to: cleanPhone || undefined,
  });

  const composeWhatsAppText = (link, pin) => {
    const fullMessage = buildWhatsAppDocumentRequestMessage({
      clientName,
      docketTitle: displayTitle,
      docketNumber: caseInfo?.caseNumber || caseInfo?.caseId,
      uploadLink: link,
      validity: waValidity,
      pin: pin || null,
      firmName,
    });
    return waCustomNote.trim() ? `${waCustomNote.trim()}\n\n${fullMessage}` : fullMessage;
  };

  const handleOpenWhatsApp = async (e) => {
    if (e) e.preventDefault();
    setWaSending(true);
    try {
      const cleanPhone = formatIndianPhoneNumber(waPhone);
      const res = await caseApi.generateUploadLink(caseId, buildWhatsAppPayload(cleanPhone));
      if (res.success && res.data?.link) {
        const textToSend = composeWhatsAppText(res.data.link, res.data.pin);
        if (navigator?.clipboard?.writeText) {
          try {
            await navigator.clipboard.writeText(textToSend);
          } catch (_clipErr) {
            // non-fatal clipboard fallback
          }
        }
        window.open(buildWhatsAppShareUrl({ phone: cleanPhone, text: textToSend }), '_blank', 'noopener,noreferrer');
        showSuccess(
          waAutoPend
            ? 'Upload link created, docket set to Pending, and WhatsApp opened.'
            : 'Upload link created and WhatsApp opened.',
        );
        setShowWhatsAppModal(false);
        onRefreshCase?.();
      }
    } catch (err) {
      showError(`Failed to generate WhatsApp link: ${err.response?.data?.message || err.message}`);
    } finally {
      setWaSending(false);
    }
  };

  const handleCopyWhatsAppMessageOnly = async () => {
    setWaSending(true);
    try {
      const cleanPhone = formatIndianPhoneNumber(waPhone);
      const res = await caseApi.generateUploadLink(caseId, buildWhatsAppPayload(cleanPhone));
      if (res.success && res.data?.link) {
        await navigator.clipboard.writeText(composeWhatsAppText(res.data.link, res.data.pin));
        showSuccess('WhatsApp message with upload link copied to clipboard.');
        setShowWhatsAppModal(false);
        onRefreshCase?.();
      }
    } catch (err) {
      showError(`Failed to generate link: ${err.response?.data?.message || err.message}`);
    } finally {
      setWaSending(false);
    }
  };

  const previewOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <section className="case-card case-detail-section" id="panel-emails" role="tabpanel" aria-labelledby="tab-emails">
      <div className="case-card__heading case-detail-section__heading flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="docket-section-kicker">Client Outreach</p>
          <h2>{'Client Communications & Document Requests'}</h2>
          <p className="case-detail-section__subheading">
            Send document requests via WhatsApp or email, and track communications for this docket.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowWhatsAppModal(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          >
            <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.634.054-1.748-.415-1.424-.601-2.336-2.038-2.408-2.133-.07-.095-.572-.76-.572-1.448 0-.689.362-1.028.49-1.168.129-.14.282-.175.376-.175.093 0 .188.001.27.005.087.004.204-.033.32.244.119.288.406.993.442 1.065.035.072.059.156.012.25-.047.094-.07.153-.14.235-.07.082-.148.184-.211.247-.07.07-.144.146-.062.287.082.141.365.602.784.975.54.48 1.002.628 1.144.698.141.07.225.059.308-.036.083-.095.355-.413.45-.554.094-.141.189-.118.318-.07.129.047.822.388.963.458.141.07.235.106.27.165.035.059.035.341-.109.746z" />
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
        <div className="mt-3 rounded-md border border-dashed border-slate-200 bg-slate-50/60 py-6 text-center">
          <svg className="mx-auto h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
          <p className="mt-2 text-sm font-medium text-slate-700">No email communications logged yet.</p>
          <p className="mt-1 text-xs text-slate-500">
            Send a document request via WhatsApp or email to track client responses on this docket.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {emails.map((email) => (
            <div key={email._id} className="rounded-md border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{email.subject}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    <strong>From:</strong> {email.sender?.name} &lt;{email.sender?.email}&gt;
                  </p>
                  {email.recipients?.length > 0 ? (
                    <p className="mt-0.5 text-xs text-slate-500">
                      <strong>To:</strong> {email.recipients.join(', ')}
                    </p>
                  ) : null}
                </div>
                <span className="whitespace-nowrap rounded bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-600">
                  {formatDateTime(email.receivedAt)}
                </span>
              </div>
              <div className="mt-2.5 max-h-48 overflow-y-auto whitespace-pre-wrap rounded border border-slate-100 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-700">
                {email.bodyExcerpt || email.body}
              </div>
              {email.classification ? (
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Classification:</span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      email.classification === 'actionable'
                        ? 'bg-blue-100 text-blue-800'
                        : email.classification === 'awaiting_reply'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {email.classification.replace('_', ' ')}
                  </span>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        title="Request Documents via WhatsApp"
        size="sm"
      >
        <p className="mb-3 text-xs text-slate-600">
          Creates a secure upload link and opens WhatsApp with a pre-filled message for your client.
        </p>
        <form onSubmit={handleOpenWhatsApp} className="space-y-3">
          <div>
            <label htmlFor="wa-client-phone" className="block text-xs font-semibold text-slate-700">
              Client WhatsApp Number
            </label>
            <input
              id="wa-client-phone"
              type="tel"
              className="neo-input mt-1 w-full text-sm"
              value={waPhone}
              onChange={(e) => setWaPhone(e.target.value)}
              placeholder="e.g. 9820012345 (Leave empty to pick contact in WhatsApp)"
            />
            <p className="mt-0.5 text-[11px] text-slate-500">
              10-digit Indian mobile. Leave blank to choose any contact or group in WhatsApp.
            </p>
          </div>

          <div>
            <label htmlFor="wa-link-validity" className="block text-xs font-semibold text-slate-700">
              Link Validity
            </label>
            <select
              id="wa-link-validity"
              className="neo-input mt-1 w-full bg-white text-sm"
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
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={waAutoPend}
                onChange={(e) => setWaAutoPend(e.target.checked)}
                className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
              />
              <span>Set docket to Waiting / Pending while awaiting upload</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={waRequirePin}
                onChange={(e) => setWaRequirePin(e.target.checked)}
                className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
              />
              <span>Require 4-digit PIN verification for client upload</span>
            </label>
          </div>

          <div>
            <label htmlFor="wa-extra-note" className="block text-xs font-semibold text-slate-700">
              Optional Extra Note for Client
            </label>
            <input
              id="wa-extra-note"
              type="text"
              className="neo-input mt-1 w-full text-sm"
              value={waCustomNote}
              onChange={(e) => setWaCustomNote(e.target.value)}
              placeholder="e.g. Please send signed Form 3CD annexures today."
            />
          </div>

          <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-2.5">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-900">
              WhatsApp Message Preview
            </p>
            <div className="whitespace-pre-wrap rounded border border-emerald-100 bg-white p-2 font-sans text-xs leading-relaxed text-slate-700">
              {buildWhatsAppDocumentRequestMessage({
                clientName,
                docketTitle: displayTitle,
                docketNumber: caseInfo?.caseNumber || caseInfo?.caseId,
                uploadLink: `${previewOrigin || ''}/upload/[auto-generated-token]`,
                validity: waValidity,
                pin: waRequirePin ? '••••' : null,
                firmName,
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={handleCopyWhatsAppMessageOnly}
              disabled={waSending}
              className="text-xs font-semibold text-emerald-800 underline underline-offset-2 hover:text-emerald-950"
            >
              Copy Message &amp; Link
            </button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowWhatsAppModal(false)} disabled={waSending}>
                Cancel
              </Button>
              <button
                type="submit"
                disabled={waSending}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
              >
                <span>{waSending ? 'Opening…' : 'Open WhatsApp & Share'}</span>
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
              className="text-[11px] text-slate-600 underline hover:text-blue-700"
            >
              Prefer email? Switch to Email Request
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        title="Compose Document Request Email"
        size="sm"
      >
        <p className="mb-3 text-xs text-slate-600">
          Sends a request email to the client using your firm email channel.
        </p>
        <form onSubmit={handleSendEmail} className="flex flex-col gap-3">
          <div>
            <label htmlFor="email-request-to" className="field-label text-xs font-semibold">
              To (Client Email)
            </label>
            <input
              id="email-request-to"
              type="email"
              className="neo-input mt-1 w-full text-sm"
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
              placeholder="e.g. client@company.com"
              required
            />
          </div>
          <div>
            <label htmlFor="email-request-validity" className="field-label text-xs font-semibold">
              Link Validity
            </label>
            <select
              id="email-request-validity"
              className="neo-input mt-1 w-full bg-white text-sm"
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
            <label htmlFor="email-request-subject" className="field-label text-xs font-semibold">
              Subject
            </label>
            <input
              id="email-request-subject"
              type="text"
              className="neo-input mt-1 w-full text-sm"
              value={sendSubject}
              onChange={(e) => setSendSubject(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2 pt-1">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={autoPend}
                onChange={(e) => setAutoPend(e.target.checked)}
                className="rounded border-slate-300 text-blue-700 focus:ring-blue-700"
              />
              <span>Set docket to Waiting / Pending while awaiting upload</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={requirePin}
                onChange={(e) => setRequirePin(e.target.checked)}
                className="rounded border-slate-300 text-blue-700 focus:ring-blue-700"
              />
              <span>Require 4-digit PIN verification for upload</span>
            </label>
          </div>

          <Textarea
            label="Email Body"
            value={sendBody}
            onChange={(e) => setSendBody(e.target.value)}
            rows={6}
            required
          />

          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="outline" onClick={handleCopyLinkOnly} disabled={sending}>
              Copy Link Only
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowSendModal(false)} disabled={sending}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={sending}>
                {sending ? 'Sending…' : 'Send Email & Generate Link'}
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
              className="text-[11px] font-medium text-emerald-800 underline hover:text-emerald-950"
            >
              Need to share on WhatsApp instead? Switch to WhatsApp Request
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
};
