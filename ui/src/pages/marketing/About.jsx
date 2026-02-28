import React from 'react';
import { LegalLayout } from '../../components/legal/LegalLayout';
import { COMPANY_NAME, COMPANY_CIN } from '../../lib/legalVersion';

const SECTIONS = [
  { id: 'who-we-are', label: 'Who We Are' },
  { id: 'mission', label: 'Mission' },
  { id: 'architecture', label: 'Platform Architecture' },
  { id: 'governance', label: 'Governance Model' },
  { id: 'company-information', label: 'Company Information' },
];

export const AboutPage = () => (
  <LegalLayout
    title="About Docketra"
    description="Docketra is an enterprise-grade B2B SaaS platform for work and case management."
    sections={SECTIONS}
  >
    <section id="who-we-are">
      <h2 className="text-xl font-semibold text-slate-900">1. Who We Are</h2>
      <p className="mt-3 text-sm leading-relaxed">
        Docketra is an enterprise-ready B2B SaaS platform designed for service-oriented
        organizations that require structured workflows, role-based governance, and secure
        document-backed case management. We serve law firms, consulting firms, accounting teams,
        HR organizations, and operations teams who operate under strict accountability and
        compliance requirements.
      </p>
    </section>

    <section id="mission">
      <h2 className="text-xl font-semibold text-slate-900">2. Mission</h2>
      <p className="mt-3 text-sm leading-relaxed">
        Our mission is to provide organizations with a reliable, auditable, and governance-ready
        operational platform. We believe that enterprise software should enforce accountability
        by design — every action traceable, every boundary enforced, every workflow structured
        and predictable.
      </p>
    </section>

    <section id="architecture">
      <h2 className="text-xl font-semibold text-slate-900">3. Platform Architecture Philosophy</h2>
      <p className="mt-3 text-sm leading-relaxed">
        Docketra is built on a strict multi-tenant architecture. Each organization receives a
        fully isolated logical environment with dedicated data boundaries. All permissions are
        evaluated server-side and no tenant can access or interfere with another tenant's data or
        workflows. The platform is designed to scale to hundreds of tenants without compromising
        isolation, performance, or security.
      </p>
    </section>

    <section id="governance">
      <h2 className="text-xl font-semibold text-slate-900">4. Governance Model</h2>
      <p className="mt-3 text-sm leading-relaxed">
        Every platform decision is governed by a layered control model: role-based access
        enforced at the API layer, immutable audit logs at the data layer, and structured
        workflow state machines at the business logic layer. Superadmin operations are strictly
        separated from tenant operations with no overlap in access scope.
      </p>
    </section>

    <section id="company-information">
      <h2 className="text-xl font-semibold text-slate-900">5. Company Information</h2>
      <p className="mt-3 text-sm leading-relaxed">
        Docketra is developed and operated by:
      </p>
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="font-semibold text-slate-800">{COMPANY_NAME}</p>
        <p className="mt-1 text-slate-600">CIN: {COMPANY_CIN}</p>
      </div>
    </section>
  </LegalLayout>
);
