import React, { useEffect, useState } from 'react';

export const PILOT_TERMS_VERSION = 'v1.0_pilot_2026';
export const OPERATOR_LEGAL_NAME = 'Sarvesh Gupte';
export const OPERATOR_CAPACITY = 'Sole Founder / Individual Operator (pre-incorporation)';
export const OPERATOR_LOCATION = 'Maharashtra, India';

const TABS = [
  { id: 'pilot', label: '1. Pilot Evaluation Agreement' },
  { id: 'terms', label: '2. Terms of Service & Disclaimers' },
  { id: 'privacy', label: '3. Privacy & India Data Hosting' },
];

export const PilotAgreementModal = ({
  isOpen,
  onClose,
  initialTab = 'pilot',
  onAccept,
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pilot-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50/90 px-6 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-900">
                Official Pilot Agreement
              </span>
              <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-mono text-slate-600">
                {PILOT_TERMS_VERSION}
              </span>
            </div>
            <h2 id="pilot-modal-title" className="mt-2 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
              Docketra Legal &amp; Pilot Evaluation Agreement
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Platform Operator: <strong className="text-slate-900">{OPERATOR_LEGAL_NAME}</strong> ({OPERATOR_CAPACITY} • {OPERATOR_LOCATION})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 py-3 px-3 text-xs font-bold transition-all sm:text-sm ${
                activeTab === tab.id
                  ? 'border-slate-950 text-slate-950'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 text-sm leading-relaxed text-slate-700 space-y-6">
          {activeTab === 'pilot' && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <h4 className="font-bold text-amber-950 text-xs uppercase tracking-wider">
                  Sole Founder Pre-Incorporation Operator Notice
                </h4>
                <p className="mt-1 text-xs text-amber-900 leading-normal">
                  The Docketra platform (&quot;Docketra&quot; or the &quot;Software&quot;) is developed and operated by <strong>Sarvesh Gupte</strong>, an individual resident of Maharashtra, India (&quot;Operator&quot;), in an individual / sole proprietor capacity pending corporate incorporation. By registering, you acknowledge and agree that this agreement constitutes a binding legal agreement between your participating firm and the Operator. Any successor incorporated legal entity formed by the Operator shall automatically assume all rights and obligations hereunder.
                </p>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-950">1. Pilot Cohort &amp; 3-Month Free Evaluation License</h3>
                <p className="mt-2 text-slate-600">
                  Subject to your adherence to these terms, the Operator grants your firm a limited, non-exclusive, revocable, non-transferable, and royalty-free evaluation license to access and use the Docketra platform for a duration of <strong>three (3) consecutive months</strong> starting on the date of workspace verification (&quot;Pilot Period&quot;).
                </p>
                <ul className="mt-2 list-disc pl-5 space-y-1 text-slate-600">
                  <li><strong>Zero Cost:</strong> No subscription fees, platform licensing fees, or credit card commitments are required during the Pilot Period.</li>
                  <li><strong>Feature Access:</strong> Includes access to client memory, docket lifecycle trackers, team worklists, and QC review gates.</li>
                  <li><strong>Evaluation Scope:</strong> Use is strictly for internal practice management evaluation by Company Secretaries, Chartered Accountants, Corporate Legal, and Compliance practitioners.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-950">2. Intellectual Property &amp; Firm Data Ownership</h3>
                <p className="mt-2 text-slate-600">
                  <strong>Operator IP:</strong> The Operator retains all right, title, interest, and intellectual property rights in and to the Software, user interfaces, database designs, system architecture, trade secrets, documentation, and the &quot;Docketra&quot; brand.
                </p>
                <p className="mt-2 text-slate-600">
                  <strong>Your Practice Data:</strong> Your firm retains complete and exclusive ownership of all confidential client lists, case notes, attachments, and proprietary business data uploaded to your workspace. The Operator processes this data solely to provide and maintain the service for your firm.
                </p>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-950">3. Feedback &amp; Improvements</h3>
                <p className="mt-2 text-slate-600">
                  Any feedback, suggestions, feature ideas, error logs, or usability critiques provided by your firm during the pilot may be freely implemented and commercialized by the Operator to refine Docketra without compensation, royalty, or attribution obligations.
                </p>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-950">4. Termination &amp; Transition</h3>
                <p className="mt-2 text-slate-600">
                  Either party may terminate the pilot evaluation at any time, with or without cause, upon written or electronic notice. Upon expiration or termination of the 3-Month Pilot Period, the Operator will provide a reasonable opportunity (minimum 14 calendar days) for your firm to export its client and docket records prior to workspace deactivation.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="space-y-5">
              <div className="rounded-2xl border-2 border-rose-300 bg-rose-50/80 p-4">
                <h4 className="font-black text-rose-950 text-xs uppercase tracking-wider">
                  ⚠️ Critical Statutory &amp; Professional Liability Disclaimer
                </h4>
                <p className="mt-2 text-xs font-medium text-rose-900 leading-relaxed">
                  <strong>NO LEGAL, COMPLIANCE, SECRETARIAL, OR ACCOUNTING ADVICE:</strong> Docketra is an administrative workflow, docket tracking, and office management software utility. <strong>The Operator (Sarvesh Gupte) is not a law firm, company secretary practice, chartered accountancy firm, or registered tax advisory firm.</strong> Docketra does NOT review, certify, validate, or provide professional opinions on statutory documents or regulatory submissions.
                </p>
                <p className="mt-2 text-xs font-medium text-rose-900 leading-relaxed">
                  <strong>FIRM&apos;S SOLE AND EXCLUSIVE RESPONSIBILITY:</strong> Participating professionals, partners, and firms retain 100% sole responsibility for verifying all MCA/ROC due dates, GST returns, Income Tax filings, TDS reconciliation, court listings, and statutory deadlines. Under no circumstances shall Docketra or Sarvesh Gupte be liable for missed deadlines, late filing penalties, statutory fees, notices, regulatory prosecution, disciplinary inquiries, or loss of client goodwill.
                </p>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-950">1. Permissible Use &amp; Account Security</h3>
                <p className="mt-2 text-slate-600">
                  You agree to use the platform solely for lawful professional practice operations. You must safeguard administrative credentials (including xID identifiers and OTP verification mechanisms) and immediately report any unauthorized security incident or compromise.
                </p>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-950">2. &quot;As-Is&quot; &amp; &quot;As-Available&quot; Warranty Disclaimer</h3>
                <p className="mt-2 text-slate-600">
                  THE SERVICE IS PROVIDED STRICTLY ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS. TO THE MAXIMUM EXTENT PERMITTED UNDER APPLICABLE LAW, THE OPERATOR EXPRESSLY DISCLAIMS ALL WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, UPTIME GUARANTEES, ACCURACY OF CALCULATED DATES, OR NON-INFRINGEMENT.
                </p>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-950">3. Absolute Limitation of Liability (INR ₹0 Evaluation Cap)</h3>
                <p className="mt-2 text-slate-600">
                  TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE INDIAN LAW, IN NO EVENT SHALL THE OPERATOR (SARVESH GUPTE), HIS AFFILIATES, AGENTS, OR LICENSORS BE LIABLE FOR ANY INDIRECT, PUNITIVE, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES, INCLUDING DAMAGES FOR LOSS OF PROFITS, DATA, USE, GOODWILL, OR PRACTICE DISRUPTION.
                </p>
                <p className="mt-2 text-slate-600">
                  BECAUSE THE PILOT EVALUATION IS PROVIDED ENTIRELY FREE OF CHARGE, THE TOTAL CUMULATIVE LIABILITY OF THE OPERATOR ARISING OUT OF OR RELATING TO THIS AGREEMENT OR THE SOFTWARE SHALL BE CAPPED AT <strong>INR ₹0 (ZERO INDIAN RUPEES)</strong>.
                </p>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-950">4. Governing Law &amp; Dispute Jurisdiction</h3>
                <p className="mt-2 text-slate-600">
                  This Agreement and any dispute arising out of or related to Docketra shall be governed by and construed in accordance with the substantive laws of the Republic of India, without regard to conflicts of law principles.
                </p>
                <p className="mt-2 text-slate-600">
                  Any legal proceeding, lawsuit, or arbitration controversy arising hereunder shall be submitted to the exclusive jurisdiction of the competent courts located in <strong>Mumbai / Thane, Maharashtra, India</strong>.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
                <h4 className="font-bold text-sky-950 text-xs uppercase tracking-wider">
                  India Data Residency &amp; Tenant Sovereignty Posture
                </h4>
                <p className="mt-1 text-xs text-sky-900 leading-normal">
                  Docketra is architected for Indian compliance professionals. Your tenant workspace is provisioned with India-based cloud storage posture and strict logical tenant isolation at every layer.
                </p>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-950">1. Data Storage &amp; Isolation</h3>
                <p className="mt-2 text-slate-600">
                  All databases and servers utilize hardened multi-tenant isolation. Each firm&apos;s records are partitioned by unique tenant credentials (`firmId`), ensuring no inter-mingling of confidential client records, dockets, or notes across different firms.
                </p>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-950">2. Bring Your Own Storage (BYOS) Integration</h3>
                <p className="mt-2 text-slate-600">
                  For firms with stringent enterprise client confidentiality requirements, Docketra supports direct cloud drive integration (Google Drive, Microsoft OneDrive, or AWS S3). When BYOS is enabled, all document binaries reside directly inside your firm&apos;s cloud drive, with Docketra retaining only pointer metadata.
                </p>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-950">3. Zero Data Monetization</h3>
                <p className="mt-2 text-slate-600">
                  We never sell, rent, monetize, or broker your firm&apos;s data or your clients&apos; data to any third party, advertising network, or data aggregator. Data is accessed strictly on a need-to-know basis for customer-authorized technical support.
                </p>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-950">4. Immutable Clickwrap Audit Trail</h3>
                <p className="mt-2 text-slate-600">
                  In accordance with the Information Technology Act, 2000 and Indian evidence standards, when you register a firm, Docketra records an immutable cryptographic audit record of your clickwrap consent, including:
                </p>
                <ul className="mt-2 list-disc pl-5 space-y-1 text-slate-600">
                  <li>UTC &amp; IST timestamp of consent execution (`agreedAt`)</li>
                  <li>Signer&apos;s IP address (`ipAddress`)</li>
                  <li>Signer&apos;s browser User-Agent string (`userAgent`)</li>
                  <li>Terms and Privacy version identifiers ({PILOT_TERMS_VERSION})</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/90 px-6 py-4">
          <p className="text-xs text-slate-500">
            Reviewing terms does not modify or submit your registration form.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
            {onAccept && (
              <button
                type="button"
                onClick={() => {
                  onAccept();
                  onClose();
                }}
                className="rounded-xl bg-slate-950 px-5 py-2 text-xs font-black text-white hover:bg-slate-800"
              >
                Accept &amp; Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PilotAgreementModal;
