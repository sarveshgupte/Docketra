import React from 'react';
import { LegalLayout } from '../../components/legal/LegalLayout';

const SECTIONS = [
  { id: 'prohibited-activity', label: 'Prohibited Activity' },
  { id: 'enforcement', label: 'Enforcement' },
  { id: 'reporting', label: 'Reporting' },
];

export const AcceptableUsePage = () => (
  <LegalLayout
    title="Acceptable Use Policy"
    description="Simple rules for safe and lawful use of Docketra."
    sections={SECTIONS}
  >
    <section id="prohibited-activity">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">1. Prohibited Activity</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">You must not use Docketra to:</p>
      <ul className="mt-3 list-disc pl-5 space-y-1 text-sm text-gray-600">
        <li>Conduct illegal activity.</li>
        <li>Upload malicious code, harmful files, or abusive content.</li>
        <li>Attempt unauthorized access, vulnerability probing, or service disruption.</li>
      </ul>
    </section>

    <section id="enforcement">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">2. Enforcement</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        If misuse is detected, Docketra may limit or suspend access to protect the platform and
        other users.
      </p>
    </section>

    <section id="reporting">
      <h2 className="text-xl font-semibold mt-8 mb-2 text-gray-700">3. Reporting</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
        To report abuse or suspicious activity, contact{' '}
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
