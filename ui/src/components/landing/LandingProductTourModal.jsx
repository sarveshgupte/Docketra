import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const TOUR_STEPS = [
  {
    step: 1,
    id: 'command-center',
    badge: 'Statutory Radar',
    badgeColor: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    title: 'PCS Daily Command Center',
    subtitle: 'Your morning operational radar for Indian professional firms',
    description:
      'Track statutory liabilities before penalties compound. Instantly monitor overdue MCA filings, GST returns, upcoming 7-day deadlines, NCLT tribunal cause lists, and client Director DSC signatures from a single high-density screen.',
    highlights: [
      'Zero layout shift with dense 36px table rows',
      'Tabular monospace formatting for CIN, PAN, and DIN',
      'One-click clipboard copy on all statutory identifiers',
      'Direct shortcut into client dossiers and dockets',
    ],
    previewType: 'command-center',
  },
  {
    step: 2,
    id: 'workbaskets',
    badge: 'Queue Architecture',
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    title: 'Operational Workbaskets & Worklists',
    subtitle: 'Zero dropped filings between intake and execution',
    description:
      'Work flows methodically through Intake → Shared Workbasket → Personal Worklist → QC Review → Completion. Practitioners can pull matters when ready, or managers can assign based on team capacity.',
    highlights: [
      'Shared queue eliminates unassigned task black holes',
      'Prioritized by statutory deadline and penalty risk',
      'Automatic SLA countdown on pending client filings',
      'Immutable audit log tracking every handoff and status shift',
    ],
    previewType: 'workbaskets',
  },
  {
    step: 3,
    id: 'client-workspace',
    badge: '3-Pane Entity Master',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    title: 'Corporate Client Workspace',
    subtitle: '3-Pane Entity Workspace keeping all context attached',
    description:
      'Never lose client context across WhatsApp or email threads. Left pane anchors entity identity (CIN, PAN, ROC, capital, directors). Center pane switches between statutory filings and tribunal litigation. Right pane tracks Next Date of Hearing (NDOH) and documents.',
    highlights: [
      'Entity master with real-time director DSC validity tracking',
      'Dual roadmap: Statutory Roadmap & NCLT Litigation Timeline',
      'Live NDOH urgency counter with cause list tracking',
      'Contextual docket vault attached directly to the corporate client',
    ],
    previewType: 'client-workspace',
  },
  {
    step: 4,
    id: 'byos',
    badge: 'Zero-Custody Storage',
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    title: 'Zero-Custody Document Vault (BYOS)',
    subtitle: 'Bring Your Own Storage: Google Drive / AWS S3',
    description:
      'Your firm’s confidential client filings, board resolutions, and litigation papers stay entirely in your firm’s cloud storage. Docketra never takes permanent custody of sensitive client documents.',
    highlights: [
      'Direct Google Drive & S3 cloud synchronization',
      'Deterministic folder hierarchy: Google Drive > Docketra > Firm > Cases',
      'SHA-256 checksum verification for tamper-evident file integrity',
      'Zero vendor lock-in — your files always remain yours',
    ],
    previewType: 'byos',
  },
  {
    step: 5,
    id: 'qc',
    badge: 'Quality Control Gate',
    badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    title: 'Two-Tier QC & Partner Visibility',
    subtitle: 'Mandatory review gates before MCA upload or client dispatch',
    description:
      'Enforce strict compliance quality before submissions leave your firm. Junior filings must pass dedicated QC review queues. Partners get live bird’s-eye dashboards on bottlenecks, workload distribution, and billing readiness.',
    highlights: [
      'Maker-checker review gates preventing filing defects',
      'Inline exception comments directly anchored to dockets',
      'Real-time firm health metrics and partner oversight',
      'Permanent compliance audit trail with cryptographic timestamps',
    ],
    previewType: 'qc',
  },
];

export function LandingProductTourModal({ isOpen, onClose, onNavigateToSection }) {
  const [stepIndex, setStepIndex] = useState(0);
  const navigate = useNavigate();

  const currentStep = TOUR_STEPS[stepIndex];
  const isLastStep = stepIndex === TOUR_STEPS.length - 1;

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        setStepIndex((prev) => Math.min(TOUR_STEPS.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        setStepIndex((prev) => Math.max(0, prev - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (isLastStep) {
      onClose();
      navigate('/signup');
    } else {
      setStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    setStepIndex((prev) => Math.max(0, prev - 1));
  };

  const handleScrollToSection = (sectionId) => {
    onClose();
    if (onNavigateToSection) {
      onNavigateToSection(sectionId);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-modal-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl rounded-lg border border-slate-200/90 bg-white text-slate-900 shadow-2xl overflow-hidden flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Line */}
        <div className="h-1 w-full bg-amber-500" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 border border-amber-200 text-amber-700">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-tight text-slate-950">Docketra Product Tour</span>
                <span className="rounded-xs border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase text-amber-800">
                  Interactive
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-600">
                A tour of the operating system built for Indian CS, CA & Legal practices
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            aria-label="Close tour"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step Indicator Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/40 px-6 py-2 overflow-x-auto gap-1.5 no-scrollbar">
          {TOUR_STEPS.map((step, idx) => {
            const isActive = idx === stepIndex;
            const isCompleted = idx < stepIndex;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setStepIndex(idx)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-950 text-white font-semibold shadow-xs'
                    : isCompleted
                    ? 'text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 bg-white'
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-xs text-[10px] font-mono font-bold ${
                    isActive
                      ? 'bg-amber-400 text-slate-950'
                      : isCompleted
                      ? 'text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {isCompleted ? '✓' : step.step}
                </span>
                <span>{step.title.split(' ')[0]} {step.title.split(' ')[1]}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Main Body */}
        <div className="p-6 grid gap-6 lg:grid-cols-12 items-start">
          {/* Left Column: Context & Explanations (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center rounded-xs border px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider ${currentStep.badgeColor}`}>
                {currentStep.badge}
              </span>
              <span className="text-[11px] font-mono text-slate-500">Step {currentStep.step} of 5</span>
            </div>

            <h3 id="tour-modal-title" className="text-xl font-black tracking-tight text-slate-950">
              {currentStep.title}
            </h3>

            <p className="text-xs font-semibold text-amber-800 leading-snug">
              {currentStep.subtitle}
            </p>

            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              {currentStep.description}
            </p>

            {/* Highlights List */}
            <div className="space-y-2 pt-2">
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                Operational Advantages:
              </p>
              <ul className="space-y-1.5">
                {currentStep.highlights.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-slate-700">
                    <span className="text-amber-700 shrink-0 mt-0.5 font-bold">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Column: High-Density Interactive Simulated View (7 cols) */}
          <div className="lg:col-span-7 rounded-md border border-slate-200 bg-slate-50/60 p-4 shadow-2xs">
            {currentStep.previewType === 'command-center' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold text-slate-950">Morning Statutory Radar</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-700 bg-white px-1.5 py-0.5 rounded-xs border border-slate-200 uppercase font-semibold">
                    FY 25-26
                  </span>
                </div>

                {/* 4 KPI Blocks */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-md border border-rose-200 bg-white p-2 text-left shadow-2xs">
                    <div className="font-mono text-lg font-bold text-rose-700">14</div>
                    <div className="text-[9px] font-mono uppercase text-rose-800 tracking-tight leading-tight mt-0.5 font-semibold">Overdue Filings</div>
                  </div>
                  <div className="rounded-md border border-amber-200 bg-white p-2 text-left shadow-2xs">
                    <div className="font-mono text-lg font-bold text-amber-800">28</div>
                    <div className="text-[9px] font-mono uppercase text-amber-800 tracking-tight leading-tight mt-0.5 font-semibold">T-7 Deadlines</div>
                  </div>
                  <div className="rounded-md border border-sky-200 bg-white p-2 text-left shadow-2xs">
                    <div className="font-mono text-lg font-bold text-sky-800">05</div>
                    <div className="text-[9px] font-mono uppercase text-sky-800 tracking-tight leading-tight mt-0.5 font-semibold">Tribunal Hearings</div>
                  </div>
                  <div className="rounded-md border border-purple-200 bg-white p-2 text-left shadow-2xs">
                    <div className="font-mono text-lg font-bold text-purple-800">19</div>
                    <div className="text-[9px] font-mono uppercase text-purple-800 tracking-tight leading-tight mt-0.5 font-semibold">DSC Signatures</div>
                  </div>
                </div>

                {/* Sample Radar Table */}
                <div className="rounded-md border border-slate-200 bg-white overflow-hidden text-[11px] shadow-2xs">
                  <div className="grid grid-cols-12 bg-slate-50 px-2.5 py-1.5 font-mono text-[10px] text-slate-600 font-bold uppercase border-b border-slate-200">
                    <div className="col-span-5">CLIENT & CIN</div>
                    <div className="col-span-3">DUE DATE</div>
                    <div className="col-span-4 text-right">STATUS</div>
                  </div>
                  <div className="divide-y divide-slate-100 font-medium">
                    <div className="grid grid-cols-12 items-center px-2.5 py-2 hover:bg-slate-50/70 transition-colors">
                      <div className="col-span-5">
                        <p className="font-bold text-slate-900 truncate">Zenith Infra Pvt Ltd</p>
                        <p className="font-mono text-[9px] text-slate-500">U72200MH2021PTC368942</p>
                      </div>
                      <div className="col-span-3 font-mono text-rose-700 text-[10px] font-semibold">Overdue · -2d</div>
                      <div className="col-span-4 text-right">
                        <span className="rounded-xs border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[9px] font-mono uppercase font-bold text-rose-800">
                          DIR-3 KYC
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-12 items-center px-2.5 py-2 hover:bg-slate-50/70 transition-colors">
                      <div className="col-span-5">
                        <p className="font-bold text-slate-900 truncate">Neo Retail Pvt Ltd</p>
                        <p className="font-mono text-[9px] text-slate-500">U52100DL2019PTC345112</p>
                      </div>
                      <div className="col-span-3 font-mono text-amber-800 text-[10px] font-semibold">T-3 Days</div>
                      <div className="col-span-4 text-right">
                        <span className="rounded-xs border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-mono uppercase font-bold text-amber-800">
                          AOC-4 XBRL
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep.previewType === 'workbaskets' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <span className="text-xs font-bold text-slate-950">Execution Pipeline</span>
                  <span className="text-[10px] font-mono text-purple-800 uppercase tracking-wider font-semibold">Queue Architecture</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2.5 rounded-md bg-white border border-slate-200 shadow-2xs">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-xs bg-slate-100 text-[10px] font-mono text-slate-800 font-bold border border-slate-200">1</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-slate-900">Shared Workbasket</p>
                      <p className="text-[10px] text-slate-500 truncate">ROC Filings Queue (8 unassigned matters)</p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-xs uppercase">Pool</span>
                  </div>

                  <div className="flex justify-center text-slate-400 text-xs leading-none">↓ pull / allocate</div>

                  <div className="flex items-center gap-2 p-2.5 rounded-md bg-purple-50/60 border border-purple-200">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-xs bg-purple-100 text-[10px] font-mono text-purple-800 font-bold border border-purple-200">2</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-purple-950">Personal Worklist</p>
                      <p className="text-[10px] text-purple-800 truncate">Assigned to: Senior Associate (Arjun M.)</p>
                    </div>
                    <span className="text-[10px] font-mono text-purple-800 bg-purple-100 px-1.5 py-0.5 rounded-xs uppercase font-bold">Active</span>
                  </div>

                  <div className="flex justify-center text-slate-400 text-xs leading-none">↓ review gate</div>

                  <div className="flex items-center gap-2 p-2.5 rounded-md bg-white border border-slate-200 shadow-2xs">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-xs bg-emerald-50 text-[10px] font-mono text-emerald-800 font-bold border border-emerald-200">3</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-slate-900">Quality Control (QC)</p>
                      <p className="text-[10px] text-slate-500 truncate">Two-tier sign-off before MCA submission</p>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded-xs uppercase font-bold border border-emerald-200">Gate</span>
                  </div>
                </div>
              </div>
            )}

            {currentStep.previewType === 'client-workspace' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <span className="text-xs font-bold text-slate-950">3-Pane Entity Architecture</span>
                  <span className="text-[10px] font-mono font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-xs">Zenith Infra Pvt Ltd</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  {/* Left Pane */}
                  <div className="rounded-md border border-slate-200 bg-white p-2 space-y-1.5 shadow-2xs">
                    <div className="font-mono text-[9px] text-slate-500 uppercase font-bold">Pane 1: Entity Master</div>
                    <div className="font-bold text-slate-900">CIN Copy</div>
                    <div className="font-mono text-[9px] text-amber-800 font-bold break-all">U72200MH2021PTC368942</div>
                    <div className="border-t border-slate-100 pt-1 text-[9px] text-slate-500">
                      <div>PAN: AAACZ1234F</div>
                      <div>ROC: Mumbai</div>
                    </div>
                  </div>

                  {/* Center Pane */}
                  <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-2 space-y-1.5 shadow-2xs">
                    <div className="font-mono text-[9px] text-emerald-800 uppercase font-bold">Pane 2: Roadmap</div>
                    <div className="font-bold text-slate-900">Dual Timeline</div>
                    <div className="rounded-xs bg-white border border-emerald-100 p-1 text-[9px] text-slate-700">
                      <span className="text-emerald-600 font-bold">●</span> MGT-7 Annual Return
                    </div>
                    <div className="rounded-xs bg-white border border-emerald-100 p-1 text-[9px] text-slate-700">
                      <span className="text-sky-600 font-bold">●</span> NCLT Oppression Pet.
                    </div>
                  </div>

                  {/* Right Pane */}
                  <div className="rounded-md border border-slate-200 bg-white p-2 space-y-1.5 shadow-2xs">
                    <div className="font-mono text-[9px] text-slate-500 uppercase font-bold">Pane 3: Vault</div>
                    <div className="font-bold text-slate-900">Next Hearing</div>
                    <div className="rounded-xs bg-rose-50 border border-rose-200 p-1 text-[9px] text-rose-800 font-mono font-bold">
                      NDOH: 28-Sep-26
                    </div>
                    <div className="text-[9px] text-slate-500 font-medium">Google Drive: 14 Docs</div>
                  </div>
                </div>
              </div>
            )}

            {currentStep.previewType === 'byos' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <span className="text-xs font-bold text-slate-950">Bring Your Own Storage (BYOS)</span>
                  <span className="text-[10px] font-mono text-amber-800 uppercase tracking-wider font-semibold">Zero Custody</span>
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-3 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-xs bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-mono font-bold text-slate-900">
                        G
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Google Drive Integration</p>
                        <p className="text-[10px] text-slate-500">Direct OAuth / Service Account</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1.5 rounded-xs bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-mono text-emerald-800 uppercase font-bold">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                      CONNECTED
                    </span>
                  </div>

                  <div className="rounded-xs bg-slate-50 p-2 font-mono text-[10px] text-slate-700 border border-slate-200">
                    <div className="text-slate-500"># Deterministic storage hierarchy</div>
                    <div className="text-amber-800 font-bold">/Firm Drive/Docketra/Zenith_Infra/MCA_Filings/2026/</div>
                  </div>

                  <p className="text-[10px] text-slate-600 leading-relaxed">
                    Client agreements, audited balance sheets, and secretarial audit certificates are uploaded straight to your Google Drive or AWS S3.
                  </p>
                </div>
              </div>
            )}

            {currentStep.previewType === 'qc' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <span className="text-xs font-bold text-slate-950">Quality Control & Audit Trail</span>
                  <span className="text-[10px] font-mono text-purple-800 uppercase tracking-wider font-semibold">Safety Gate</span>
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-3 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900">AOC-4 XBRL Filing Sign-off</p>
                      <p className="text-[10px] font-mono text-slate-500">Docket #DKT-2026-0842</p>
                    </div>
                    <span className="rounded-xs bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 text-[9px] font-mono uppercase font-bold">
                      QC Pending
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1 text-[10px]">
                    <div className="flex items-center justify-between rounded-xs bg-slate-50 px-2 py-1 text-slate-700 border border-slate-100">
                      <span>✓ Director DSC Signature verified</span>
                      <span className="font-mono text-[9px] text-emerald-700 font-bold">Valid till 2027</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xs bg-slate-50 px-2 py-1 text-slate-700 border border-slate-100">
                      <span>✓ Board Resolution & Notice attached</span>
                      <span className="font-mono text-[9px] text-emerald-700 font-bold">Google Drive</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xs bg-slate-50 px-2 py-1 text-slate-700 border border-slate-100">
                      <span>✓ MCA Challan calculation verified</span>
                      <span className="font-mono text-[9px] text-emerald-700 font-bold">₹600 Fee</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px]">
                    <span className="text-slate-500 font-mono">Checker: Partner Review</span>
                    <span className="text-emerald-700 font-bold">Approve & Release →</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrev}
              disabled={stepIndex === 0}
              className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
            >
              ← Back
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-slate-950 px-3.5 text-xs font-bold text-white transition-colors hover:bg-slate-800 cursor-pointer shadow-xs"
            >
              <span>{isLastStep ? 'Complete Tour & Get Started' : 'Next Step'}</span>
              <span>→</span>
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <button
              type="button"
              onClick={() => handleScrollToSection('product')}
              className="text-slate-500 hover:text-slate-900 transition-colors text-[11px] font-medium underline underline-offset-4 cursor-pointer"
            >
              Explore feature architecture below ↓
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('/signup');
              }}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-white border border-slate-300 px-3 text-xs font-semibold text-slate-900 transition-colors hover:bg-slate-100 cursor-pointer shadow-2xs"
            >
              Create workspace
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LandingProductTourModal;
