import React from 'react';

const COMPARISON_ROWS = [
  {
    feature: 'Due Dates & Penalties',
    docketra: 'Automatic tracking for MCA forms, Tax dates, and Court hearings. Warns you before late fees kick in.',
    generic: 'Generic calendar dates. No built-in knowledge of MCA forms, tax due dates, or penalty rules.',
    spreadsheets: 'Manual color-coding that easily gets outdated when dates change.',
  },
  {
    feature: 'Client Details (CIN & PAN)',
    docketra: 'Keeps CIN, PAN, and director details in one place with 1-click copy for fast government filings.',
    generic: 'Just plain text fields with no company structure.',
    spreadsheets: 'Buried in old Excel files; staff waste hours searching through folders.',
  },
  {
    feature: 'Client Document Storage',
    docketra: 'Saves files straight into your firm’s Google Drive. You own all client files with zero lock-in.',
    generic: 'Files stored on third-party servers outside your own Google Drive.',
    spreadsheets: 'Documents scattered across employee laptops and WhatsApp chats.',
  },
  {
    feature: 'Checking Work Before Filing',
    docketra: 'Partners can review and approve filings before staff submit them to the government.',
    generic: 'Simple checkboxes where anyone can mark a task complete without any partner check.',
    spreadsheets: 'No approval trail. You only find mistakes after the client complains.',
  },
  {
    feature: 'Staff Task Assignment',
    docketra: 'Assign matters to specific associates and see live progress on every client engagement.',
    generic: 'Generic project boards that get cluttered with hundreds of loose tickets.',
    spreadsheets: 'Requires calling or messaging staff repeatedly to ask "What is the status?".',
  },
];

export function ComplianceVsGenericComparison() {
  return (
    <div className="overflow-hidden rounded-sm border border-slate-200/80 bg-white">
      <div className="md:hidden px-4 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-medium text-slate-700 flex items-center justify-between">
        <span>Comparison Overview</span>
        <span className="text-slate-600 font-mono text-[10px]">← Swipe to compare columns →</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
              <th className="py-3 px-4 w-1/4">Capability</th>
              <th className="py-3 px-4 w-1/3 bg-slate-100/60 text-slate-900 border-x border-slate-200 font-bold">
                Docketra
              </th>
              <th className="py-3 px-4 w-1/4 text-slate-600 font-medium">Generic Task Trackers</th>
              <th className="py-3 px-4 w-1/6 text-slate-600 font-medium">Excel & WhatsApp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {COMPARISON_ROWS.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                <td className="py-3.5 px-4 font-semibold text-slate-900">
                  {row.feature}
                </td>
                <td className="py-3.5 px-4 font-medium text-slate-950 bg-slate-50/40 border-x border-slate-200/70">
                  <div className="flex items-start gap-2">
                    <span className="text-slate-900 font-bold shrink-0 mt-0.5">✓</span>
                    <span>{row.docketra}</span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-slate-600">
                  <div className="flex items-start gap-2">
                    <span className="text-slate-400 font-normal shrink-0 mt-0.5">✕</span>
                    <span>{row.generic}</span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-slate-600">
                  <div className="flex items-start gap-2">
                    <span className="text-slate-400 font-normal shrink-0 mt-0.5">✕</span>
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
