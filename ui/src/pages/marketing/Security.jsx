import React from 'react';
import { LegalLayout } from '../../components/legal/LegalLayout';

const SECTIONS = [
  { id: 'about-this-page', label: 'About This Page' },
  { id: 'data-ownership-model', label: 'Data Ownership Model' },
  { id: 'byos-model', label: 'BYOS Direction' },
  { id: 'byoai-model', label: 'BYOAI Direction' },
  { id: 'data-flow', label: 'Data Flow' },
  { id: 'backups-responsibility', label: 'Backups & Responsibility' },
  { id: 'security-approach', label: 'Security Approach' },
  { id: 'contact', label: 'Contact' },
];

export const SecurityPage = () => (
  <LegalLayout
    title="Data & Security Overview"
    description="Practical overview of how data flows and how security is handled in Docketra."
    sections={SECTIONS}
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
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">3. BYOS Direction</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Docketra is designed with a BYOS (Bring Your Own Storage) direction. Where available and
        configured, firms may keep storage in their own cloud environment.
      </p>
    </section>

    <section id="byoai-model">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">4. BYOAI Direction</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        AI features are optional. In BYOAI-style setups, firms provide and control their own AI API
        keys. If AI is not configured, core CRM/CMS/task workflows continue to operate.
      </p>
    </section>

    <section id="data-flow">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">5. Data Flow</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        A common flow is: intake (forms/API) → CRM lead records → task/docket execution.
      </p>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        This keeps client intake and downstream delivery connected in a single operating flow.
      </p>
    </section>

    <section id="backups-responsibility">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">6. Backups &amp; Responsibility</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Docketra maintains operational safeguards for service continuity. Firms remain responsible
        for their own internal retention, backup, and recovery decisions, especially in BYOS setups
        where firm-managed storage controls apply.
      </p>
    </section>

    <section id="security-approach">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">7. Security Approach</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Our baseline approach includes authenticated access, role-based access control, request-level
        authorization checks, and operational monitoring.
      </p>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        We continuously improve security controls, but no platform can promise zero risk.
      </p>
    </section>

    <section id="contact">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">8. Contact</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Security or data-handling questions can be sent to{' '}
        <a
          href="mailto:sarveshgupte@gmail.com"
          className="text-gray-700 underline hover:no-underline"
        >
          sarveshgupte@gmail.com
        </a>
        .
      </p>
    </section>
  </LegalLayout>
);
