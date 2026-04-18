import React from 'react';
import { LegalLayout } from '../../components/legal/LegalLayout';

const SECTIONS = [
  { id: 'service-description', label: 'Service Description' },
  { id: 'account-responsibility', label: 'Account Responsibility' },
  { id: 'acceptable-use', label: 'Acceptable Use' },
  { id: 'data-ownership', label: 'Data Ownership' },
  { id: 'availability', label: 'Availability & Changes' },
  { id: 'liability', label: 'Limitation of Liability' },
  { id: 'updates-to-terms', label: 'Updates to Terms' },
  { id: 'contact', label: 'Contact' },
];

export const TermsPage = () => (
  <LegalLayout
    title="Terms of Use"
    description="Simple terms for using Docketra in early-stage testing."
    sections={SECTIONS}
  >
    <section id="service-description">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">1. Service Description</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Docketra is a SaaS platform that provides CRM, CMS, and task management tools for firms
        and organizations.
      </p>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        The platform is in early-stage testing, and features may change as the product evolves.
      </p>
    </section>

    <section id="account-responsibility">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">2. Account Responsibility</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        You are responsible for your login credentials, actions taken through your account, and
        data uploaded or submitted in your workspace.
      </p>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Please keep your credentials secure and notify us promptly if you believe your account has
        been accessed without authorization.
      </p>
    </section>

    <section id="acceptable-use">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">3. Acceptable Use</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        You must not use Docketra for illegal activity, abuse the platform, or attempt to bypass,
        probe, or break service security controls.
      </p>
    </section>

    <section id="data-ownership">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">4. Data Ownership</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Your firm owns its business data. Docketra processes your data only to provide, secure,
        and improve the service.
      </p>
    </section>

    <section id="availability">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">5. Availability &amp; Changes</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        We may update, improve, or change features at any time. Because Docketra is in early-stage
        testing, temporary downtime, maintenance windows, or interruptions may occur.
      </p>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        We do not provide guaranteed uptime at this stage.
      </p>
    </section>

    <section id="liability">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">6. Limitation of Liability</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Docketra is provided on an "as available" basis. To the extent permitted by applicable
        law, Docketra is not liable for indirect or consequential losses resulting from use of the
        platform.
      </p>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Our aggregate liability for direct claims relating to the service is limited to a reasonable
        amount under applicable law.
      </p>
    </section>

    <section id="updates-to-terms">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">7. Updates to Terms</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        We may update these Terms from time to time. If you continue using Docketra after updates
        are posted, you agree to the revised Terms.
      </p>
    </section>

    <section id="contact">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">8. Contact</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Questions about these Terms can be sent to{' '}
        <a href="mailto:sarveshgupte@gmail.com" className="text-gray-700 underline hover:no-underline">
          sarveshgupte@gmail.com
        </a>
        .
      </p>
    </section>
  </LegalLayout>
);
