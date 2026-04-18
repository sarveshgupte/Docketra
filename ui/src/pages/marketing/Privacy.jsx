import React from 'react';
import { LegalLayout } from '../../components/legal/LegalLayout';

const SECTIONS = [
  { id: 'data-collected', label: 'What We Collect' },
  { id: 'data-use', label: 'How We Use Data' },
  { id: 'data-sharing', label: 'Data Sharing' },
  { id: 'data-storage', label: 'Data Storage' },
  { id: 'security', label: 'Security' },
  { id: 'user-control', label: 'User Control' },
  { id: 'cookies', label: 'Cookies & Tracking' },
  { id: 'compliance-alignment', label: 'Compliance Alignment' },
  { id: 'contact', label: 'Contact' },
];

export const PrivacyPage = () => (
  <LegalLayout
    title="Privacy Policy"
    description="How Docketra handles data in early-stage testing."
    sections={SECTIONS}
  >
    <section id="data-collected">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">1. What We Collect</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">We collect limited categories of data needed to run Docketra, including:</p>
      <ul className="mt-3 list-disc pl-5 space-y-1 text-sm text-gray-600">
        <li>Account information (such as name and email).</li>
        <li>Firm workspace data (such as clients, tasks, dockets, forms, and related records).</li>
        <li>Usage and operational data (such as logs, performance events, and security events).</li>
        <li>Optional intake data submitted through forms or API intake routes.</li>
      </ul>
    </section>

    <section id="data-use">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">2. How We Use Data</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">We use data to:</p>
      <ul className="mt-3 list-disc pl-5 space-y-1 text-sm text-gray-600">
        <li>Provide and maintain the service.</li>
        <li>Authenticate users and manage accounts.</li>
        <li>Improve product reliability, usability, and security.</li>
      </ul>
    </section>

    <section id="data-sharing">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">3. Data Sharing</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        We do not sell your data. We share data only when needed to run Docketra (for example,
        with hosting or database infrastructure providers) or when required by applicable law.
      </p>
    </section>

    <section id="data-storage">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">4. Data Storage</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Data is stored using our infrastructure providers. In BYOS-style setups, if enabled for
        your firm, data may also be stored in infrastructure controlled by your firm.
      </p>
    </section>

    <section id="security">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">5. Security</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        We apply reasonable technical and operational safeguards to protect data. No system can
        guarantee absolute security, and you should also follow your own internal security controls.
      </p>
    </section>

    <section id="user-control">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">6. User Control</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Firms control their workspace data. You may request export or deletion of your data,
        subject to product support and legal/operational constraints.
      </p>
    </section>

    <section id="cookies">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">7. Cookies &amp; Tracking</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Docketra may use essential cookies and similar technologies for session management,
        security, and basic analytics.
      </p>
    </section>

    <section id="compliance-alignment">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">8. Compliance Alignment</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Our privacy practices are designed to align broadly with applicable Indian IT and data
        protection obligations. This policy is informational and should not be read as a claim of
        full certification or full compliance with any specific framework.
      </p>
    </section>

    <section id="contact">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">9. Contact</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Privacy questions can be sent to{' '}
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
