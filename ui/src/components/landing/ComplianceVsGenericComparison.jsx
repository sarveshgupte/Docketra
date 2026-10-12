import React from 'react';

const COMPARISON_ROWS = [
  {
    feature: 'Due Dates & Penalties',
    docketra: 'Tracks MCA, GST, and Tax due dates automatically with warnings before late fees kick in.',
    generic: 'Basic calendar dates with no knowledge of MCA forms or tax cutoffs.',
    spreadsheets: 'Manual Excel sheets where dates easily get missed or forgotten.',
  },
  {
    feature: 'Client Details (CIN & PAN)',
    docketra: '1-click copy for CIN, PAN, and director DINs for fast filing on government portals.',
    generic: 'Plain text boxes with no company details or structure.',
    spreadsheets: 'Buried in old Excel files; staff waste time searching through folders.',
  },
  {
    feature: 'Client Document Storage',
    docketra: 'Files save straight into your firm’s own Google Drive. You own 100% of your records.',
    generic: 'Stored on third-party servers outside your own control.',
    spreadsheets: 'Files scattered across employee laptops and WhatsApp chats.',
  },
  {
    feature: 'Accidental Deletion Safety',
    docketra: 'If staff move or trash a folder in Drive, Docketra detects it and restores the link with 0 data loss.',
    generic: 'File links break completely if someone renames a folder.',
    spreadsheets: 'Files get permanently lost or deleted by mistake.',
  },
  {
    feature: 'Client Intake (WhatsApp)',
    docketra: 'Direct WhatsApp bridge lets assistants forward client media into dockets with zero client portal logins.',
    generic: 'Forces clients onto unfamiliar external web portals they refuse to use.',
    spreadsheets: 'Messy WhatsApp groups where files get buried under hundreds of messages.',
  },
  {
    feature: 'Partner Check Before Filing',
    docketra: 'Partners review draft forms and challans before staff submit them to the portal.',
    generic: 'Simple checkboxes where anyone can mark a task complete without partner check.',
    spreadsheets: 'No record of who checked what. Mistakes are caught only after notices arrive.',
  },
  {
    feature: 'Daily Staff Worklists',
    docketra: 'Direct task assignment for associates and article clerks with live status on every matter.',
    generic: 'Confusing project boards that get cluttered with loose tickets.',
    spreadsheets: 'Requires calling or messaging staff repeatedly to ask "what is the status?".',
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
