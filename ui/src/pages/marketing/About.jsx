import React from 'react';
import { LegalLayout } from '../../components/legal/LegalLayout';

const SECTIONS = [
  { id: 'who-we-serve', label: 'Who We Serve' },
  { id: 'positioning', label: 'Product Positioning' },
  { id: 'operating-model', label: 'Operating Model' },
  { id: 'current-status', label: 'Current Status' },
  { id: 'contact', label: 'Contact' },
];

export const AboutPage = () => (
  <LegalLayout
    title="About Docketra"
    description="Docketra is a connected SaaS operating system for getting clients, managing them, and executing work."
    sections={SECTIONS}
  >
    <section id="who-we-serve">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">1. Who We Serve</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Docketra is designed for CA firms, CS firms, law firms, compliance and advisory teams,
        and other operations-heavy service businesses that need structured workflows and high
        operational clarity.
      </p>
    </section>

    <section id="positioning">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">2. Product Positioning</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Docketra combines CMS, CRM, and Tasks into one connected operating system so teams can
        capture leads, manage client relationships, and execute delivery in one place.
      </p>
    </section>

    <section id="operating-model">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">3. Operating Model</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        The core operating flow is <strong>CMS → CRM → Tasks</strong>. CMS captures demand,
        CRM manages qualification and conversion, and Tasks executes client and internal work
        through dockets, routing, and auditable operational histories.
      </p>
    </section>

    <section id="current-status">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">4. Current Status</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        Docketra is currently in testing and early access. Access is free while testing.
        Billing and subscription setup are not live yet.
      </p>
    </section>

    <section id="contact">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">5. Contact</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        For product questions, early access, or feedback, contact us at{' '}
        <a href="mailto:sarveshgupte@gmail.com" className="text-gray-700 underline hover:no-underline">
          sarveshgupte@gmail.com
        </a>
        .
      </p>
    </section>
  </LegalLayout>
);
