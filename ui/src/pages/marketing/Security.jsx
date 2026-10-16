import { SUPPORT_EMAIL } from '../../config/publicContact';
import React from 'react';
import { LegalLayout } from '../../components/legal/LegalLayout';

const SECTIONS = [
  { id: 'about-this-page', label: 'About This Page' },
  { id: 'data-ownership-model', label: 'Data Ownership Model' },
  { id: 'byos-model', label: 'Sovereign BYOS Architecture' },
  { id: 'tamper-protection', label: 'Folder Tamper & Deletion Guard' },
  { id: 'byoai-model', label: 'BYOAI Direction' },
  { id: 'data-flow', label: 'Data Flow' },
  { id: 'backups-responsibility', label: 'Backups & Responsibility' },
  { id: 'security-approach', label: 'Security Approach' },
  { id: 'contact', label: 'Contact' },
];

export const SecurityPage = () => (
  <LegalLayout
    title="Data & Security Overview"
    description="A practical overview of how Docketra thinks about firm-owned data, storage direction, AI controls, and authenticated access."
    sections={SECTIONS}
    kicker="Trust architecture"
    highlights={['Firm-owned data model', 'BYOS and BYOAI direction', 'Role-based access controls']}
  >
    <section id="about-this-page">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">1. About This Page</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        This page is a product overview, not a legal contract. It explains how Docketra currently
        handles data and security in early-stage testing.
      </p>
    </section>

    <section id="data-ownership-model">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">2. Data Ownership Model</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Firms own their workspace data. Docketra processes that data to provide core product
        workflows and maintain service operations.
      </p>
    </section>

    <section id="byos-model">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">3. Sovereign BYOS Architecture</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Docketra operates on a Sovereign Bring Your Own Storage (BYOS) model. When your firm connects Google Drive,
        authentication is restricted strictly to Google's <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">drive.file</code> OAuth scope.
        Under this restricted scope, Docketra creates its own dedicated firm folder and can strictly <em>only</em> access files
        and folders that Docketra itself created. Docketra has zero ability to view, search, index, or touch any pre-existing
        client archives, private documents, or personal folders in your Google Drive.
      </p>
      <p className="mt-2 text-sm text-gray-600 leading-relaxed">
        Drive credentials and connection settings are locked exclusively to the Primary Admin via OTP verification;
        staff and rotating article clerks have zero administrative access to modify or re-point cloud storage credentials.
      </p>
    </section>

    <section id="tamper-protection">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">4. Google Drive Folder Tamper &amp; Deletion Guard</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        A common fear among managing partners is that a trainee or clerk might accidentally move, drag, or trash a synchronized
        folder inside Google Drive. Docketra safeguards against this through automated cloud metadata synchronization:
      </p>
      <ul className="mt-3 space-y-2 text-sm text-gray-600 list-disc list-inside leading-relaxed">
        <li>
          <strong>Persistent Resource ID Tracking:</strong> Folders in Google Drive are mapped by persistent, immutable resource IDs
          rather than fragile directory path strings. If a team member drags or renames a folder in Drive, Docketra’s metadata
          engine maintains continuous link integrity without breaking active dockets.
        </li>
        <li>
          <strong>Root Manifest Verification:</strong> Every firm root folder contains an encrypted identity manifest (<code className="text-xs bg-gray-100 px-1 py-0.5 rounded">.docketra_storage_root.json</code>).
          Docketra verifies this manifest on every health check to prevent folder misdirection or accidental unlinking.
        </li>
        <li>
          <strong>Trashed Folder Detection &amp; 1-Click Recovery:</strong> If a synchronized folder is accidentally moved to the Google Drive
          Trash, Docketra’s telemetry immediately detects the event (<code className="text-xs bg-gray-100 px-1 py-0.5 rounded">STORAGE_ROOT_MISSING</code>),
          notifies the Primary Admin, and provides 1-click folder restoration and re-sync from immutable audit history.
        </li>
      </ul>
    </section>

    <section id="byoai-model">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">5. BYOAI Direction</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        AI features are optional. In BYOAI-style setups, firms provide and control their own AI API
        keys. If AI is not configured, core CRM/CMS/task workflows continue to operate.
      </p>
    </section>

    <section id="data-flow">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">6. Data Flow</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        A common flow is: intake (forms/API) → CRM lead records → task/docket execution.
      </p>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        This keeps client intake and downstream delivery connected in a single operating flow.
      </p>
    </section>

    <section id="backups-responsibility">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">7. Backups &amp; Responsibility</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Docketra maintains operational safeguards for service continuity. Firms remain responsible
        for their own internal retention, backup, and recovery decisions, especially in BYOS setups
        where firm-managed storage controls apply.
      </p>
    </section>

    <section id="security-approach">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">8. Security Approach</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Our baseline approach includes authenticated access, role-based access control, request-level
        authorization checks, and operational monitoring.
      </p>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        We continuously improve security controls, but no platform can promise zero risk.
      </p>
    </section>

    <section id="contact">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">9. Contact</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Security or data-handling questions can be sent to <a href={`mailto:${SUPPORT_EMAIL}`} className="text-gray-700 underline hover:no-underline">{SUPPORT_EMAIL}</a>.
      </p>
    </section>
  </LegalLayout>
);
