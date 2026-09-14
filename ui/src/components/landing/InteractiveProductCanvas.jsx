import React, { useState } from 'react';

const CANVAS_TABS = [
  {
    id: 'radar',
    label: 'Due Dates',
    shortLabel: 'Deadlines',
    badge: 'Today & Next 7 Days',
    description: 'See all upcoming MCA, Tax, and Court deadlines in one clean morning list.',
  },
  {
    id: 'workbaskets',
    label: 'Staff Worklist',
    shortLabel: 'Worklist',
    badge: 'Daily Tasks',
    description: 'Assign client tasks to your team so nothing gets forgotten or delayed.',
  },
  {
    id: 'clients',
    label: 'Client Dossier',
    shortLabel: 'Clients',
    badge: 'All Client Info',
    description: 'Keep company details, CIN, PAN, directors, and past filings together.',
  },
  {
    id: 'storage',
    label: 'Google Drive',
    shortLabel: 'Files',
    badge: 'Your Own Storage',
    description: 'All client files save directly into your firm’s Google Drive. You stay in 100% control.',
  },
  {
    id: 'qc',
    label: 'Review & Sign-off',
    shortLabel: 'Approvals',
    badge: 'Partner Check',
    description: 'Check documents and challans before your team files them with the government.',
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
      {/* Outer Card */}
      <div className="relative rounded-2xl border border-slate-800 bg-[#070A11] p-1.5 shadow-xl">
        <div className="rounded-xl border border-slate-800/90 bg-[#090D16] text-slate-100 overflow-hidden flex flex-col">
          {/* Window Top Bar */}
          <div className="flex items-center justify-between border-b border-slate-800/80 bg-[#06090F] px-3.5 py-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500/80 inline-block" />
                <span className="h-2 w-2 rounded-full bg-amber-500/80 inline-block" />
                <span className="h-2 w-2 rounded-full bg-emerald-500/80 inline-block" />
              </div>
              <span className="text-[11px] font-mono text-slate-400 pl-1 font-semibold hidden sm:inline">
                mehta-and-associates.docketra.in
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-[10px]">
              <span className="rounded bg-slate-800 px-2 py-0.5 font-bold text-amber-400">
                FY 25-26
              </span>
              <span className="flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-950/50 px-2 py-0.5 rounded">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Google Drive Connected
              </span>
            </div>
          </div>

          {/* Interactive Tab Pills */}
          <div className="flex border-b border-slate-800/80 bg-[#080C14] px-2.5 py-1.5 overflow-x-auto gap-1 no-scrollbar">
            {CANVAS_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Surface Content */}
          <div className="p-3.5 sm:p-4 bg-gradient-to-b from-[#090D16] to-[#070A12] space-y-3">
            {/* 1. Due Dates */}
            {activeTab === 'radar' && (
              <div className="space-y-2.5">
                {/* 4 Compact Stat Boxes */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-2 text-left">
                    <span className="text-[10px] font-bold text-rose-300 uppercase">Overdue</span>
                    <div className="font-mono text-xl font-black text-rose-400 mt-0.5">3 Filings</div>
                  </div>
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-left">
                    <span className="text-[10px] font-bold text-amber-300 uppercase">Due in 7 Days</span>
                    <div className="font-mono text-xl font-black text-amber-400 mt-0.5">8 Filings</div>
                  </div>
                  <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-2 text-left">
                    <span className="text-[10px] font-bold text-sky-300 uppercase">Court / Tribunal</span>
                    <div className="font-mono text-xl font-black text-sky-400 mt-0.5">2 Hearings</div>
                  </div>
                  <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-2 text-left">
                    <span className="text-[10px] font-bold text-purple-300 uppercase">Need DSC Sign</span>
                    <div className="font-mono text-xl font-black text-purple-400 mt-0.5">4 Clients</div>
                  </div>
                </div>

                {/* Deadlines Table */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden text-xs">
                  <div className="grid grid-cols-12 bg-slate-900 px-3 py-1.5 font-mono text-[10px] text-slate-400 font-bold uppercase">
                    <div className="col-span-5">Client Name & CIN</div>
                    <div className="col-span-4">Filing / Form</div>
                    <div className="col-span-3 text-right">Due Date</div>
                  </div>
                  <div className="divide-y divide-slate-800/80">
                    <div className="grid grid-cols-12 items-center px-3 py-2">
                      <div className="col-span-5 pr-2">
                        <p className="font-bold text-slate-200 truncate">Zenith Infra Pvt Ltd</p>
                        <div className="flex items-center gap-1 font-mono text-[9px] text-slate-400">
                          <span>U72200MH2021PTC368942</span>
                          <button
                            type="button"
                            onClick={() => handleCopy('U72200MH2021PTC368942')}
                            className="text-amber-400 hover:underline"
                          >
                            {copiedText === 'U72200MH2021PTC368942' ? '✓' : 'copy'}
                          </button>
                        </div>
                      </div>
                      <div className="col-span-4 text-slate-300 text-[11px] truncate">DIR-3 KYC (Director KYC)</div>
                      <div className="col-span-3 text-right">
                        <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">
                          Due Today
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-12 items-center px-3 py-2">
                      <div className="col-span-5 pr-2">
                        <p className="font-bold text-slate-200 truncate">Neo Retail Pvt Ltd</p>
                        <p className="font-mono text-[9px] text-slate-400">U52100DL2019PTC345112</p>
                      </div>
                      <div className="col-span-4 text-slate-300 text-[11px] truncate">AOC-4 Balance Sheet</div>
                      <div className="col-span-3 text-right">
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
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
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Daily Assigned Tasks</span>
                    <span className="text-[10px] text-amber-400 font-mono">Today's Queue</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-200">Prepare Form MGT-7 (Annual Return)</p>
                        <p className="text-[10px] text-slate-400">Assigned to: Sneha (Senior Associate) • Zenith Infra</p>
                      </div>
                      <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                        In Progress
                      </span>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-200">ROC Name Approval (RUN Form)</p>
                        <p className="text-[10px] text-slate-400">Assigned to: Rahul • Apex Advisors</p>
                      </div>
                      <span className="text-[9px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded">
                        Ready to File
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Client Dossier */}
            {activeTab === 'clients' && (
              <div className="space-y-2.5">
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div>
                      <p className="font-bold text-white text-sm">Zenith Infra Private Limited</p>
                      <p className="text-[10px] text-slate-400 font-mono">CIN: U72200MH2021PTC368942 • ROC Mumbai</p>
                    </div>
                    <span className="rounded bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-[9px] font-bold">
                      Active Client
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px] pt-1">
                    <div className="p-2 rounded bg-slate-900">
                      <span className="text-slate-500">PAN</span>
                      <p className="font-mono text-slate-200 font-bold mt-0.5">AAACZ1234F</p>
                    </div>
                    <div className="p-2 rounded bg-slate-900">
                      <span className="text-slate-500">Directors</span>
                      <p className="font-mono text-emerald-400 font-bold mt-0.5">3 Active (DSC OK)</p>
                    </div>
                    <div className="p-2 rounded bg-slate-900">
                      <span className="text-slate-500">Next Hearing</span>
                      <p className="font-mono text-rose-400 font-bold mt-0.5">28-Sep (NCLT)</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Google Drive */}
            {activeTab === 'storage' && (
              <div className="space-y-2.5">
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded bg-white text-slate-950 font-black flex items-center justify-center text-xs">
                        G
                      </span>
                      <div>
                        <p className="font-bold text-white">Your Firm's Google Drive</p>
                        <p className="text-[10px] text-slate-400">All client papers save into your own folders</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-[9px] font-bold">
                      ✓ Connected
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 font-mono text-[10px] text-slate-300">
                    <p className="text-slate-500">Auto-created folder structure:</p>
                    <p className="text-amber-400 mt-1">Google Drive &gt; Mehta & Associates &gt; Zenith Infra &gt; 2026 Filings/</p>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug">
                    You never lose custody of confidential client documents. Even if you leave Docketra, your files remain in your Google Drive.
                  </p>
                </div>
              </div>
            )}

            {/* 5. Review & Sign-off */}
            {activeTab === 'qc' && (
              <div className="space-y-2.5">
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">Partner Check: Form AOC-4 (Financials)</p>
                      <p className="text-[10px] text-slate-400">Prepared by staff associate • Ready for your approval</p>
                    </div>
                    <span className="rounded bg-amber-500/20 text-amber-300 px-2 py-0.5 text-[9px] font-bold">
                      Pending Approval
                    </span>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between p-1.5 rounded bg-slate-900 text-slate-300">
                      <span>✓ Balance sheet & notes attached</span>
                      <span className="text-emerald-400 font-mono text-[10px]">Verified</span>
                    </div>
                    <div className="flex justify-between p-1.5 rounded bg-slate-900 text-slate-300">
                      <span>✓ Director DSC signed</span>
                      <span className="text-emerald-400 font-mono text-[10px]">Verified</span>
                    </div>
                  </div>
                  <div className="pt-1 flex justify-end">
                    <span className="rounded bg-emerald-500 px-3 py-1 text-slate-950 font-bold text-xs">
                      Approve & Send to MCA →
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Note */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span className="text-slate-300 font-medium">
                {CANVAS_TABS.find((t) => t.id === activeTab)?.description}
              </span>
              <span className="font-mono text-[10px] text-amber-400 hidden sm:inline">Click tabs above to see each feature</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InteractiveProductCanvas;
