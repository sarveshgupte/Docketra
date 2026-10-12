import React, { useState } from 'react';

const CANVAS_TABS = [
  {
    id: 'radar',
    label: 'Deadlines',
    badge: '3 Overdue',
    description: 'Upcoming MCA, Tax, and NCLT statutory cutoffs with late fee tracking.',
  },
  {
    id: 'workbaskets',
    label: 'Worklist',
    badge: '8 Active',
    description: 'Direct task allocation by associate, matter, and statutory form.',
  },
  {
    id: 'clients',
    label: 'Client Memory',
    badge: '42 Entities',
    description: 'Centralized CIN, PAN, director records, and historical filings.',
  },
  {
    id: 'storage',
    label: 'Google Drive',
    badge: 'Sovereign',
    description: 'Direct client folder hierarchy saved in your firm’s private storage.',
  },
  {
    id: 'qc',
    label: 'QC Workbaskets',
    badge: '2 Pending',
    description: 'Partner review and DSC sign-off before government portal submission.',
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
      {/* Outer Frame with Sharp Architectural Borders */}
      <div className="relative rounded-xs border border-slate-800 bg-[#070A11] p-1 shadow-lg">
        <div className="rounded-xs border border-slate-800/90 bg-[#090D16] text-slate-100 overflow-hidden flex flex-col">
          {/* Workspace Status Bar */}
          <div className="flex items-center justify-between border-b border-slate-800/90 bg-[#06090F] px-3.5 py-2 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="h-1.5 w-1.5 bg-amber-500 shrink-0" />
              <span className="font-mono text-[11px] font-semibold text-slate-300 truncate">
                docketra / mehta-associates
              </span>
              <span className="hidden sm:inline border border-slate-800 px-1.5 py-0.2 font-mono text-[10px] text-slate-400">
                PROD
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-[10px] shrink-0">
              <span className="border border-slate-800 bg-slate-900/80 px-2 py-0.5 text-slate-300">
                FY 2025-26
              </span>
              <span className="flex items-center gap-1.5 border border-emerald-900/60 bg-emerald-950/40 px-2 py-0.5 text-emerald-400 font-semibold">
                <span className="h-1.5 w-1.5 bg-emerald-400 shrink-0" />
                <span>Drive Mounted</span>
              </span>
            </div>
          </div>

          {/* Interactive Navigation Tabs */}
          <div className="flex border-b border-slate-800 bg-[#080C14] px-3 gap-1 overflow-x-auto no-scrollbar">
            {CANVAS_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
                    isActive
                      ? 'border-amber-400 text-white font-semibold bg-slate-900/40'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] font-mono px-1 py-0.2 border ${
                    isActive
                      ? 'border-amber-400/30 text-amber-300 bg-amber-400/10'
                      : 'border-slate-800 text-slate-500'
                  }`}>
                    {tab.badge}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Canvas */}
          <div className="p-3.5 sm:p-4 bg-[#090D16] space-y-3">
            {/* 1. Deadlines & Statutory Radar */}
            {activeTab === 'radar' && (
              <div className="space-y-2.5">
                {/* Metric Summary Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="border border-slate-800 bg-slate-900/60 p-2.5">
                    <span className="font-mono text-[9px] font-semibold text-rose-400 uppercase tracking-wider">Overdue</span>
                    <div className="font-mono text-lg font-bold text-slate-100 mt-0.5">3 Filings</div>
                  </div>
                  <div className="border border-slate-800 bg-slate-900/60 p-2.5">
                    <span className="font-mono text-[9px] font-semibold text-amber-400 uppercase tracking-wider">Next 7 Days</span>
                    <div className="font-mono text-lg font-bold text-slate-100 mt-0.5">8 Filings</div>
                  </div>
                  <div className="border border-slate-800 bg-slate-900/60 p-2.5">
                    <span className="font-mono text-[9px] font-semibold text-sky-400 uppercase tracking-wider">Court / NCLT</span>
                    <div className="font-mono text-lg font-bold text-slate-100 mt-0.5">2 Hearings</div>
                  </div>
                  <div className="border border-slate-800 bg-slate-900/60 p-2.5">
                    <span className="font-mono text-[9px] font-semibold text-purple-400 uppercase tracking-wider">Partner Sign</span>
                    <div className="font-mono text-lg font-bold text-slate-100 mt-0.5">4 Pending</div>
                  </div>
                </div>

                {/* Statutory Filings Table */}
                <div className="border border-slate-800 bg-slate-950 overflow-hidden text-xs">
                  <div className="grid grid-cols-12 bg-slate-900/90 px-3 py-1.5 font-mono text-[10px] text-slate-400 font-bold uppercase border-b border-slate-800">
                    <div className="col-span-5">Entity & Identifier</div>
                    <div className="col-span-4">Statutory Form</div>
                    <div className="col-span-3 text-right">Cutoff</div>
                  </div>
                  <div className="divide-y divide-slate-800/80">
                    <div className="grid grid-cols-12 items-center px-3 py-2">
                      <div className="col-span-5 pr-2">
                        <p className="font-semibold text-slate-200 truncate">Zenith Infra Pvt Ltd</p>
                        <div className="flex items-center gap-1 font-mono text-[9px] text-slate-400">
                          <span>U72200MH2021PTC368942</span>
                          <button
                            type="button"
                            onClick={() => handleCopy('U72200MH2021PTC368942')}
                            className="text-amber-400 hover:text-amber-300 font-mono"
                          >
                            [{copiedText === 'U72200MH2021PTC368942' ? 'COPIED' : 'COPY'}]
                          </button>
                        </div>
                      </div>
                      <div className="col-span-4 text-slate-300 text-[11px] truncate">DIR-3 KYC (Director KYC)</div>
                      <div className="col-span-3 text-right">
                        <span className="border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-rose-300">
                          Due Today
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-12 items-center px-3 py-2">
                      <div className="col-span-5 pr-2">
                        <p className="font-semibold text-slate-200 truncate">Neo Retail Pvt Ltd</p>
                        <p className="font-mono text-[9px] text-slate-400">U52100DL2019PTC345112</p>
                      </div>
                      <div className="col-span-4 text-slate-300 text-[11px] truncate">AOC-4 Balance Sheet</div>
                      <div className="col-span-3 text-right">
                        <span className="border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-amber-300">
                          In 3 Days
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Staff Worklist */}
            {activeTab === 'workbaskets' && (
              <div className="space-y-2.5">
                <div className="border border-slate-800 bg-slate-950 p-3 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-semibold text-white">Daily Execution Queue</span>
                    <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Assigned to Associates</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="p-2 border border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-200">Prepare Form MGT-7 (Annual Return)</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">Assigned: Sneha (Sr Associate) | Zenith Infra</p>
                      </div>
                      <span className="border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-amber-300">
                        In Progress
                      </span>
                    </div>
                    <div className="p-2 border border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-200">ROC Name Reservation (RUN Form)</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">Assigned: Rahul | Apex Advisors</p>
                      </div>
                      <span className="border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-sky-300">
                        Ready to File
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Client Memory */}
            {activeTab === 'clients' && (
              <div className="space-y-2.5">
                <div className="border border-slate-800 bg-slate-950 p-3 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div>
                      <p className="font-bold text-white text-sm">Zenith Infra Private Limited</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">CIN: U72200MH2021PTC368942 | ROC Mumbai</p>
                    </div>
                    <span className="border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-emerald-300">
                      Active Client
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] pt-1">
                    <div className="p-2 border border-slate-800/80 bg-slate-900/60">
                      <span className="text-slate-500 font-mono uppercase text-[9px]">PAN Record</span>
                      <p className="font-mono text-slate-200 font-bold mt-0.5">AAACZ1234F</p>
                    </div>
                    <div className="p-2 border border-slate-800/80 bg-slate-900/60">
                      <span className="text-slate-500 font-mono uppercase text-[9px]">Directors</span>
                      <p className="font-mono text-emerald-400 font-bold mt-0.5">3 Active (DSC OK)</p>
                    </div>
                    <div className="p-2 border border-slate-800/80 bg-slate-900/60">
                      <span className="text-slate-500 font-mono uppercase text-[9px]">Next Hearing</span>
                      <p className="font-mono text-rose-400 font-bold mt-0.5">28-Sep (NCLT)</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Google Drive Sovereign Storage */}
            {activeTab === 'storage' && (
              <div className="space-y-2.5">
                <div className="border border-slate-800 bg-slate-950 p-3 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">Sovereign Google Drive Integration</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Documents stay inside your firm’s private Google Workspace</p>
                    </div>
                    <span className="border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-emerald-300">
                      Connected
                    </span>
                  </div>
                  <div className="p-2.5 border border-slate-800/80 bg-slate-900/60 font-mono text-[10px] text-slate-300 space-y-1">
                    <p className="text-slate-500">Automated Folder Hierarchy:</p>
                    <p className="text-amber-400">/Google Drive/Mehta & Associates/Clients/Zenith Infra/2026 Filings/</p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                    <span className="text-amber-400">🛡️</span>
                    <span>Tamper Guard: Persistent IDs auto-detect moved/trashed folders &amp; re-link instantly.</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Confidential client documents never enter third-party proprietary storage. Zero vendor lock-in.
                  </p>
                </div>
              </div>
            )}

            {/* 5. QC Workbaskets */}
            {activeTab === 'qc' && (
              <div className="space-y-2.5">
                <div className="border border-slate-800 bg-slate-950 p-3 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">Partner Sign-off: Form AOC-4</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Prepared by Associate | Pending Partner Approval</p>
                    </div>
                    <span className="border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-amber-300">
                      Pending Review
                    </span>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between p-2 border border-slate-800/80 bg-slate-900/60 text-slate-300">
                      <span>Balance sheet and audit notes attached</span>
                      <span className="text-emerald-400 font-mono text-[10px]">VERIFIED</span>
                    </div>
                    <div className="flex justify-between p-2 border border-slate-800/80 bg-slate-900/60 text-slate-300">
                      <span>Director DSC signature validated</span>
                      <span className="text-emerald-400 font-mono text-[10px]">VERIFIED</span>
                    </div>
                  </div>
                  <div className="pt-1 flex justify-end">
                    <span className="border border-emerald-600 bg-emerald-500 px-3 py-1 text-slate-950 font-bold text-xs tracking-tight">
                      Approve & Sign →
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Status Bar */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span className="text-slate-300">
                {CANVAS_TABS.find((t) => t.id === activeTab)?.description}
              </span>
              <span className="font-mono text-[10px] text-slate-500 hidden sm:inline">2026 ARCHITECTURE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InteractiveProductCanvas;
