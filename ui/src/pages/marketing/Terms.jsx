import React from 'react';
import { LegalLayout } from '../../components/legal/LegalLayout';

const SECTIONS = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'nature-of-service', label: 'Nature of Service' },
  { id: 'account-eligibility', label: 'Account & Eligibility' },
  { id: 'tenant-isolation', label: 'Tenant Isolation' },
  { id: 'data-ownership', label: 'Data Ownership' },
  { id: 'current-pricing-status', label: 'Early Access Status' },
  { id: 'acceptable-use', label: 'Acceptable Use' },
  { id: 'termination', label: 'Termination' },
  { id: 'limitation-of-liability', label: 'Limitation of Liability' },
  { id: 'governing-law', label: 'Governing Law' },
  { id: 'contact', label: 'Contact' },
];

export const TermsPage = () => (
  <LegalLayout
    title="Terms &amp; Conditions"
    description="Terms of use for Docketra early access users."
    sections={SECTIONS}
  >
    <section id="introduction">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">1. Introduction</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        These Terms and Conditions govern your use of Docketra. By accessing or using Docketra,
        you agree to these Terms.
      </p>
    </section>

    <section id="nature-of-service">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">2. Nature of Service</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Docketra is a B2B SaaS platform for firms and operations teams. It combines CMS, CRM,
        and Tasks to support lead capture, relationship management, and execution workflows.
      </p>
    </section>

    <section id="account-eligibility">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">3. Account &amp; Eligibility</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        You must be authorized to create and manage your workspace account, and you are responsible
        for safeguarding your credentials and account activity.
      </p>
    </section>

    <section id="tenant-isolation">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">4. Tenant Isolation &amp; Architecture</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Docketra enforces tenant isolation and server-side authorization checks to prevent
        cross-tenant access.
      </p>
    </section>

    <section id="data-ownership">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">5. Data Ownership</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        You retain ownership of your business data. Docketra processes data to operate the service
        and maintain security.
      </p>
    </section>

    <section id="current-pricing-status">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">6. Early Access Status</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Docketra is currently in testing and early access. Access is free at this stage.
        Billing and subscription systems are not live yet.
      </p>
    </section>

    <section id="acceptable-use">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">7. Acceptable Use</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        You agree not to misuse the platform, attempt unauthorized access, or interfere with
        service integrity and availability.
      </p>
    </section>

    <section id="termination">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">8. Termination</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        We may suspend or terminate access for abuse, security risk, or material violation of these
        Terms.
      </p>
    </section>

    <section id="limitation-of-liability">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">9. Limitation of Liability</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        To the maximum extent permitted by law, Docketra is not liable for indirect,
        incidental, or consequential damages arising from platform use.
      </p>
    </section>

    <section id="governing-law">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">10. Governing Law</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        These Terms are governed by applicable laws of India. Jurisdiction details may be provided
        during formal contracting when commercial plans go live.
      </p>
    </section>

    <section id="contact">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">11. Contact</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        For questions about these Terms, contact{' '}
        <a href="mailto:sarveshgupte@gmail.com" className="text-gray-700 underline hover:no-underline">
          sarveshgupte@gmail.com
        </a>
        .
      </p>
    </section>
  </LegalLayout>
);
