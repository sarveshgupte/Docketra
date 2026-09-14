import React, { useState } from 'react';

const CANVAS_TABS = [
  {
    id: 'radar',
    label: 'Daily Command Center',
    shortLabel: 'Radar',
    badge: 'Morning Radar',
    description: 'Instant morning visibility into statutory liabilities, T-7 deadlines, tribunal cause lists, and pending signatures.',
  },
  {
    id: 'workbaskets',
    label: 'Workbaskets & Queues',
    shortLabel: 'Workbaskets',
    badge: 'Zero Drop Queue',
    description: 'Incoming compliance matters route into shared workbaskets so tasks never sit unassigned in individual inboxes.',
  },
  {
    id: 'clients',
    label: '3-Pane Client Master',
    shortLabel: 'Client Master',
    badge: 'Unified Context',
    description: 'HubSpot-inspired 3-pane client workspace keeping corporate entity identity, filings roadmap, and hearing dates attached.',
  },
  {
    id: 'storage',
    label: 'Zero-Custody BYOS',
    shortLabel: 'BYOS Vault',
    badge: 'Firm Cloud Storage',
    description: 'Confidential client dossiers, board resolutions, and tax filings stay in your own Google Drive or AWS S3.',
  },
  {
    id: 'qc',
    label: 'Two-Tier QC Gates',
    shortLabel: 'QC & Review',
    badge: 'Compliance Gate',
    description: 'Maker-checker sign-off workflows preventing filing errors, missed attachments, or improper fee calculations.',
  },
];

export function InteractiveProductCanvas({ className = '' }) {
  const [activeTab, setActiveTab] = useState('radar');
  const [copiedText, setCopiedText] = useState(null);

  const handleCopy = (text) => {
    navigator.clipboard?.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1800);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Outer Glow Halo */}
      <div className="absolute -inset-1 rounded-[2.2rem] bg-gradient-to-r from-amber-500/20 via-sky-500/15 to-purple-500/20 blur-xl opacity-75 pointer-events-none" />

      {/* Hardware Doppelrand / Double Bezel Container */}
      <div className="relative rounded-[2rem] border border-slate-800 bg-[#070A11] p-2 shadow-2xl">
        {/* Inner Precision Bezel */}
        <div className="rounded-[calc(2rem-0.5rem)] border border-slate-800/90 bg-[#090D16] text-slate-100 overflow-hidden shadow-inner flex flex-col">
          {/* Top Window Bar */}
          <div className="flex flex-wrap items-center justify-between border-b border-slate-800/80 bg-[#06090F] px-4 py-2.5 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80 inline-block" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80 inline-block" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80 inline-block" />
              </div>
              <span className="text-[11px] font-mono text-slate-500 pl-1 font-semibold hidden sm:inline">
                docketra.in/app/firm/mehta-associates
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-[10px]">
              <span className="rounded bg-slate-800/90 border border-slate-700/60 px-2 py-0.5 font-bold text-amber-400">
                FY 25-26
              </span>
              <span className="flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                BYOS Connected
              </span>
            </div>
          </div>

          {/* Interactive Navigation Surface Pills */}
          <div className="flex border-b border-slate-800/80 bg-[#080C14] px-3 py-2 overflow-x-auto gap-1.5 no-scrollbar">
            {CANVAS_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow-md scale-[1.02]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <span>{tab.label}</span>
                  {isActive && (
                    <span className="rounded-full bg-slate-950/20 px-1.5 py-0.2 text-[9px] font-mono font-black uppercase">
                      Live
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Canvas Surface Display */}
          <div className="p-4 sm:p-5 min-h-[380px] flex flex-col justify-between bg-gradient-to-b from-[#090D16] to-[#070A12]">
            {/* 1. Daily Command Center */}
            {activeTab === 'radar' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* 4 Metric Strips */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-rose-300 font-bold">Overdue</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                    </div>
                    <div className="mt-1 font-mono text-2xl font-black text-rose-400">14</div>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">MCA / GST penalty risk</p>
                  </div>

                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-amber-300 font-bold">T-7 Days</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    </div>
                    <div className="mt-1 font-mono text-2xl font-black text-amber-400">28</div>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Upcoming statutory dates</p>
                  </div>

                  <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-sky-300 font-bold">Hearings</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                    </div>
                    <div className="mt-1 font-mono text-2xl font-black text-sky-400">05</div>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">NCLT / RD Cause List</p>
                  </div>

                  <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-purple-300 font-bold">Signatures</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                    </div>
                    <div className="mt-1 font-mono text-2xl font-black text-purple-400">19</div>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Pending Director DSC</p>
                  </div>
                </div>

                {/* Dense Monospace Statutory Radar Register */}
                <div className="rounded-xl border border-slate-800 bg-[#050810] overflow-hidden text-xs shadow-sm">
                  <div className="grid grid-cols-12 border-b border-slate-800 bg-slate-900/60 px-3 py-2 font-mono text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <div className="col-span-5">Client & CIN</div>
                    <div className="col-span-3">Statutory Form</div>
                    <div className="col-span-2">Deadline</div>
                    <div className="col-span-2 text-right">Status</div>
                  </div>

                  <div className="divide-y divide-slate-800/60">
                    {[
                      {
                        client: 'Zenith Infra Private Limited',
                        cin: 'U72200MH2021PTC368942',
                        form: 'DIR-3 KYC Web (3 Directors)',
                        deadline: 'Today',
                        badge: 'Critical',
                        color: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
                      },
                      {
                        client: 'Apex Capital Advisors LLP',
                        cin: 'AAB-4912 (LLP)',
                        form: 'Form 11 Annual Return',
                        deadline: 'In 3 days',
                        badge: 'T-3 Days',
                        color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                      },
                      {
                        client: 'Nexus Healthcare India Ltd',
                        cin: 'L85110KA2015PLC082341',
                        form: 'MGT-14 Board Resolution',
                        deadline: 'In 6 days',
                        badge: 'T-6 Days',
                        color: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
                      },
                    ].map((row, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 items-center px-3 py-2 hover:bg-slate-800/30 transition-colors"
                      >
                        <div className="col-span-5 min-w-0 pr-2">
                          <p className="font-bold text-slate-200 truncate">{row.client}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[10px] text-slate-500 truncate">{row.cin}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(row.cin)}
                              className="text-[9px] font-mono text-amber-400/80 hover:text-amber-300 underline"
                            >
                              {copiedText === row.cin ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        </div>
                        <div className="col-span-3 text-slate-300 font-medium text-[11px] truncate">{row.form}</div>
                        <div className="col-span-2 font-mono text-slate-400 text-[10px]">{row.deadline}</div>
                        <div className="col-span-2 text-right">
                          <span className={`inline-block rounded border px-2 py-0.5 text-[9px] font-mono font-bold ${row.color}`}>
                            {row.badge}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 2. Workbaskets & Queues */}
            {activeTab === 'workbaskets' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div>
                    <h4 className="text-sm font-bold text-white">Compliance Routing Architecture</h4>
                    <p className="text-[11px] text-slate-400">Never lose tasks between client intake and execution</p>
                  </div>
                  <span className="rounded bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-300">
                    Queue: Active (24 matters)
                  </span>
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-300">1. Intake Basket</span>
                      <span className="font-mono text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                        8 Unassigned
                      </span>
                    </div>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="p-2 rounded bg-slate-900/80 border border-slate-800/80">
                        <p className="font-bold text-slate-200 truncate">INC-22 Registered Office Shift</p>
                        <p className="text-[10px] text-slate-500 font-mono">BlueStone Foods • MCA</p>
                      </div>
                      <div className="p-2 rounded bg-slate-900/80 border border-slate-800/80">
                        <p className="font-bold text-slate-200 truncate">Quarterly Board Minutes Prep</p>
                        <p className="text-[10px] text-slate-500 font-mono">Arya Textiles • Secretarial</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 italic">Associates pull based on capacity</p>
                  </div>

                  <div className="rounded-xl border border-purple-800/40 bg-purple-950/15 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-purple-200">2. Active Worklist</span>
                      <span className="font-mono text-[10px] text-purple-300 bg-purple-900/40 px-1.5 py-0.5 rounded">
                        12 In Execution
                      </span>
                    </div>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="p-2 rounded bg-slate-900/90 border border-purple-700/30">
                        <p className="font-bold text-white truncate">DIR-12 Director Appointment</p>
                        <p className="text-[10px] text-purple-300 font-mono">Assignee: Arjun M. • Due Tomorrow</p>
                      </div>
                      <div className="p-2 rounded bg-slate-900/90 border border-purple-700/30">
                        <p className="font-bold text-white truncate">PAS-3 Return of Allotment</p>
                        <p className="text-[10px] text-purple-300 font-mono">Assignee: Sneha K. • Due in 2d</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-purple-400/80 italic">Clear ownership & statutory countdown</p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-300">3. QC Review Gate</span>
                      <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded">
                        4 Ready
                      </span>
                    </div>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="p-2 rounded bg-slate-900/80 border border-slate-800/80">
                        <p className="font-bold text-slate-200 truncate">AOC-4 Financial Filing</p>
                        <p className="text-[10px] text-emerald-400 font-mono">Checker: Partner Sign-off Pending</p>
                      </div>
                      <div className="p-2 rounded bg-slate-900/80 border border-slate-800/80">
                        <p className="font-bold text-slate-200 truncate">NCLT Scheme Application</p>
                        <p className="text-[10px] text-emerald-400 font-mono">Affidavit Attached • Final Review</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 italic">Zero defects dispatched to MCA</p>
                  </div>
                </div>
              </div>
            )}

            {/* 3. 3-Pane Client Master */}
            {activeTab === 'clients' && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <h4 className="text-sm font-bold text-white">HubSpot 3-Pane Entity Workspace</h4>
                  </div>
                  <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/30">
                    CIN: U72200MH2021PTC368942
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                  {/* Left Pane (3 cols): Identity */}
                  <div className="sm:col-span-4 rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                    <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 font-bold">Pane 1: Entity Master</span>
                    <div>
                      <p className="font-bold text-white text-[13px]">Zenith Infra Pvt Ltd</p>
                      <p className="text-[10px] text-slate-400">ROC Mumbai • Incorporated 2021</p>
                    </div>
                    <div className="border-t border-slate-900 pt-2 space-y-1 font-mono text-[10px] text-slate-400">
                      <div className="flex justify-between">
                        <span>PAN:</span>
                        <span className="text-slate-200">AAACZ1234F</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Paid-up:</span>
                        <span className="text-slate-200">₹50,00,000</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Directors:</span>
                        <span className="text-emerald-400">3 Active (DSC Valid)</span>
                      </div>
                    </div>
                  </div>

                  {/* Center Pane (5 cols): Roadmap */}
                  <div className="sm:col-span-5 rounded-xl border border-emerald-900/40 bg-emerald-950/10 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-400 font-bold">Pane 2: Statutory Roadmap</span>
                      <span className="text-[9px] font-mono text-slate-400">Dual Switcher</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="p-2 rounded bg-slate-900/90 border border-slate-800 flex items-center justify-between text-[11px]">
                        <div>
                          <p className="font-bold text-slate-200">MGT-7 Annual Return</p>
                          <p className="text-[9px] font-mono text-slate-500">SRN: R8920194 • ROC</p>
                        </div>
                        <span className="rounded bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 text-[9px] font-bold">Filed</span>
                      </div>
                      <div className="p-2 rounded bg-slate-900/90 border border-slate-800 flex items-center justify-between text-[11px]">
                        <div>
                          <p className="font-bold text-slate-200">AOC-4 XBRL Balance Sheet</p>
                          <p className="text-[9px] font-mono text-amber-400">Due in 5 days</p>
                        </div>
                        <span className="rounded bg-amber-500/20 text-amber-300 px-1.5 py-0.5 text-[9px] font-bold">In QC</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Pane (3 cols): Context & Hearing */}
                  <div className="sm:col-span-3 rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                    <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 font-bold">Pane 3: Vault & NDOH</span>
                    <div className="rounded-lg bg-rose-950/30 border border-rose-800/40 p-2">
                      <div className="text-[9px] font-mono uppercase font-bold text-rose-300">Next Hearing (NDOH)</div>
                      <div className="font-mono font-black text-rose-400 text-sm mt-0.5">28-Sep-2026</div>
                      <div className="text-[9px] text-slate-400">NCLT Mumbai Bench IV</div>
                    </div>
                    <div className="text-[10px] text-slate-400 pt-1">
                      📁 <span className="text-slate-300 font-semibold">18 Dossiers</span> in Google Drive
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Zero-Custody Storage */}
            {activeTab === 'storage' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div>
                    <h4 className="text-sm font-bold text-white">Bring Your Own Storage (BYOS)</h4>
                    <p className="text-[11px] text-slate-400">Zero custody of sensitive client documents</p>
                  </div>
                  <span className="rounded bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-300">
                    AES-256 Cloud Sync
                  </span>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-900 font-black text-sm">
                        GD
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Google Drive Enterprise Perimeter</p>
                        <p className="text-[10px] text-slate-400 font-mono">service-account@mehta-associates.iam.gserviceaccount.com</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 text-[10px] font-mono text-emerald-400 font-bold">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      ACTIVE VAULT
                    </span>
                  </div>

                  <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-3 font-mono text-[11px] text-slate-300 space-y-1">
                    <div className="text-slate-500"># Deterministic storage hierarchy:</div>
                    <div className="text-amber-400">Google Drive &gt; Docketra &gt; Mehta_Associates &gt; Clients &gt; Zenith_Infra/</div>
                    <div className="text-slate-400 pl-4">├── 01_ROC_Filings/ (MGT-7, AOC-4, DIR-3 KYC)</div>
                    <div className="text-slate-400 pl-4">├── 02_Tribunal_NCLT/ (Petitions, Cause Lists, Affidavits)</div>
                    <div className="text-slate-400 pl-4">└── 03_Board_Governance/ (Minutes, Resolutions, Statutory Registers)</div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Client documents stream directly between your browser and your firm’s cloud storage. Docketra stores only cryptographic metadata and never retains custody of confidential working papers.
                  </p>
                </div>
              </div>
            )}

            {/* 5. Two-Tier QC Gates */}
            {activeTab === 'qc' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div>
                    <h4 className="text-sm font-bold text-white">Maker-Checker Quality Control Gate</h4>
                    <p className="text-[11px] text-slate-400">Enforce review gates before filing with statutory authorities</p>
                  </div>
                  <span className="rounded bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-rose-300">
                    Pre-Filing Check
                  </span>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white">Matter: Form AOC-4 XBRL (Financial Statements FY 24-25)</p>
                      <p className="text-[10px] font-mono text-slate-400">Client: Neo Retail Pvt Ltd • Prepared by: Sneha K.</p>
                    </div>
                    <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold">
                      Review Pending
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2 rounded bg-slate-900/90 border border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span className="text-slate-300">Auditor Report & Balance Sheet XML attached</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400">Verified</span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded bg-slate-900/90 border border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span className="text-slate-300">Director DSC Signature & PIN verified</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400">Valid till 2027</span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded bg-slate-900/90 border border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span className="text-slate-300">ROC Normal Fee + Additional Fee calculation</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400">₹600 Normal</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono text-[11px]">Checker: Arjun Mehta (Partner)</span>
                    <button
                      type="button"
                      className="rounded-lg bg-emerald-500 px-3 py-1.5 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-colors"
                    >
                      Approve & Authorize MCA Upload →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Surface Context Banner */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300">
                {CANVAS_TABS.find((t) => t.id === activeTab)?.description}
              </span>
              <span className="font-mono text-[10px] text-amber-400/90">Click tabs above to preview other surfaces</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InteractiveProductCanvas;
