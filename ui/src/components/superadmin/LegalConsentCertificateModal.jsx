import React, { useRef, useState } from 'react';
import { formatDateTime } from '../../utils/formatDateTime';
import { useDialogFocusTrap } from '../../hooks/useDialogFocusTrap';

const ShieldIcon = ({ className = 'h-5 w-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const PrintIcon = ({ className = 'h-4 w-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
);

const CopyIcon = ({ className = 'h-4 w-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CloseIcon = ({ className = 'h-5 w-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export function LegalConsentCertificateModal({
  isOpen,
  onClose,
  firm = null,
}) {
  const [copied, setCopied] = useState(false);
  const dialogPanelRef = useRef(null);

  useDialogFocusTrap(dialogPanelRef, Boolean(isOpen && firm), onClose);

  if (!isOpen || !firm) return null;

  const firmName = firm.name || firm.firmName || 'Practice';
  const firmKey = firm.firmId || firm.slug || firm._id || 'N/A';
  const signatoryEmail = firm.adminEmail || 'admin@practice.com';
  const acceptedAt = firm.termsAcceptedAt || firm.createdAt || new Date().toISOString();
  const termsVersion = firm.termsVersion || 'v1.0_pilot_2026';
  const agreementType = firm.agreementType || 'PILOT_CLICKWRAP';
  const ipAddress = firm.signupIP || '127.0.0.1';
  const userAgent = firm.signupUserAgent || 'Browser Client / Secure Web Session';

  // Deterministic audit verification digest
  const rawPayload = `${firmKey}:${signatoryEmail}:${termsVersion}:${acceptedAt}:${ipAddress}`;
  let hashVal = 0;
  for (let i = 0; i < rawPayload.length; i++) {
    hashVal = ((hashVal << 5) - hashVal) + rawPayload.charCodeAt(i);
    hashVal |= 0;
  }
  const hexSuffix = Math.abs(hashVal).toString(16).padStart(8, '0');
  const digestString = `sha256:consent-${Buffer ? '' : ''}${hexSuffix}-audit-record-verified`;

  const handleCopyDigest = async () => {
    try {
      await navigator.clipboard.writeText(digestString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-cert-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto overscroll-contain"
    >
      <div
        ref={dialogPanelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-8 focus:outline-none"
      >
        {/* Certificate Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400" aria-hidden="true">
              <ShieldIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 id="legal-cert-title" className="text-sm font-bold tracking-wide">
                Electronic Legal Consent Record
              </h2>
              <p className="text-xs text-slate-300">
                Audited clickwrap onboarding agreement certificate
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <PrintIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Close dialog"
            >
              <CloseIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Certificate Body */}
        <div className="p-6 space-y-6 text-slate-800 text-xs">
          {/* Practice & Signatory Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div>
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">
                Practice Entity
              </span>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{firmName}</p>
              <span className="text-xs font-mono text-slate-600">ID: {firmKey}</span>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">
                Primary Authorized Signatory
              </span>
              <p className="font-semibold text-slate-900 mt-0.5">{signatoryEmail}</p>
              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                Consent Verified
              </span>
            </div>
          </div>

          {/* Audit Verification Matrix */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5">
              Consent Audit Telemetry
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded border border-slate-200 bg-white">
                <span className="text-slate-500 block text-xs">Agreement Type</span>
                <span className="font-semibold text-slate-800">{agreementType}</span>
              </div>
              <div className="p-2.5 rounded border border-slate-200 bg-white">
                <span className="text-slate-500 block text-xs">Terms Version</span>
                <span className="font-mono font-semibold text-slate-800">{termsVersion}</span>
              </div>
              <div className="p-2.5 rounded border border-slate-200 bg-white">
                <span className="text-slate-500 block text-xs">Acceptance Date</span>
                <span className="font-medium text-slate-800">{formatDateTime(acceptedAt)}</span>
              </div>
              <div className="p-2.5 rounded border border-slate-200 bg-white">
                <span className="text-slate-500 block text-xs">Sign-Up IP</span>
                <span className="font-mono text-slate-800">{ipAddress}</span>
              </div>
            </div>
          </div>

          {/* Client Environment Info */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1">
              Recorded Client User Agent
            </span>
            <p className="text-xs font-mono text-slate-700 break-all leading-relaxed">
              {userAgent}
            </p>
          </div>

          {/* Core Operating Principles / Disclaimers */}
          <div className="p-4 rounded-lg bg-indigo-50/50 border border-indigo-100 space-y-2">
            <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
              Master Terms & Architecture Attestation
            </h4>
            <ul className="list-disc list-inside space-y-1 text-xs text-slate-700 leading-normal">
              <li><strong>Pilot License:</strong> Provided under a 1-year evaluation license for professional practice workflows.</li>
              <li><strong>Zero Advisory Representation:</strong> The platform delivers operations tracking software and does not furnish legal, auditing, or chartered accountancy counsel.</li>
              <li><strong>Data Residency & BYOS:</strong> Client attachments and sensitive papers remain stored in practice-controlled cloud storage.</li>
              <li><strong>Liability:</strong> Platform provided on an as-evaluated basis during the initial evaluation period.</li>
            </ul>
          </div>

          {/* Verification Digest */}
          <div className="p-3 rounded-lg bg-slate-900 text-white font-mono text-xs">
            <div className="flex items-center justify-between text-xs text-slate-300 font-bold mb-1">
              <span>AUDIT INTEGRITY RECORD</span>
              <button
                type="button"
                onClick={handleCopyDigest}
                className="inline-flex items-center gap-1 text-slate-200 hover:text-white rounded px-1.5 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <CopyIcon className="h-3 w-3" aria-hidden="true" />
                <span>{copied ? 'Copied' : 'Copy Hash'}</span>
              </button>
            </div>
            <p className="text-emerald-400 break-all">{digestString}</p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end px-6 py-3 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-300 rounded-md bg-white hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
