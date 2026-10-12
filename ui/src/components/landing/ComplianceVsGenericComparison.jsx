import React from 'react';

const COMPARISON_ROWS = [
  {
    feature: 'Statutory Deadlines',
    docketra: 'Automated MCA, Tax, and NCLT calendars with penalty tracking.',
    generic: 'Generic calendar dates without regulatory logic.',
    spreadsheets: 'Manual color-coding easily missed or outdated.',
  },
  {
    feature: 'Client Memory (CIN & PAN)',
    docketra: 'Structured company profiles, active DINs, and 1-click filing copy.',
    generic: 'Unstructured text fields with no firm hierarchy.',
    spreadsheets: 'Scattered across old folders and message threads.',
  },
  {
    feature: 'Document Custody',
    docketra: 'Files save directly into your firm’s private Google Drive.',
    generic: 'Stored on proprietary third-party servers.',
    spreadsheets: 'Unmanaged attachments across employee drives.',
  },
  {
    feature: 'Drive Tamper & Deletion Guard',
    docketra: 'Auto-detects moved or trashed folders via metadata sync; re-links with 0 data loss.',
    generic: 'Fragile paths break if rearranged; proprietary lock-in.',
    spreadsheets: 'Permanent file loss or broken links when assistants move folders.',
  },
  {
    feature: 'Pre-Filing QC Review',
    docketra: 'Partner sign-off and challan validation before portal submission.',
    generic: 'Simple checkboxes without verification gates.',
    spreadsheets: 'No audit trail. Errors caught only after penalties occur.',
  },
  {
    feature: 'Team Worklists',
    docketra: 'Direct matter assignment with real-time operational status.',
    generic: 'Cluttered Kanban boards with generic tickets.',
    spreadsheets: 'Constant phone and chat follow-ups to ask for status.',
  },
];

export function ComplianceVsGenericComparison() {
  return (
    <div className="overflow-hidden border border-slate-200 bg-white">
      <div className="md:hidden px-4 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-medium text-slate-700 flex items-center justify-between">
        <span>Capability Comparison</span>
        <span className="text-slate-500 font-mono text-[10px]">Swipe to compare →</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-700">
              <th className="py-3 px-4 w-1/4">Capability</th>
              <th className="py-3 px-4 w-1/3 bg-slate-100 text-slate-950 border-x border-slate-200 font-bold">
                Docketra
              </th>
              <th className="py-3 px-4 w-1/4 text-slate-600 font-medium">Generic Trackers</th>
              <th className="py-3 px-4 w-1/6 text-slate-600 font-medium">Excel & WhatsApp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {COMPARISON_ROWS.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50/40 transition-colors">
                <td className="py-3 px-4 font-semibold text-slate-900">
                  {row.feature}
                </td>
                <td className="py-3 px-4 font-medium text-slate-950 bg-slate-50/30 border-x border-slate-200">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold shrink-0 mt-0.5">✓</span>
                    <span>{row.docketra}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-slate-500">
                  <div className="flex items-start gap-2">
                    <span className="text-slate-300 font-normal shrink-0 mt-0.5">✕</span>
                    <span>{row.generic}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-slate-500">
                  <div className="flex items-start gap-2">
                    <span className="text-slate-300 font-normal shrink-0 mt-0.5">✕</span>
                    <span>{row.spreadsheets}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ComplianceVsGenericComparison;
