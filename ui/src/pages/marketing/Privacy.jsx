import React from 'react';
import { LegalLayout } from '../../components/legal/LegalLayout';

const SECTIONS = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'information-we-collect', label: 'Information We Collect' },
  { id: 'legal-basis', label: 'Legal Basis' },
  { id: 'data-security', label: 'Data Security' },
  { id: 'data-sharing', label: 'Data Sharing' },
  { id: 'data-retention', label: 'Data Retention' },
  { id: 'user-rights', label: 'User Rights' },
  { id: 'grievance-officer', label: 'Grievance Officer' },
];

export const PrivacyPage = () => (
  <LegalLayout
    title="Privacy Policy"
    description="How Docketra collects, uses, and protects your information."
    sections={SECTIONS}
  >
    <section id="introduction">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">1. Introduction</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        This Privacy Policy describes how GUPTE ENTERPRISES (OPC) PRIVATE LIMITED ("Company",
        "we", "us") collects, uses, and protects information when you use Docketra. We are
        committed to protecting the privacy of our customers and their end-users. This policy is
        aligned with the Digital Personal Data Protection Act, 2023 (DPDP Act) and applicable
        GDPR principles.
      </p>
    </section>

    <section id="information-we-collect">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">2. Information We Collect</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        We collect information you provide directly (such as account registration details, case
        data, and uploaded documents), information generated through your use of the platform
        (such as activity logs and session metadata), and technical data (such as IP addresses,
        browser type, and device identifiers) to operate and improve the service.
      </p>
    </section>

    <section id="legal-basis">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">3. Legal Basis</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Processing of personal data is conducted on the following legal bases: performance of a
        contract (to deliver the SaaS service), legitimate interests (to maintain security and
        improve the platform), compliance with legal obligations, and consent where explicitly
        obtained. We process only the minimum data necessary for each purpose.
      </p>
    </section>

    <section id="data-security">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">4. Data Security</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        We apply technical and organizational measures to protect personal data against unauthorized
        access, loss, or disclosure. These include TLS encryption in transit, encryption at rest,
        role-based access controls, and audit logging. Our security posture is described in detail
        on our{' '}
        <a href="/security" className="text-gray-700 underline hover:no-underline">
          Security page
        </a>
        .
      </p>
    </section>

    <section id="data-sharing">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">5. Data Sharing</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        We do not sell personal data. We share data only with trusted sub-processors required to
        operate the service (such as cloud infrastructure and email delivery providers), under
        contractual obligations that enforce equivalent data protection standards. We may disclose
        data where required by law or court order.
      </p>
    </section>

    <section id="data-retention">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">6. Data Retention</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        We retain personal data for the duration of the subscription and for a reasonable period
        thereafter to comply with legal obligations and resolve disputes. Tenant data is purged in
        accordance with the agreed data retention schedule following account termination.
      </p>
    </section>

    <section id="user-rights">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">7. User Rights</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Depending on applicable law, you may have the right to access, correct, delete, or port
        your personal data, and to restrict or object to its processing. To exercise these rights,
        contact us at{' '}
        <a
          href="mailto:privacy@docketra.com"
          className="text-gray-700 underline hover:no-underline"
        >
          privacy@docketra.com
        </a>
        .
      </p>
    </section>

    <section id="grievance-officer">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">8. Grievance Officer</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        In accordance with the Digital Personal Data Protection Act, 2023, a Grievance Officer is
        available to address privacy-related concerns. You may contact the Grievance Officer at:
      </p>
      <ul className="mt-3 space-y-1 text-sm">
        <li>
          Privacy enquiries:{' '}
          <a
            href="mailto:privacy@docketra.com"
            className="text-gray-700 underline hover:no-underline"
          >
            privacy@docketra.com
          </a>
        </li>
        <li>
          Grievance escalations:{' '}
          <a
            href="mailto:grievance@docketra.com"
            className="text-gray-700 underline hover:no-underline"
          >
            grievance@docketra.com
          </a>
        </li>
      </ul>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        We aim to acknowledge complaints within 48 hours and resolve them within 30 days.
      </p>
    </section>
  </LegalLayout>
);
