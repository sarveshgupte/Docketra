import React, { useState } from 'react';

const CANVAS_TABS = [
  {
    id: 'radar',
    label: 'Due Dates',
    badge: '3 Overdue',
    badgeStyle: 'bg-rose-50 text-rose-800 border-rose-200 font-bold',
    description: 'Upcoming MCA, Tax, and NCLT due dates with late fee alerts.',
  },
  {
    id: 'workbaskets',
    label: 'Staff Worklist',
    badge: '8 Tasks',
    badgeStyle: 'bg-slate-100 text-slate-700 border-slate-200',
    description: 'Daily tasks assigned to team members and article clerks.',
  },
  {
    id: 'clients',
    label: 'Client Details',
    badge: '42 Clients',
    badgeStyle: 'bg-slate-100 text-slate-700 border-slate-200',
    description: 'All company details, CIN, PAN, and director records in one place.',
  },
  {
    id: 'storage',
    label: 'Google Drive',
    badge: 'Connected',
    badgeStyle: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-medium',
    description: 'Files save directly into your firm’s own Google Drive folders.',
  },
  {
    id: 'qc',
    label: 'Partner Review',
    badge: '2 Pending',
    badgeStyle: 'bg-amber-50 text-amber-800 border-amber-200 font-bold',
    description: 'Partner checks forms and challans before final filing on government portal.',
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
      {/* Outer Shell: Styled like an actual browser / desktop window of Docketra */}
      <div className="relative rounded-lg border border-slate-200/90 bg-white shadow-xl overflow-hidden font-sans text-slate-900">
        {/* Workspace Window Titlebar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-3.5 py-2.5 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Window Dots */}
            <div className="flex items-center gap-1.5 mr-1" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            </div>
            <span className="font-mono text-[11px] font-bold text-slate-900 truncate">
              docketra / mehta-and-associates
            </span>
            <span className="hidden sm:inline border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] text-emerald-800 font-semibold rounded-xs">
              ACTIVE
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px] shrink-0">
            <span className="border border-slate-200 bg-white px-2 py-0.5 text-slate-700 font-semibold rounded-xs shadow-2xs">
              FY 2025-26
            </span>
            <span className="flex items-center gap-1.5 border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-800 font-semibold rounded-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0" />
              <span>Drive Connected</span>
            </span>
          </div>
        </div>

        {/* Interactive Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-3 gap-1 overflow-x-auto no-scrollbar">
          {CANVAS_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
                  isActive
                    ? 'border-slate-950 text-slate-950 bg-slate-50/70'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/40'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-xs border ${
                    isActive
                      ? 'border-slate-300 bg-white text-slate-900 font-bold shadow-2xs'
                      : tab.badgeStyle
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Canvas */}
        <div className="p-3.5 sm:p-4 bg-slate-50/60 space-y-3">
          {/* 1. Due Dates */}
          {activeTab === 'radar' && (
            <div className="space-y-2.5">
              {/* Metric Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="border border-rose-200/90 bg-white p-2.5 rounded-md shadow-2xs">
                  <span className="font-mono text-[9px] font-bold text-rose-700 uppercase tracking-wider">Overdue</span>
                  <div className="font-mono text-lg font-bold text-slate-950 mt-0.5">3 Filings</div>
                </div>
                <div className="border border-amber-200/90 bg-white p-2.5 rounded-md shadow-2xs">
                  <span className="font-mono text-[9px] font-bold text-amber-800 uppercase tracking-wider">Next 7 Days</span>
                  <div className="font-mono text-lg font-bold text-slate-950 mt-0.5">8 Filings</div>
                </div>
                <div className="border border-sky-200/90 bg-white p-2.5 rounded-md shadow-2xs">
                  <span className="font-mono text-[9px] font-bold text-sky-800 uppercase tracking-wider">Court / NCLT</span>
                  <div className="font-mono text-lg font-bold text-slate-950 mt-0.5">2 Hearings</div>
                </div>
                <div className="border border-purple-200/90 bg-white p-2.5 rounded-md shadow-2xs">
                  <span className="font-mono text-[9px] font-bold text-purple-800 uppercase tracking-wider">Partner Sign</span>
                  <div className="font-mono text-lg font-bold text-slate-950 mt-0.5">4 Pending</div>
                </div>
              </div>

              {/* Due Dates Table */}
              <div className="border border-slate-200 bg-white rounded-md overflow-hidden text-xs shadow-2xs">
                <div className="grid grid-cols-12 bg-slate-50 px-3 py-1.5 font-mono text-[10px] text-slate-600 font-bold uppercase border-b border-slate-200">
                  <div className="col-span-5">Client & CIN</div>
                  <div className="col-span-4">Filing / Form</div>
                  <div className="col-span-3 text-right">Due Date</div>
                </div>
                <div className="divide-y divide-slate-100">
                  <div className="grid grid-cols-12 items-center px-3 py-2 hover:bg-slate-50/70 transition-colors">
                    <div className="col-span-5 pr-2">
                      <p className="font-semibold text-slate-900 truncate">Zenith Infra Pvt Ltd</p>
                      <div className="flex items-center gap-1 font-mono text-[9px] text-slate-500">
                        <span>U72200MH2021PTC368942</span>
                        <button
                          type="button"
                          onClick={() => handleCopy('U72200MH2021PTC368942')}
                          className="text-amber-700 hover:text-amber-900 font-mono font-bold cursor-pointer"
                        >
                          [{copiedText === 'U72200MH2021PTC368942' ? 'COPIED' : 'COPY'}]
                        </button>
                      </div>
                    </div>
                    <div className="col-span-4 text-slate-700 text-[11px] truncate">DIR-3 KYC (Director KYC)</div>
                    <div className="col-span-3 text-right">
                      <span className="border border-rose-200 bg-rose-50 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-rose-800 rounded-xs">
                        Due Today
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-12 items-center px-3 py-2 hover:bg-slate-50/70 transition-colors">
                    <div className="col-span-5 pr-2">
                      <p className="font-semibold text-slate-900 truncate">Neo Retail Pvt Ltd</p>
                      <p className="font-mono text-[9px] text-slate-500">U52100DL2019PTC345112</p>
                    </div>
                    <div className="col-span-4 text-slate-700 text-[11px] truncate">AOC-4 Balance Sheet</div>
                    <div className="col-span-3 text-right">
                      <span className="border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-amber-800 rounded-xs">
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
              <div className="border border-slate-200 bg-white rounded-md p-3 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-950">Daily Assigned Tasks</span>
                  <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider font-semibold">Assigned to Staff</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="p-2 border border-slate-200 bg-slate-50/50 rounded-sm flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">Prepare Form MGT-7 (Annual Return)</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">Assigned: Sneha (Sr Associate) | Zenith Infra</p>
                    </div>
                    <span className="border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-amber-800 rounded-xs">
                      In Progress
                    </span>
                  </div>
                  <div className="p-2 border border-slate-200 bg-slate-50/50 rounded-sm flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">ROC Name Approval (RUN Form)</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">Assigned: Rahul (Trainee) | Apex Advisors</p>
                    </div>
                    <span className="border border-sky-200 bg-sky-50 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-sky-800 rounded-xs">
                      Ready to File
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Client Details */}
          {activeTab === 'clients' && (
            <div className="space-y-2.5">
              <div className="border border-slate-200 bg-white rounded-md p-3 space-y-2.5 text-xs shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <p className="font-bold text-slate-950 text-sm">Zenith Infra Private Limited</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">CIN: U72200MH2021PTC368942 | ROC Mumbai</p>
                  </div>
                  <span className="border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-emerald-800 rounded-xs">
                    Active Client
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] pt-1">
                  <div className="p-2 border border-slate-200 bg-slate-50/60 rounded-sm">
                    <span className="text-slate-500 font-mono uppercase text-[9px]">PAN Number</span>
                    <p className="font-mono text-slate-900 font-bold mt-0.5">AAACZ1234F</p>
                  </div>
                  <div className="p-2 border border-slate-200 bg-slate-50/60 rounded-sm">
                    <span className="text-slate-500 font-mono uppercase text-[9px]">Directors</span>
                    <p className="font-mono text-emerald-800 font-bold mt-0.5">3 Active (DSC OK)</p>
                  </div>
                  <div className="p-2 border border-slate-200 bg-slate-50/60 rounded-sm">
                    <span className="text-slate-500 font-mono uppercase text-[9px]">Next Hearing</span>
                    <p className="font-mono text-rose-700 font-bold mt-0.5">28-Sep (NCLT)</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. Google Drive */}
          {activeTab === 'storage' && (
            <div className="space-y-2.5">
              <div className="border border-slate-200 bg-white rounded-md p-3 space-y-2.5 text-xs shadow-2xs">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-950">Your Firm&apos;s Google Drive</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">All client papers save directly into your own Drive folders</p>
                  </div>
                  <span className="border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-emerald-800 rounded-xs">
                    Connected
                  </span>
                </div>
                <div className="p-2.5 border border-slate-200 bg-slate-50 rounded-sm font-mono text-[10px] text-slate-800 space-y-1">
                  <p className="text-slate-500">Auto-Created Folder Path:</p>
                  <p className="text-amber-800 font-bold break-all">/Google Drive/Mehta & Associates/Clients/Zenith Infra/2026 Filings/</p>
                </div>
                <p className="text-[10px] text-slate-600 leading-normal">
                  Confidential client files never leave your Drive. Even if you leave Docketra, your files stay with you.
                </p>
              </div>
            </div>
          )}

          {/* 5. Partner Review */}
          {activeTab === 'qc' && (
            <div className="space-y-2.5">
              <div className="border border-slate-200 bg-white rounded-md p-3 space-y-2.5 text-xs shadow-2xs">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-950">Partner Check: Form AOC-4</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Prepared by associate | Ready for partner review</p>
                  </div>
                  <span className="border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-amber-800 rounded-xs">
                    Pending Review
                  </span>
                </div>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between p-2 border border-slate-200 bg-slate-50/50 rounded-sm text-slate-800">
                    <span>Balance sheet and audit notes attached</span>
                    <span className="text-emerald-700 font-mono text-[10px] font-bold">CHECKED</span>
                  </div>
                  <div className="flex justify-between p-2 border border-slate-200 bg-slate-50/50 rounded-sm text-slate-800">
                    <span>Director DSC signature verified</span>
                    <span className="text-emerald-700 font-mono text-[10px] font-bold">CHECKED</span>
                  </div>
                </div>
                <div className="pt-1 flex justify-end">
                  <span className="border border-slate-950 bg-slate-950 text-white px-3 py-1 rounded-sm font-bold text-xs tracking-tight shadow-xs">
                    Approve & Mark Filed →
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Status Bar */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <span className="text-slate-600 font-medium">
              {CANVAS_TABS.find((t) => t.id === activeTab)?.description}
            </span>
            <span className="font-mono text-[10px] text-slate-400 hidden sm:inline font-semibold">2026 WORKSPACE</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InteractiveProductCanvas;
