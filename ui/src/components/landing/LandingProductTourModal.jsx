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
    subtitle: 'HubSpot-inspired 3-pane layout keeping context attached',
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-modal-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl rounded-2xl border border-slate-800 bg-[#0B0F19] text-slate-100 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Line */}
        <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-sky-500 to-emerald-500" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-6 py-4 bg-[#090D16]">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-tight text-white">Docketra Product Tour</span>
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-mono font-bold text-amber-300">
                  Interactive
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-400">
                A tour of the operating system built for Indian CS, CA & Legal practices
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Close tour"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step Indicator Navigation Tabs */}
        <div className="flex border-b border-slate-800/80 bg-slate-950/50 px-6 py-2.5 overflow-x-auto gap-2 no-scrollbar">
          {TOUR_STEPS.map((step, idx) => {
            const isActive = idx === stepIndex;
            const isCompleted = idx < stepIndex;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setStepIndex(idx)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-slate-800 text-amber-400 border border-slate-700 shadow-sm'
                    : isCompleted
                    ? 'text-slate-300 hover:text-white hover:bg-slate-900'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-mono font-bold ${
                    isActive
                      ? 'bg-amber-400 text-slate-950'
                      : isCompleted
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400'
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
              <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider ${currentStep.badgeColor}`}>
                {currentStep.badge}
              </span>
              <span className="text-[11px] font-mono text-slate-500">Step {currentStep.step} of 5</span>
            </div>

            <h3 id="tour-modal-title" className="text-xl font-black tracking-tight text-white">
              {currentStep.title}
            </h3>

            <p className="text-xs font-semibold text-amber-400 leading-snug">
              {currentStep.subtitle}
            </p>

            <p className="text-xs text-slate-300 leading-relaxed font-normal">
              {currentStep.description}
            </p>

            {/* Highlights List */}
            <div className="space-y-2 pt-2">
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Operational Advantages:
              </p>
              <ul className="space-y-1.5">
                {currentStep.highlights.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-slate-300">
                    <span className="text-amber-400 shrink-0 mt-0.5">✦</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Column: High-Density Interactive Simulated View (7 cols) */}
          <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-[#090D16] p-4 shadow-inner">
            {currentStep.previewType === 'command-center' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="text-xs font-bold text-white">Morning Statutory Radar</span>
                  </div>
                  <span className="font-mono text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                    FY 25-26
                  </span>
                </div>

                {/* 4 KPI Blocks */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-2 text-left">
                    <div className="font-mono text-lg font-black text-rose-400">14</div>
                    <div className="text-[9px] font-bold text-rose-300 uppercase tracking-tight leading-tight mt-0.5">Overdue Filings</div>
                  </div>
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-left">
                    <div className="font-mono text-lg font-black text-amber-400">28</div>
                    <div className="text-[9px] font-bold text-amber-300 uppercase tracking-tight leading-tight mt-0.5">T-7 Deadlines</div>
                  </div>
                  <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-2 text-left">
                    <div className="font-mono text-lg font-black text-sky-400">05</div>
                    <div className="text-[9px] font-bold text-sky-300 uppercase tracking-tight leading-tight mt-0.5">Tribunal Hearings</div>
                  </div>
                  <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-2 text-left">
                    <div className="font-mono text-lg font-black text-purple-400">19</div>
                    <div className="text-[9px] font-bold text-purple-300 uppercase tracking-tight leading-tight mt-0.5">DSC Signatures</div>
                  </div>
                </div>

                {/* Sample Radar Table */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden text-[11px]">
                  <div className="grid grid-cols-12 bg-slate-900/80 px-2.5 py-1.5 font-mono text-[10px] text-slate-400 border-b border-slate-800">
                    <div className="col-span-5">CLIENT & CIN</div>
                    <div className="col-span-3">DUE DATE</div>
                    <div className="col-span-4 text-right">STATUS</div>
                  </div>
                  <div className="divide-y divide-slate-800/60 font-medium">
                    <div className="grid grid-cols-12 items-center px-2.5 py-2 hover:bg-slate-900/40">
                      <div className="col-span-5">
                        <p className="font-bold text-slate-200 truncate">Zenith Infra Pvt Ltd</p>
                        <p className="font-mono text-[9px] text-slate-500">U72200MH2021PTC368942</p>
                      </div>
                      <div className="col-span-3 font-mono text-rose-400 text-[10px]">Overdue · -2d</div>
                      <div className="col-span-4 text-right">
                        <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-400 border border-rose-500/30">
                          DIR-3 KYC
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-12 items-center px-2.5 py-2 hover:bg-slate-900/40">
                      <div className="col-span-5">
                        <p className="font-bold text-slate-200 truncate">Neo Retail Pvt Ltd</p>
                        <p className="font-mono text-[9px] text-slate-500">U52100DL2019PTC345112</p>
                      </div>
                      <div className="col-span-3 font-mono text-amber-400 text-[10px]">T-3 Days</div>
                      <div className="col-span-4 text-right">
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-400 border border-amber-500/30">
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
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <span className="text-xs font-bold text-white">Execution Pipeline</span>
                  <span className="text-[10px] font-mono text-purple-400">Queue Architecture</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-800 text-[10px] font-mono text-amber-400 font-bold">1</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-slate-200">Shared Workbasket</p>
                      <p className="text-[10px] text-slate-400 truncate">ROC Filings Queue (8 unassigned matters)</p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded">Pool</span>
                  </div>

                  <div className="flex justify-center text-slate-600 text-xs leading-none">↓ pull / allocate</div>

                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-purple-950/20 border border-purple-800/40">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-purple-900/60 text-[10px] font-mono text-purple-300 font-bold">2</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-purple-200">Personal Worklist</p>
                      <p className="text-[10px] text-purple-400/80 truncate">Assigned to: Senior Associate (Arjun M.)</p>
                    </div>
                    <span className="text-[10px] font-mono text-purple-300 bg-purple-900/40 px-2 py-0.5 rounded">Active</span>
                  </div>

                  <div className="flex justify-center text-slate-600 text-xs leading-none">↓ review gate</div>

                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-800 text-[10px] font-mono text-emerald-400 font-bold">3</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-slate-200">Quality Control (QC)</p>
                      <p className="text-[10px] text-slate-400 truncate">Two-tier sign-off before MCA submission</p>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded">Gate</span>
                  </div>
                </div>
              </div>
            )}

            {currentStep.previewType === 'client-workspace' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <span className="text-xs font-bold text-white">HubSpot 3-Pane Architecture</span>
                  <span className="text-[10px] font-mono text-emerald-400">Zenith Infra Pvt Ltd</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  {/* Left Pane */}
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-2 space-y-1.5">
                    <div className="font-mono text-[9px] text-slate-500 uppercase font-bold">Pane 1: Entity Master</div>
                    <div className="font-bold text-slate-200">CIN Copy</div>
                    <div className="font-mono text-[9px] text-amber-400 break-all">U72200MH2021PTC368942</div>
                    <div className="border-t border-slate-900 pt-1 text-[9px] text-slate-400">
                      <div>PAN: AAACZ1234F</div>
                      <div>ROC: Mumbai</div>
                    </div>
                  </div>

                  {/* Center Pane */}
                  <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/10 p-2 space-y-1.5">
                    <div className="font-mono text-[9px] text-emerald-400 uppercase font-bold">Pane 2: Roadmap</div>
                    <div className="font-bold text-slate-200">Dual Timeline</div>
                    <div className="rounded bg-slate-900 p-1 text-[9px] text-slate-300">
                      <span className="text-emerald-400">●</span> MGT-7 Annual Return
                    </div>
                    <div className="rounded bg-slate-900 p-1 text-[9px] text-slate-300">
                      <span className="text-sky-400">●</span> NCLT Oppression Pet.
                    </div>
                  </div>

                  {/* Right Pane */}
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-2 space-y-1.5">
                    <div className="font-mono text-[9px] text-slate-500 uppercase font-bold">Pane 3: Vault</div>
                    <div className="font-bold text-slate-200">Next Hearing</div>
                    <div className="rounded bg-rose-950/40 border border-rose-800/40 p-1 text-[9px] text-rose-300 font-mono">
                      NDOH: 28-Sep-26
                    </div>
                    <div className="text-[9px] text-slate-400">Google Drive: 14 Docs</div>
                  </div>
                </div>
              </div>
            )}

            {currentStep.previewType === 'byos' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <span className="text-xs font-bold text-white">Bring Your Own Storage (BYOS)</span>
                  <span className="text-[10px] font-mono text-amber-400">Zero Custody</span>
                </div>

                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded bg-white flex items-center justify-center text-xs font-black text-slate-900">
                        G
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Google Drive Integration</p>
                        <p className="text-[10px] text-slate-400">Direct OAuth / Service Account</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-mono text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      CONNECTED
                    </span>
                  </div>

                  <div className="rounded bg-slate-950 p-2 font-mono text-[10px] text-slate-400 border border-slate-800/60">
                    <div className="text-slate-500"># Deterministic storage hierarchy</div>
                    <div className="text-amber-300">/Firm Drive/Docketra/Zenith_Infra/MCA_Filings/2026/</div>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Client agreements, audited balance sheets, and secretarial audit certificates are uploaded straight to your Google Drive or AWS S3.
                  </p>
                </div>
              </div>
            )}

            {currentStep.previewType === 'qc' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <span className="text-xs font-bold text-white">Quality Control & Audit Trail</span>
                  <span className="text-[10px] font-mono text-rose-400">Safety Gate</span>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-200">AOC-4 XBRL Filing Sign-off</p>
                      <p className="text-[10px] font-mono text-slate-500">Docket #DKT-2026-0842</p>
                    </div>
                    <span className="rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 text-[9px] font-bold">
                      QC Pending
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1 text-[10px]">
                    <div className="flex items-center justify-between rounded bg-slate-900 px-2 py-1 text-slate-300">
                      <span>✓ Director DSC Signature verified</span>
                      <span className="font-mono text-[9px] text-emerald-400">Valid till 2027</span>
                    </div>
                    <div className="flex items-center justify-between rounded bg-slate-900 px-2 py-1 text-slate-300">
                      <span>✓ Board Resolution & Notice attached</span>
                      <span className="font-mono text-[9px] text-emerald-400">Google Drive</span>
                    </div>
                    <div className="flex items-center justify-between rounded bg-slate-900 px-2 py-1 text-slate-300">
                      <span>✓ MCA Challan calculation verified</span>
                      <span className="font-mono text-[9px] text-emerald-400">₹600 Fee</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 font-mono">Checker: Partner Review</span>
                    <span className="text-emerald-400 font-bold">Approve & Release →</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800/80 bg-[#090D16] px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrev}
              disabled={stepIndex === 0}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 px-3.5 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Back
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-4 text-xs font-black text-slate-950 shadow-md transition-all hover:bg-amber-400 active:scale-95"
            >
              <span>{isLastStep ? 'Complete Tour & Get Started' : 'Next Step'}</span>
              <span>→</span>
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <button
              type="button"
              onClick={() => handleScrollToSection('product')}
              className="text-slate-400 hover:text-amber-400 transition-colors text-[11px] font-semibold underline underline-offset-4"
            >
              Explore feature architecture below ↓
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('/signup');
              }}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-slate-800 border border-slate-700 px-4 text-xs font-bold text-white transition-colors hover:bg-slate-700"
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
