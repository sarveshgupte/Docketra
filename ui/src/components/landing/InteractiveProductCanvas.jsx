import React, { useState } from 'react';

const CANVAS_TABS = [
  {
    id: 'radar',
    label: 'Statutory Radar',
    badge: '3 Overdue',
    badgeStyle: 'bg-rose-50 text-rose-800 border-rose-200 font-bold',
    description: 'Real-time MCA V3, Tax Audit, and NCLT court hearings with automatic late fee radars.',
  },
  {
    id: 'shield',
    label: 'Trainee Shield',
    badge: 'Download Blocked',
    badgeStyle: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold',
    description: 'Trainees view working papers in watermarked browser sandbox; raw local disk downloads are blocked.',
  },
  {
    id: 'qc',
    label: 'SQC-1 Sign-off',
    badge: 'Partner Action',
    badgeStyle: 'bg-amber-50 text-amber-800 border-amber-200 font-bold',
    description: 'Mandatory 4-eye maker-checker approval before final filing on MCA or Income Tax portal.',
  },
  {
    id: 'storage',
    label: 'Google Drive Vault',
    badge: 'BYOS Sovereign',
    badgeStyle: 'bg-slate-100 text-slate-800 border-slate-300 font-medium',
    description: 'Restricted drive.file isolation. Docketra touches only its dedicated folder inside your private Drive.',
  },
  {
    id: 'clients',
    label: 'Client Memory',
    badge: '42 Dockets',
    badgeStyle: 'bg-slate-100 text-slate-700 border-slate-200',
    description: 'Master directory of CIN, PAN, DIN, and authorized signatories with 1-click portal copy.',
  },
];

export function InteractiveProductCanvas({ className = '' }) {
  const [activeTab, setActiveTab] = useState('radar');
  const [copiedText, setCopiedText] = useState(null);
  const [shieldTestState, setShieldTestState] = useState('idle'); // 'idle' | 'testing' | 'blocked'
  const [partnerApproved, setPartnerApproved] = useState(false);
  const [driveRecoveryState, setDriveRecoveryState] = useState('intact'); // 'intact' | 'recovering' | 'recovered'

  const handleCopy = (text) => {
    navigator.clipboard?.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1800);
  };

  const runShieldSimulation = () => {
    setShieldTestState('testing');
    setTimeout(() => {
      setShieldTestState('blocked');
    }, 450);
  };

  const runPartnerApproval = () => {
    setPartnerApproved(true);
  };

  const runDriveRecovery = () => {
    setDriveRecoveryState('recovering');
    setTimeout(() => {
      setDriveRecoveryState('recovered');
    }, 600);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Outer Shell: Precision workstation window */}
      <div className="relative rounded-lg border border-slate-300/80 bg-white shadow-2xl overflow-hidden font-sans text-slate-900 transition-all">
        {/* Workspace Window Titlebar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-3.5 py-2.5 text-xs text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Window Traffic Dots */}
            <div className="flex items-center gap-1.5 mr-1" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80 inline-block" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80 inline-block" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80 inline-block" />
            </div>
            <span className="font-mono text-[11px] font-semibold text-slate-200 truncate">
              docketra // mehta-and-associates-ca
            </span>
            <span className="hidden sm:inline border border-emerald-500/40 bg-emerald-950/60 px-1.5 py-0.2 font-mono text-[10px] text-emerald-400 font-semibold rounded-xs">
              SOVEREIGN ENCLAVE
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px] shrink-0">
            <span className="border border-slate-700 bg-slate-800 px-2 py-0.5 text-slate-300 font-semibold rounded-xs">
              FY 2025-26
            </span>
            <span className="flex items-center gap-1.5 border border-emerald-500/30 bg-emerald-950/50 px-2 py-0.5 text-emerald-400 font-semibold rounded-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>Drive Perimeter Active</span>
            </span>
          </div>
        </div>

        {/* Interactive Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100/90 px-2 gap-1 overflow-x-auto no-scrollbar">
          {CANVAS_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
                  isActive
                    ? 'border-slate-950 text-slate-950 bg-white shadow-2xs font-bold'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded-xs border ${
                    isActive
                      ? 'border-slate-300 bg-slate-50 text-slate-900 font-bold'
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
        <div className="p-3.5 sm:p-4 bg-slate-50/70 space-y-3 min-h-[300px]">
          {/* 1. Statutory Due Dates Radar */}
          {activeTab === 'radar' && (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="border border-rose-300 bg-rose-50/60 p-2.5 rounded-md">
                  <span className="font-mono text-[9px] font-bold text-rose-700 uppercase tracking-wider">Overdue Alert</span>
                  <div className="font-mono text-base sm:text-lg font-bold text-slate-950 mt-0.5">3 Filings</div>
                  <span className="text-[10px] text-rose-600 font-mono">₹100/day penalty</span>
                </div>
                <div className="border border-amber-300 bg-amber-50/60 p-2.5 rounded-md">
                  <span className="font-mono text-[9px] font-bold text-amber-800 uppercase tracking-wider">Next 7 Days</span>
                  <div className="font-mono text-base sm:text-lg font-bold text-slate-950 mt-0.5">8 Filings</div>
                  <span className="text-[10px] text-amber-700 font-mono">Form 3CD + AOC-4</span>
                </div>
                <div className="border border-sky-300 bg-sky-50/60 p-2.5 rounded-md">
                  <span className="font-mono text-[9px] font-bold text-sky-800 uppercase tracking-wider">Court / NCLT</span>
                  <div className="font-mono text-base sm:text-lg font-bold text-slate-950 mt-0.5">2 Hearings</div>
                  <span className="text-[10px] text-sky-700 font-mono">Bench 2 Mumbai</span>
                </div>
                <div className="border border-purple-300 bg-purple-50/60 p-2.5 rounded-md">
                  <span className="font-mono text-[9px] font-bold text-purple-800 uppercase tracking-wider">Partner Sign</span>
                  <div className="font-mono text-base sm:text-lg font-bold text-slate-950 mt-0.5">4 In Queue</div>
                  <span className="text-[10px] text-purple-700 font-mono">SQC-1 4-Eye Review</span>
                </div>
              </div>

              {/* Dockets Ledger Table */}
              <div className="border border-slate-200 bg-white rounded-md overflow-hidden text-xs shadow-2xs">
                <div className="grid grid-cols-12 bg-slate-100 px-3 py-1.5 font-mono text-[10px] text-slate-700 font-bold uppercase border-b border-slate-200">
                  <div className="col-span-5">Client & CIN</div>
                  <div className="col-span-4">Statutory Docket</div>
                  <div className="col-span-3 text-right">Cutoff / Action</div>
                </div>
                <div className="divide-y divide-slate-100">
                  <div className="grid grid-cols-12 items-center px-3 py-2 hover:bg-slate-50 transition-colors">
                    <div className="col-span-5 pr-2">
                      <p className="font-semibold text-slate-950 truncate">Zenith Infra Pvt Ltd</p>
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
                    <div className="col-span-4 text-slate-800 text-[11px] truncate">DIR-3 KYC (Director KYC)</div>
                    <div className="col-span-3 text-right">
                      <span className="border border-rose-300 bg-rose-50 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-rose-800 rounded-xs">
                        Due Today
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-12 items-center px-3 py-2 hover:bg-slate-50 transition-colors">
                    <div className="col-span-5 pr-2">
                      <p className="font-semibold text-slate-950 truncate">Neo Retail Solutions Pvt Ltd</p>
                      <div className="flex items-center gap-1 font-mono text-[9px] text-slate-500">
                        <span>U52100DL2019PTC345112</span>
                        <button
                          type="button"
                          onClick={() => handleCopy('U52100DL2019PTC345112')}
                          className="text-amber-700 hover:text-amber-900 font-mono font-bold cursor-pointer"
                        >
                          [{copiedText === 'U52100DL2019PTC345112' ? 'COPIED' : 'COPY'}]
                        </button>
                      </div>
                    </div>
                    <div className="col-span-4 text-slate-800 text-[11px] truncate">AOC-4 Balance Sheet & Notes</div>
                    <div className="col-span-3 text-right">
                      <span className="border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-amber-800 rounded-xs">
                        In 3 Days
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-12 items-center px-3 py-2 hover:bg-slate-50 transition-colors">
                    <div className="col-span-5 pr-2">
                      <p className="font-semibold text-slate-950 truncate">Apex Bio-Tech India LLP</p>
                      <p className="font-mono text-[9px] text-slate-500">AAX-9981 (ROC Bangalore)</p>
                    </div>
                    <div className="col-span-4 text-slate-800 text-[11px] truncate">Tax Audit Form 3CD</div>
                    <div className="col-span-3 text-right">
                      <span className="border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-emerald-800 rounded-xs">
                        Ready for QC
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Trainee Laptop Shield (Interactive Live Proof) */}
          {activeTab === 'shield' && (
            <div className="space-y-3">
              <div className="border border-slate-200 bg-white rounded-md p-3.5 space-y-3 text-xs shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <h4 className="font-bold text-slate-950 text-sm">Trainee Laptop Perimeter Guard</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Articles & trainees view files inside protected web viewer. Direct downloads to personal drives or disks are blocked.
                    </p>
                  </div>
                  <span className="border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-emerald-800 rounded-xs self-start sm:self-auto">
                    SHIELD ACTIVE
                  </span>
                </div>

                {/* Simulated Trainee Session */}
                <div className="p-3 border border-slate-200 bg-slate-50 rounded-md space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-slate-700 font-semibold">Trainee Session: Rohan V. (Article Clerk)</span>
                    <span className="font-mono text-[10px] text-slate-500">Device: Personal Laptop (BYOD)</span>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded text-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-amber-600 font-mono font-bold">[PDF]</span>
                      <span className="font-medium truncate">Zenith_FY25_Audited_Financials_Confidential.pdf</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 shrink-0">4.8 MB</span>
                  </div>

                  {/* Interactive Trigger Button */}
                  <div className="pt-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={runShieldSimulation}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 text-white font-mono text-[10px] font-bold uppercase tracking-wider rounded-xs hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <span>Simulate Clerk Attempting Download</span>
                      <span>→</span>
                    </button>
                    <span className="text-[10px] text-slate-500 font-mono">Click to test live security policy</span>
                  </div>

                  {/* Live Simulation Feedback */}
                  {shieldTestState === 'testing' && (
                    <div className="p-2 border border-amber-200 bg-amber-50 rounded text-amber-800 font-mono text-[10px] flex items-center gap-2 animate-pulse">
                      <span>Intercepting download stream...</span>
                    </div>
                  )}

                  {shieldTestState === 'blocked' && (
                    <div className="p-2.5 border border-rose-300 bg-rose-50 rounded text-rose-900 font-mono text-[10px] space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-rose-800">
                        <span className="text-rose-600">🛑</span>
                        <span>DOWNLOAD BLOCKED: Trainee Laptop Shield Intercepted File</span>
                      </div>
                      <p className="text-[10px] text-rose-700 leading-normal">
                        Policy ENCLAVE-301: Trainee accounts cannot save client financials to local disks. In-browser watermarked preview active with clerk IP: 103.21.244.12. Zero file leakage.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3. Partner SQC-1 Sign-off */}
          {activeTab === 'qc' && (
            <div className="space-y-3">
              <div className="border border-slate-200 bg-white rounded-md p-3.5 space-y-3 text-xs shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <h4 className="font-bold text-slate-950 text-sm">Partner Review: Form AOC-4 (Financial Statements)</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Prepared by Associate Sneha • Ready for Partner Final Signature</p>
                  </div>
                  <span className={`border px-2 py-0.5 font-mono text-[9px] font-bold uppercase rounded-xs ${
                    partnerApproved
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-amber-300 bg-amber-50 text-amber-800'
                  }`}>
                    {partnerApproved ? 'SEALED & FILED' : 'PENDING PARTNER SIGN'}
                  </span>
                </div>

                {/* Statutory Checklist Items */}
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between items-center p-2 border border-slate-200 bg-slate-50 rounded-sm text-slate-800">
                    <span>Balance sheet and audit notes attached from Drive</span>
                    <span className="text-emerald-700 font-mono text-[10px] font-bold">VERIFIED</span>
                  </div>
                  <div className="flex justify-between items-center p-2 border border-slate-200 bg-slate-50 rounded-sm text-slate-800">
                    <span>Director DSC signature token status confirmed</span>
                    <span className="text-emerald-700 font-mono text-[10px] font-bold">VALID (EXP: 2027)</span>
                  </div>
                  <div className="flex justify-between items-center p-2 border border-slate-200 bg-slate-50 rounded-sm text-slate-800">
                    <span>MCA V3 pre-scrutiny checks completed with 0 errors</span>
                    <span className="text-emerald-700 font-mono text-[10px] font-bold">PASSED</span>
                  </div>
                </div>

                {/* Partner Action Area */}
                <div className="pt-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-t border-slate-100">
                  {!partnerApproved ? (
                    <>
                      <span className="text-[10px] text-slate-500 font-mono">Role: CA Rajesh Mehta (Managing Partner)</span>
                      <button
                        type="button"
                        onClick={runPartnerApproval}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-slate-950 text-amber-400 font-bold text-xs rounded-xs hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
                      >
                        <span>Approve & Engrave SQC-1 Audit Seal</span>
                        <span>→</span>
                      </button>
                    </>
                  ) : (
                    <div className="w-full p-2.5 border border-emerald-300 bg-emerald-50 rounded text-emerald-900 font-mono text-[10px] space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                        <span>✓</span>
                        <span>SQC-1 AUDIT TRAIL LOGGED • PARTNER SIGN-OFF COMPLETED</span>
                      </div>
                      <p className="text-[10px] text-emerald-700">
                        Signed by CA Rajesh Mehta (FCA 042918) at {new Date().toLocaleTimeString()} IST. Hash: #MCA-9821-V3-AOC4-VERIFIED. Peer-review inspection audit record created.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 4. Google Drive BYOS Vault */}
          {activeTab === 'storage' && (
            <div className="space-y-3">
              <div className="border border-slate-200 bg-white rounded-md p-3.5 space-y-3 text-xs shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <h4 className="font-bold text-slate-950 text-sm">Your Firm&apos;s Private Google Drive Enclave</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Strict restricted drive.file scope. Zero outside access.</p>
                  </div>
                  <span className="border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-emerald-800 rounded-xs">
                    BYOS SOVEREIGN
                  </span>
                </div>

                <div className="p-2.5 border border-slate-200 bg-slate-50 rounded-sm font-mono text-[10px] text-slate-800 space-y-1.5">
                  <div className="flex justify-between text-slate-500">
                    <span>Sandboxed Google Drive Path:</span>
                    <span className="text-emerald-700 font-bold">Encrypted & Isolated</span>
                  </div>
                  <p className="text-amber-800 font-bold break-all bg-white p-2 border border-slate-200 rounded">
                    /Google Drive/Mehta & Associates/Clients/Zenith Infra/FY2025-26/ROC/
                  </p>
                </div>

                <div className="p-2.5 border border-slate-200 bg-white rounded text-[11px] text-slate-600 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Drive Tamper Guard:</span>
                    <span className="font-mono text-[10px] text-emerald-700 font-semibold">Watching for Accidental Folder Moves</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    If an associate accidentally drags or deletes a folder in Google Drive, Docketra heals the pointers automatically.
                  </p>

                  <div className="pt-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={runDriveRecovery}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-300 text-slate-800 font-mono text-[10px] font-bold rounded-xs hover:bg-slate-50 cursor-pointer"
                    >
                      <span>{driveRecoveryState === 'recovering' ? 'Scanning Drive...' : 'Simulate Accidental Move & Heal'}</span>
                    </button>
                    {driveRecoveryState === 'recovered' && (
                      <span className="text-emerald-700 font-mono text-[10px] font-bold">
                        ✓ Restored in 0.38s (0 Data Loss)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. Client Memory Vault */}
          {activeTab === 'clients' && (
            <div className="space-y-3">
              <div className="border border-slate-200 bg-white rounded-md p-3.5 space-y-3 text-xs shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <h4 className="font-bold text-slate-950 text-sm">Zenith Infra Private Limited</h4>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">CIN: U72200MH2021PTC368942 • ROC Mumbai • Incorp: 2021</p>
                  </div>
                  <span className="border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-emerald-800 rounded-xs">
                    ACTIVE MATTER
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
                  <div className="p-2 border border-slate-200 bg-slate-50 rounded-sm">
                    <span className="text-slate-500 font-mono uppercase text-[9px]">PAN & TAN</span>
                    <div className="flex items-center justify-between mt-1 font-mono font-bold text-slate-900">
                      <span>AAACZ1234F</span>
                      <button
                        type="button"
                        onClick={() => handleCopy('AAACZ1234F')}
                        className="text-amber-700 hover:text-amber-900 cursor-pointer"
                      >
                        [{copiedText === 'AAACZ1234F' ? 'COPIED' : 'COPY'}]
                      </button>
                    </div>
                  </div>
                  <div className="p-2 border border-slate-200 bg-slate-50 rounded-sm">
                    <span className="text-slate-500 font-mono uppercase text-[9px]">Directors (DIN)</span>
                    <p className="font-mono text-emerald-800 font-bold mt-1">3 Active (DSC Attached)</p>
                  </div>
                  <div className="p-2 border border-slate-200 bg-slate-50 rounded-sm">
                    <span className="text-slate-500 font-mono uppercase text-[9px]">Next Hearing</span>
                    <p className="font-mono text-rose-700 font-bold mt-1">28-Sep (NCLT Bench 2)</p>
                  </div>
                </div>

                <div className="p-2 border border-slate-200 bg-slate-50/50 rounded flex items-center justify-between text-[11px] text-slate-700">
                  <span>Client Upload Link (No login required for client):</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('https://docketra.com/u/mehta-associates/zenith-upload-2026')}
                    className="font-mono text-[10px] text-amber-700 hover:text-amber-900 font-bold cursor-pointer"
                  >
                    [{copiedText === 'https://docketra.com/u/mehta-associates/zenith-upload-2026' ? 'COPIED LINK' : 'COPY LINK'}]
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Status Bar */}
          <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-[11px] text-slate-500">
            <span className="text-slate-700 font-medium truncate">
              {CANVAS_TABS.find((t) => t.id === activeTab)?.description}
            </span>
            <span className="font-mono text-[10px] text-slate-400 shrink-0 font-semibold">
              SOVEREIGN PRACTICE ENGINE • 2026
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InteractiveProductCanvas;
