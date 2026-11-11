import React, { useState } from 'react';

const CATEGORIES = ['ALL', 'Regulatory', 'Security', 'Compliance', 'Operations'];

const COMPARISON_ROWS = [
  {
    feature: 'Statutory Due Dates & Penalties',
    category: 'Regulatory',
    docketra: 'Tracks MCA V3, GST, and Tax due dates automatically with progressive countdowns before ₹100/day late fees kick in.',
    generic: 'Generic calendar reminders with zero knowledge of ROC forms, DIN cutoffs, or tax audit deadlines.',
    spreadsheets: 'Static Excel rows. Easily missed when staff get busy; discovered only when government show-cause notices arrive.',
  },
  {
    feature: 'Client Data & Confidentiality Perimeter',
    category: 'Security',
    docketra: '100% BYOS Google Drive storage. Trainee Laptop Shield blocks raw file downloads to personal laptops.',
    generic: 'Files stored on multi-tenant SaaS cloud servers. Staff download unencrypted spreadsheets anywhere.',
    spreadsheets: 'Client ITRs, financial ledgers, and PAN cards forwarded in WhatsApp groups and left on personal trainee laptops.',
  },
  {
    feature: 'SQC-1 Maker-Checker Partner Sign-off',
    category: 'Compliance',
    docketra: 'Mandatory 4-eye partner review before portal filing. Complete immutable audit trail ready for ICAI and ICSI peer review.',
    generic: 'Loose checkboxes. Anyone can mark a task complete without partner verification or audit logging.',
    spreadsheets: 'Zero sign-off trail. Impossible to verify who prepared the draft or who authorized the filing.',
  },
  {
    feature: 'Client Intake (WhatsApp & Upload Link)',
    category: 'Operations',
    docketra: 'Direct WhatsApp bridge and zero-login upload links. Clients send bank statements without password frustration.',
    generic: 'Forces clients onto complex third-party portals with logins they constantly forget.',
    spreadsheets: 'Messy WhatsApp chats where critical challans and bills get buried beneath everyday chatter.',
  },
  {
    feature: 'Accidental Deletion & Drive Tamper Guard',
    category: 'Security',
    docketra: 'Detects accidental folder moves or deletions inside Google Drive and re-anchors pointers in under 1 second.',
    generic: 'File paths break permanently if an associate renames or moves a folder on the shared drive.',
    spreadsheets: 'Files deleted or overwritten by accident with zero recovery mechanism.',
  },
  {
    feature: 'Client Memory (CIN, PAN, DIN, DSC)',
    category: 'Operations',
    docketra: 'One-click copy for CIN, PAN, DIN, and authorized signatories directly into MCA V3 and Income Tax filing portals.',
    generic: 'Plain text notes scattered across separate tasks; no company master structure.',
    spreadsheets: 'Staff search through old folders or ask the client for the same PAN/CIN every quarter.',
  },
  {
    feature: 'Daily Staff Worklists & Workbaskets',
    category: 'Operations',
    docketra: 'Team members see their exact prioritized daily queue. Partners monitor firm throughput without micromanaging.',
    generic: 'Cluttered kanban boards with hundreds of loose tickets that do not reflect statutory urgency.',
    spreadsheets: 'Partners must phone or WhatsApp staff daily: "Did you file the return? What is the status?".',
  },
];

const CheckSvg = () => (
  <svg className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
  </svg>
);

const CrossSvg = () => (
  <svg className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

export function ComplianceVsGenericComparison() {
  const [filterCategory, setFilterCategory] = useState('ALL');

  const filteredRows = filterCategory === 'ALL'
    ? COMPARISON_ROWS
    : COMPARISON_ROWS.filter((r) => r.category === filterCategory);

  return (
    <div className="overflow-hidden border border-slate-200 bg-white rounded-md shadow-xs">
      {/* Table Subheader / Filter Bar */}
      <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-xs sm:text-sm tracking-tight text-slate-900">
            Practice Architecture Comparison
          </span>
          <span className="text-slate-400 text-xs hidden md:inline">
            / Indian Regulatory Standards
          </span>
        </div>

        <div
          className="flex items-center gap-1.5 overflow-x-auto text-xs"
          role="tablist"
          aria-label="Comparison categories"
        >
          {CATEGORIES.map((cat) => {
            const isActive = filterCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1 rounded-xs text-xs font-medium transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950 active:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isActive
                    ? 'bg-slate-950 text-white font-semibold shadow-xs'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] table-fixed text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-800">
              <th scope="col" className="py-3.5 px-4 sm:px-5 w-[24%] font-bold text-xs text-slate-900 tracking-tight">
                Practice Requirement
              </th>
              <th scope="col" className="py-3.5 px-4 sm:px-5 w-[32%] bg-emerald-50/50 text-slate-950 border-x border-emerald-200 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-slate-950 font-bold tracking-tight block">Docketra Sovereign OS</span>
                    <span className="text-xs text-emerald-800 font-medium block mt-0.5">Firm Google Drive Perimeter</span>
                  </div>
                  <span className="shrink-0 border border-emerald-300 bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2 py-0.5 rounded-xs">
                    Purpose-built
                  </span>
                </div>
              </th>
              <th scope="col" className="py-3.5 px-4 sm:px-5 w-[22%] text-slate-700 text-xs font-semibold">
                <div>
                  <span className="text-slate-900 font-semibold block">Generic Task Trackers</span>
                  <span className="text-xs text-slate-500 font-normal block mt-0.5">Asana / Monday / ClickUp</span>
                </div>
              </th>
              <th scope="col" className="py-3.5 px-4 sm:px-5 w-[22%] text-slate-700 text-xs font-semibold">
                <div>
                  <span className="text-slate-900 font-semibold block">Excel & WhatsApp</span>
                  <span className="text-xs text-slate-500 font-normal block mt-0.5">Unstructured Ad-hoc</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80 text-xs">
            {filteredRows.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                <td className="py-4 px-4 sm:px-5 align-top">
                  <span className="inline-block text-[11px] text-slate-600 font-medium bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-xs">
                    {row.category}
                  </span>
                  <div className="mt-1 font-semibold text-xs text-slate-950 leading-snug">
                    {row.feature}
                  </div>
                </td>
                <td className="py-4 px-4 sm:px-5 align-top bg-emerald-50/20 border-x border-emerald-100">
                  <div className="flex items-start gap-2.5">
                    <CheckSvg />
                    <span className="text-xs font-medium text-slate-900 leading-relaxed">
                      {row.docketra}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-4 sm:px-5 align-top text-slate-600">
                  <div className="flex items-start gap-2.5">
                    <CrossSvg />
                    <span className="text-xs text-slate-600 leading-relaxed">
                      {row.generic}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-4 sm:px-5 align-top text-slate-600">
                  <div className="flex items-start gap-2.5">
                    <CrossSvg />
                    <span className="text-xs text-slate-600 leading-relaxed">
                      {row.spreadsheets}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer notice */}
      <div className="px-4 py-3 sm:px-5 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-600 gap-2">
        <span className="leading-normal">
          Designed specifically for Chartered Accountants (CA), Company Secretaries (CS), and Indian Corporate Legal Teams.
        </span>
        <span className="inline-flex items-center gap-1.5 text-emerald-800 font-semibold shrink-0">
          <span className="h-1.5 w-1.5 rounded-xs bg-emerald-600 shrink-0" aria-hidden="true" />
          100% Google Drive BYOS Perimeter
        </span>
      </div>
    </div>
  );
}

export default ComplianceVsGenericComparison;
