import React from 'react';

const COMPARISON_ROWS = [
  {
    feature: 'Statutory Deadlines & Penalties',
    docketra: 'Native Indian statutory calendar (MCA, Income Tax, GST, NCLT) with compounding penalty warnings.',
    generic: 'Generic calendar dates with no knowledge of statutory forms, SRN, or compounding fines.',
    spreadsheets: 'Manual color-coding easily broken when dates shift or filings are delayed.',
  },
  {
    feature: 'Entity Identifiers & Validation',
    docketra: 'First-class support for 21-digit CIN, DIN, PAN, GSTIN, and SRN with 1-click clipboard copy.',
    generic: 'Plain text fields with zero format validation or entity hierarchy awareness.',
    spreadsheets: 'Scattered across columns; prone to copy-paste typos and duplicate records.',
  },
  {
    feature: 'Document Custody & Confidentiality',
    docketra: 'Bring Your Own Storage (BYOS): Files stay in your Google Drive or AWS S3. Zero third-party custody.',
    generic: 'Files stored on third-party multi-tenant servers outside your firm’s direct perimeter.',
    spreadsheets: 'Local downloads or personal WhatsApp chats risking client confidentiality leaks.',
  },
  {
    feature: 'Maker-Checker Quality Control (QC)',
    docketra: 'Mandatory two-tier review gate before filing with MCA or dispatching to client directors.',
    generic: 'Basic checkbox tasks; anyone can mark a critical filing complete with no review gate.',
    spreadsheets: 'Zero review trail; no accountability if an unverified balance sheet gets filed.',
  },
  {
    feature: 'Unified 3-Pane Client Memory',
    docketra: 'Entity master, active litigation roadmap, and document vault visible side-by-side.',
    generic: 'Tasks disconnected from company identity and legal context across multiple boards.',
    spreadsheets: 'Dozens of disjointed Excel tabs per client with no central operational memory.',
  },
  {
    feature: 'Workbaskets & Queue Oversight',
    docketra: 'Shared intake queues allow team members to pull work without tasks slipping through cracks.',
    generic: 'Manual manual assignment only; unassigned tickets get forgotten in backlogs.',
    spreadsheets: 'Depends on verbal delegation; tasks lost when staff take leave or resign.',
  },
];

export function ComplianceVsGenericComparison() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-mono uppercase tracking-wider text-slate-500">
              <th className="py-4 px-5 font-bold w-1/4">Operational Capability</th>
              <th className="py-4 px-5 font-bold w-1/3 bg-amber-500/5 text-amber-900 border-x border-amber-200/60">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span>Docketra Compliance OS</span>
                </div>
              </th>
              <th className="py-4 px-5 font-bold w-1/4">Generic Task Managers (Asana / ClickUp)</th>
              <th className="py-4 px-5 font-bold w-1/6">Excel & WhatsApp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {COMPARISON_ROWS.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                <td className="py-4 px-5 font-bold text-slate-900 leading-snug">
                  {row.feature}
                </td>
                <td className="py-4 px-5 font-semibold text-slate-900 leading-relaxed bg-amber-500/[0.02] border-x border-amber-200/40">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold shrink-0 mt-0.5">✓</span>
                    <span>{row.docketra}</span>
                  </div>
                </td>
                <td className="py-4 px-5 text-slate-500 leading-relaxed">
                  <div className="flex items-start gap-2">
                    <span className="text-slate-400 shrink-0 mt-0.5">✕</span>
                    <span>{row.generic}</span>
                  </div>
                </td>
                <td className="py-4 px-5 text-slate-500 leading-relaxed">
                  <div className="flex items-start gap-2">
                    <span className="text-rose-400 shrink-0 mt-0.5">✕</span>
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
