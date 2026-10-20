import React, { useState } from 'react';

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
    docketra: 'Mandatory 4-eye partner review before portal filing. Complete immutable audit trail ready for ICAI/ICSI peer review.',
    generic: 'Loose checkboxes. Anyone can mark a task complete without partner verification or audit logging.',
    spreadsheets: 'Zero sign-off trail. Impossible to verify who prepared the draft or who authorized the filing.',
  },
  {
    feature: 'Client Intake (WhatsApp & Upload Link)',
    category: 'Operations',
    docketra: 'Direct WhatsApp bridge & zero-login upload links. Clients send bank statements without password frustration.',
    generic: 'Forces clients onto complex third-party portals with logins they constantly forget.',
    spreadsheets: 'Messy WhatsApp chats where critical challans and bills get buried beneath everyday chatter.',
  },
  {
    feature: 'Accidental Deletion & Drive Tamper Guard',
    category: 'Safety',
    docketra: 'Detects accidental folder moves or deletions inside Google Drive and re-anchors pointers in under 1 second.',
    generic: 'File paths break permanently if an associate renames or moves a folder on the shared drive.',
    spreadsheets: 'Files deleted or overwritten by accident with zero recovery mechanism.',
  },
  {
    feature: 'Client Memory (CIN, PAN, DIN, DSC)',
    category: 'Productivity',
    docketra: '1-click copy for CIN, PAN, DIN, and authorized signatories directly into MCA V3 and Income Tax filing portals.',
    generic: 'Plain text notes scattered across separate tasks; no company master structure.',
    spreadsheets: 'Staff search through old folders or ask the client for the same PAN/CIN every quarter.',
  },
  {
    feature: 'Daily Staff Worklists & Workbaskets',
    category: 'Management',
    docketra: 'Team members see their exact prioritized daily queue. Partners monitor firm throughput without micromanaging.',
    generic: 'Cluttered kanban boards with hundreds of loose tickets that don’t reflect statutory urgency.',
    spreadsheets: 'Partners must phone or WhatsApp staff daily: "Did you file the return? What is the status?".',
  },
];

export function ComplianceVsGenericComparison() {
  const [filterCategory, setFilterCategory] = useState('ALL');

  const filteredRows = filterCategory === 'ALL'
    ? COMPARISON_ROWS
    : COMPARISON_ROWS.filter((r) => r.category === filterCategory);

  return (
    <div className="overflow-hidden border border-slate-300 bg-white rounded-lg shadow-sm">
      {/* Table Subheader / Filter Bar */}
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="font-bold text-xs sm:text-sm tracking-tight">Practice Architecture Comparison</span>
          <span className="text-slate-400 font-mono text-[11px] hidden md:inline">| Indian Regulatory Standards</span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar font-mono text-[10px]">
          {['ALL', 'Regulatory', 'Security', 'Compliance', 'Operations'].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterCategory(cat)}
              className={`px-2.5 py-1 rounded-xs transition-colors cursor-pointer ${
                filterCategory === cat
                  ? 'bg-amber-400 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/90 text-xs font-bold text-slate-800">
              <th className="py-3 px-4 w-1/4">Practice Requirement</th>
              <th className="py-3 px-4 w-5/12 bg-emerald-50/50 text-slate-950 border-x border-emerald-200">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-950 font-extrabold">Docketra Sovereign OS</span>
                  <span className="border border-emerald-300 bg-emerald-100 text-emerald-800 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-xs">
                    PURPOSE-BUILT
                  </span>
                </div>
              </th>
              <th className="py-3 px-4 w-1/4 text-slate-600 font-semibold">
                Generic Task Trackers
                <span className="block font-mono text-[10px] text-slate-400 font-normal">Asana / Monday / ClickUp</span>
              </th>
              <th className="py-3 px-4 w-1/6 text-slate-600 font-semibold">
                Excel & WhatsApp
                <span className="block font-mono text-[10px] text-slate-400 font-normal">Unstructured Ad-hoc</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {filteredRows.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3.5 px-4 font-semibold text-slate-900">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[9px] text-slate-400 uppercase">[{row.category}]</span>
                  </div>
                  <div className="mt-0.5 text-slate-950 font-bold">{row.feature}</div>
                </td>
                <td className="py-3.5 px-4 font-medium text-slate-950 bg-emerald-50/20 border-x border-emerald-100">
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold shrink-0 mt-0.5 text-sm">✓</span>
                    <span className="leading-relaxed">{row.docketra}</span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-slate-500">
                  <div className="flex items-start gap-2">
                    <span className="text-rose-400 font-normal shrink-0 mt-0.5 text-sm">✕</span>
                    <span className="leading-relaxed">{row.generic}</span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-slate-500">
                  <div className="flex items-start gap-2">
                    <span className="text-rose-400 font-normal shrink-0 mt-0.5 text-sm">✕</span>
                    <span className="leading-relaxed">{row.spreadsheets}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer notice */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] text-slate-500 gap-2">
        <span>Designed specifically for Chartered Accountants (CA), Company Secretaries (CS), and Indian Corporate Legal Counsels.</span>
        <span className="font-mono text-emerald-800 font-semibold shrink-0">100% Google Drive BYOS Perimeter</span>
      </div>
    </div>
  );
}

export default ComplianceVsGenericComparison;
