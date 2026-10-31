import React, { useState } from 'react';

const CANVAS_TABS = [
  {
    id: 'radar',
    label: 'Statutory Radar',
    badge: '3 Due Today',
    badgeStyle: 'bg-rose-50 text-rose-800 border-rose-200',
    description: 'Tracks MCA V3, Tax Audit, and NCLT hearings with automatic penalty warnings before late fees apply.',
  },
  {
    id: 'shield',
    label: 'Trainee Shield',
    badge: 'Active Enclave',
    badgeStyle: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    description: 'Junior staff view files in a watermarked browser viewer. Raw downloads to personal laptops are blocked.',
  },
  {
    id: 'qc',
    label: 'Maker-Checker QC',
    badge: 'SQC-1 Required',
    badgeStyle: 'bg-amber-50 text-amber-800 border-amber-200',
    description: 'Partners review and approve every filing before it reaches government portals.',
  },
  {
    id: 'storage',
    label: 'Drive Vault',
    badge: 'Private BYOS',
    badgeStyle: 'bg-slate-100 text-slate-800 border-slate-300',
    description: 'All working papers stay inside your private Google Drive. Docketra never indexes pre-existing files.',
  },
  {
    id: 'clients',
    label: 'Client Memory',
    badge: 'Master Registry',
    badgeStyle: 'bg-slate-100 text-slate-800 border-slate-300',
    description: 'Central registry for CIN, PAN, DIN, and authorized signatories with one-click copy.',
  },
];

export function InteractiveProductCanvas({ className = '' }) {
  const [activeTab, setActiveTab] = useState('radar');
  const [copiedKey, setCopiedKey] = useState(null);
  const [shieldState, setShieldState] = useState('idle'); // 'idle' | 'testing' | 'blocked'
  const [partnerApproved, setPartnerApproved] = useState(false);
  const [driveRecoveryState, setDriveRecoveryState] = useState('intact'); // 'intact' | 'recovering' | 'recovered'

  const handleCopy = (key, text) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSimulateDownload = () => {
    setShieldState('testing');
    setTimeout(() => {
      setShieldState('blocked');
    }, 400);
  };

  const handlePartnerSignoff = () => {
    setPartnerApproved(true);
  };

  const handleDriveRecovery = () => {
    setDriveRecoveryState('recovering');
    setTimeout(() => {
      setDriveRecoveryState('recovered');
    }, 500);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Outer Shell: Precision workstation surface */}
      <div className="relative rounded-lg border border-slate-300 bg-white shadow-sm overflow-hidden text-slate-900">
        {/* Workspace Toolbar: Clean, authoritative, no fake browser chrome */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-xs text-white">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
            <span className="font-medium text-slate-100 truncate">
              Mehta & Associates, Chartered Accountants
            </span>
            <span className="hidden sm:inline border border-emerald-500/30 bg-emerald-950/60 px-2 py-0.5 text-[11px] text-emerald-300 font-medium rounded-xs">
              Google Drive Connected
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] shrink-0">
            <span className="border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-slate-300 font-medium rounded-xs">
              FY 2025-26
            </span>
            <span className="border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-0.5 text-emerald-300 font-medium rounded-xs">
              Drive Perimeter Active
            </span>
          </div>
        </div>

        {/* Tab Navigation Strip */}
        <div
          role="tablist"
          aria-label="Interactive Product Capabilities"
          className="flex border-b border-slate-200 bg-slate-50/90 px-3 gap-1 overflow-x-auto"
        >
          {CANVAS_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                id={`canvas-tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`canvas-panel-${tab.id}`}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 flex items-center gap-2 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950 active:bg-slate-100 ${
                  isActive
                    ? 'border-slate-950 text-slate-950 bg-white font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-950 hover:bg-slate-100'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-xs border ${
                    isActive ? 'border-slate-300 bg-slate-100 text-slate-900 font-semibold' : tab.badgeStyle
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Panel Viewport */}
        <div
          id={`canvas-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`canvas-tab-${activeTab}`}
          className="p-4 sm:p-5 bg-white min-h-[340px] space-y-4"
        >
          {/* Tab 1: Statutory Radar */}
          {activeTab === 'radar' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="border border-rose-200 bg-rose-50/50 p-3 rounded-md">
                  <span className="text-xs font-medium text-rose-800">Overdue filings</span>
                  <div className="text-xl font-bold text-slate-950 mt-1">3 Dockets</div>
                  <span className="text-xs text-rose-700">₹100/day penalty</span>
                </div>
                <div className="border border-amber-200 bg-amber-50/50 p-3 rounded-md">
                  <span className="text-xs font-medium text-amber-800">Next 7 days</span>
                  <div className="text-xl font-bold text-slate-950 mt-1">8 Dockets</div>
                  <span className="text-xs text-amber-700">Form 3CD & AOC-4</span>
                </div>
                <div className="border border-slate-200 bg-slate-50 p-3 rounded-md">
                  <span className="text-xs font-medium text-slate-700">Court / NCLT</span>
                  <div className="text-xl font-bold text-slate-950 mt-1">2 Hearings</div>
                  <span className="text-xs text-slate-600">Mumbai Bench</span>
                </div>
                <div className="border border-slate-200 bg-slate-50 p-3 rounded-md">
                  <span className="text-xs font-medium text-slate-700">Partner QC queue</span>
                  <div className="text-xl font-bold text-slate-950 mt-1">4 In review</div>
                  <span className="text-xs text-slate-600">SQC-1 4-eye check</span>
                </div>
              </div>

              {/* Dockets Table */}
              <div className="border border-slate-200 rounded-md overflow-hidden text-xs">
                <div className="grid grid-cols-12 bg-slate-100/80 px-3 py-2 font-medium text-slate-700 border-b border-slate-200">
                  <div className="col-span-5">Client & Identifier</div>
                  <div className="col-span-4">Statutory Docket</div>
                  <div className="col-span-3 text-right">Cutoff & Status</div>
                </div>
                <div className="divide-y divide-slate-100">
                  <div className="grid grid-cols-12 items-center px-3 py-2.5 hover:bg-slate-50 transition-colors">
                    <div className="col-span-5 pr-2">
                      <p className="font-semibold text-slate-950 truncate">Zenith Logistics Pvt Ltd</p>
                      <div className="flex items-center gap-2 text-slate-500 text-[11px] mt-0.5">
                        <span className="font-mono">U72200MH2021PTC368942</span>
                        <button
                          type="button"
                          onClick={() => handleCopy('cin1', 'U72200MH2021PTC368942')}
                          className="text-amber-800 hover:text-amber-950 font-medium cursor-pointer underline focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-slate-950 active:opacity-75"
                        >
                          {copiedKey === 'cin1' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    <div className="col-span-4 text-slate-800">
                      <span>DIR-3 KYC (Director KYC)</span>
                    </div>
                    <div className="col-span-3 text-right">
                      <span className="inline-block border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-800 rounded-xs">
                        Due today
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-center px-3 py-2.5 hover:bg-slate-50 transition-colors">
                    <div className="col-span-5 pr-2">
                      <p className="font-semibold text-slate-950 truncate">Neo Retail Solutions Pvt Ltd</p>
                      <div className="flex items-center gap-2 text-slate-500 text-[11px] mt-0.5">
                        <span className="font-mono">U52100DL2019PTC345112</span>
                        <button
                          type="button"
                          onClick={() => handleCopy('cin2', 'U52100DL2019PTC345112')}
                          className="text-amber-800 hover:text-amber-950 font-medium cursor-pointer underline focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-slate-950 active:opacity-75"
                        >
                          {copiedKey === 'cin2' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    <div className="col-span-4 text-slate-800">
                      <span>AOC-4 Balance Sheet & Notes</span>
                    </div>
                    <div className="col-span-3 text-right">
                      <span className="inline-block border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 rounded-xs">
                        In 3 days
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-center px-3 py-2.5 hover:bg-slate-50 transition-colors">
                    <div className="col-span-5 pr-2">
                      <p className="font-semibold text-slate-950 truncate">Apex Bio-Tech India LLP</p>
                      <p className="font-mono text-[11px] text-slate-500 mt-0.5">AAX-9981 (ROC Bangalore)</p>
                    </div>
                    <div className="col-span-4 text-slate-800">
                      <span>Tax Audit Form 3CD</span>
                    </div>
                    <div className="col-span-3 text-right">
                      <span className="inline-block border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 rounded-xs">
                        Ready for QC
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Trainee Laptop Shield */}
          {activeTab === 'shield' && (
            <div className="space-y-4">
              <div className="border border-slate-200 bg-white rounded-md p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">Trainee Laptop Protection</h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Articles and junior trainees view client ledgers inside a watermarked web reader. Direct downloads to personal disks are blocked.
                    </p>
                  </div>
                  <span className="border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 rounded-xs self-start sm:self-auto">
                    Shield active
                  </span>
                </div>

                <div className="p-3 border border-slate-200 bg-slate-50 rounded-md space-y-3">
                  <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
                    <span className="font-medium text-slate-800">Staff Session: Rohan V. (Article Assistant)</span>
                    <span className="text-slate-500">Device: Personal Laptop</span>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded flex items-center justify-between">
                    <div className="truncate">
                      <p className="font-medium text-slate-950 truncate">Zenith_FY25_Audited_Financial_Ledgers.pdf</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Confidential client working papers, 4.8 MB</p>
                    </div>
                    <span className="text-xs font-medium text-slate-600 shrink-0">Protected</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleSimulateDownload}
                      className="px-3.5 py-2 bg-slate-950 text-white text-xs font-medium rounded-xs hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950 active:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Simulate staff download attempt
                    </button>
                    <span className="text-xs text-slate-500">Test how Docketra prevents local data theft</span>
                  </div>

                  {shieldState === 'testing' && (
                    <div className="p-3 border border-amber-200 bg-amber-50 rounded text-amber-800 text-xs">
                      Intercepting file export stream…
                    </div>
                  )}

                  {shieldState === 'blocked' && (
                    <div className="p-3 border border-rose-200 bg-rose-50 rounded text-rose-900 text-xs space-y-1">
                      <p className="font-semibold text-rose-800">
                        Download blocked: Trainee Shield intercepted export attempt
                      </p>
                      <p className="text-rose-700 leading-relaxed">
                        Firm Enclave Rule #4: Article accounts cannot dump client ledgers onto personal hard drives. In-browser watermarked preview active with assistant ID TR-0842.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Maker-Checker QC */}
          {activeTab === 'qc' && (
            <div className="space-y-4">
              <div className="border border-slate-200 bg-white rounded-md p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">Partner Review: Form AOC-4 Financial Statements</h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Prepared by Associate Sneha · Awaiting Managing Partner Approval
                    </p>
                  </div>
                  <span
                    className={`border px-2.5 py-0.5 text-xs font-medium rounded-xs ${
                      partnerApproved
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-amber-200 bg-amber-50 text-amber-800'
                    }`}
                  >
                    {partnerApproved ? 'Approved & Sealed' : 'Pending Partner Approval'}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center p-2.5 border border-slate-200 bg-slate-50 rounded text-slate-800">
                    <span>Balance sheet and audit notes attached from Drive</span>
                    <span className="text-emerald-700 font-medium">Verified</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 border border-slate-200 bg-slate-50 rounded text-slate-800">
                    <span>Director DSC token validity verified</span>
                    <span className="text-emerald-700 font-medium">Valid through 2027</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 border border-slate-200 bg-slate-50 rounded text-slate-800">
                    <span>MCA V3 pre-scrutiny checks completed</span>
                    <span className="text-emerald-700 font-medium">0 Errors</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  {!partnerApproved ? (
                    <>
                      <span className="text-xs text-slate-500">Sign-off by CA Rajesh Mehta (Managing Partner)</span>
                      <button
                        type="button"
                        onClick={handlePartnerSignoff}
                        className="px-4 py-2 bg-slate-950 text-amber-300 font-medium text-xs rounded-xs hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950 active:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Approve & Apply SQC-1 Audit Seal
                      </button>
                    </>
                  ) : (
                    <div className="w-full p-3 border border-emerald-200 bg-emerald-50 rounded text-emerald-900 text-xs space-y-1">
                      <p className="font-semibold text-emerald-800">
                        SQC-1 Audit Trail Recorded: Partner Sign-off Complete
                      </p>
                      <p className="text-emerald-700 leading-relaxed">
                        Approved by CA Rajesh Mehta (FCA 042918). Timestamped audit trail created for ICSI/ICAI peer review inspection.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Google Drive Vault */}
          {activeTab === 'storage' && (
            <div className="space-y-4">
              <div className="border border-slate-200 bg-white rounded-md p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">Your Firm&apos;s Private Google Drive Enclave</h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Restricted drive.file permission. Zero access to pre-existing files.
                    </p>
                  </div>
                  <span className="border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 rounded-xs">
                    Private custody
                  </span>
                </div>

                <div className="p-3 border border-slate-200 bg-slate-50 rounded text-xs space-y-2">
                  <span className="text-slate-600 font-medium">Sandboxed Google Drive Path:</span>
                  <p className="text-slate-900 bg-white p-2.5 border border-slate-200 rounded break-all">
                    /Google Drive/Mehta_Associates/Clients/Zenith_Infra/FY2025-26/ROC/
                  </p>
                </div>

                <div className="p-3 border border-slate-200 bg-white rounded text-xs text-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-950">Drive Tamper Guard</span>
                    <span className="text-emerald-700 font-medium">Folder Monitor Active</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    If an article assistant accidentally moves or renames a folder in Google Drive, Docketra heals the path automatically.
                  </p>

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={handleDriveRecovery}
                      className="px-3.5 py-1.5 border border-slate-300 bg-white text-slate-800 font-medium text-xs rounded-xs hover:bg-slate-50 cursor-pointer whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950 active:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {driveRecoveryState === 'recovering' ? 'Scanning Drive…' : 'Simulate Accidental Move & Heal'}
                    </button>
                    {driveRecoveryState === 'recovered' && (
                      <span className="text-emerald-700 font-medium">
                        Restored in 0.38s with zero data loss
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Client Memory */}
          {activeTab === 'clients' && (
            <div className="space-y-4">
              <div className="border border-slate-200 bg-white rounded-md p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">Zenith Infra Private Limited</h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-0.5">
                      <span className="font-mono text-[11px]">CIN: U72200MH2021PTC368942</span>
                      <span className="text-slate-300">/</span>
                      <span>ROC Mumbai</span>
                      <span className="text-slate-300">/</span>
                      <span>Incorporated 2021</span>
                    </div>
                  </div>
                  <span className="border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 rounded-xs">
                    Active client
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 border border-slate-200 bg-slate-50 rounded">
                    <span className="text-slate-500 font-medium">Company PAN</span>
                    <div className="flex items-center justify-between mt-1 font-semibold text-slate-950">
                      <span>AAACZ1234F</span>
                      <button
                        type="button"
                        onClick={() => handleCopy('pan', 'AAACZ1234F')}
                        className="text-amber-800 hover:text-amber-950 cursor-pointer underline focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-slate-950 active:opacity-75"
                      >
                        {copiedKey === 'pan' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <div className="p-3 border border-slate-200 bg-slate-50 rounded">
                    <span className="text-slate-500 font-medium">Directors (DIN)</span>
                    <p className="font-semibold text-emerald-800 mt-1">3 Active (DSC Attached)</p>
                  </div>
                  <div className="p-3 border border-slate-200 bg-slate-50 rounded">
                    <span className="text-slate-500 font-medium">Next Tribunal Hearing</span>
                    <p className="font-semibold text-rose-700 mt-1">28-Sep (NCLT Bench 2)</p>
                  </div>
                </div>

                <div className="p-3 border border-slate-200 bg-slate-50/70 rounded flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
                  <span>Client Document Drop Link (No login required for client):</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('drop', 'https://docketra.in/u/mehta-associates/zenith-upload-2026')}
                    className="font-mono text-amber-800 hover:text-amber-950 font-medium cursor-pointer underline focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-slate-950 active:opacity-75"
                  >
                    {copiedKey === 'drop' ? 'Copied link' : 'Copy upload link'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Bar: Tab explanation in simple plain English */}
          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500">
            <span className="text-slate-700 font-medium">
              {CANVAS_TABS.find((t) => t.id === activeTab)?.description}
            </span>
            <span className="text-slate-400 font-medium shrink-0">
              Verified for Indian Compliance Practices
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InteractiveProductCanvas;
