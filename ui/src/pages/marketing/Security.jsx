import React from 'react';
import { LegalLayout } from '../../components/legal/LegalLayout';

const SECTIONS = [
  { id: 'security-overview', label: 'Security Overview' },
  { id: 'tenant-isolation', label: 'Tenant Isolation Model' },
  { id: 'encryption', label: 'Encryption Standards' },
  { id: 'access-control', label: 'Access Control & RBAC' },
  { id: 'audit-logging', label: 'Audit Logging' },
  { id: 'incident-response', label: 'Incident Response' },
  { id: 'vulnerability-disclosure', label: 'Vulnerability Disclosure' },
  { id: 'compliance', label: 'Compliance Alignment' },
];

export const SecurityPage = () => (
  <LegalLayout
    title="Security"
    description="How Docketra protects your data and maintains platform integrity."
    sections={SECTIONS}
  >
    <section id="security-overview">
      <h2 className="text-xl font-semibold text-slate-900">1. Security Overview</h2>
      <p className="mt-3 text-sm leading-relaxed">
        Security is a foundational principle of the Docketra platform. We apply defence-in-depth
        across every layer — from network transport and application logic to data storage and
        identity management. Our security posture is designed to meet the expectations of
        enterprise procurement teams and compliance reviewers.
      </p>
    </section>

    <section id="tenant-isolation">
      <h2 className="text-xl font-semibold text-slate-900">2. Multi-Tenant Isolation Model</h2>
      <p className="mt-3 text-sm leading-relaxed">
        Each tenant operates in a fully isolated logical environment. All data queries, API
        responses, and background operations are scoped to the authenticated tenant context.
        Cross-tenant data access is architecturally prevented through server-side enforcement —
        there is no mechanism by which one tenant can access another's data, even through
        manipulation of client-side requests.
      </p>
    </section>

    <section id="encryption">
      <h2 className="text-xl font-semibold text-slate-900">3. Encryption Standards</h2>
      <p className="mt-3 text-sm leading-relaxed">
        All data in transit is encrypted using TLS 1.2 or higher. Data at rest is encrypted using
        AES-256 or equivalent. Authentication tokens are signed using asymmetric cryptography with
        short expiry windows. Sensitive fields are individually encrypted within the data layer.
      </p>
    </section>

    <section id="access-control">
      <h2 className="text-xl font-semibold text-slate-900">4. Access Control &amp; RBAC</h2>
      <p className="mt-3 text-sm leading-relaxed">
        Docketra enforces role-based access control (RBAC) at every layer of the stack. Permissions
        are evaluated server-side on every request — there is no reliance on client-side gating.
        Roles are scoped per tenant and cannot be escalated without explicit administrative action.
        Superadmin operations are strictly separated from tenant-scoped operations.
      </p>
    </section>

    <section id="audit-logging">
      <h2 className="text-xl font-semibold text-slate-900">5. Audit Logging</h2>
      <p className="mt-3 text-sm leading-relaxed">
        All platform actions — including authentication events, data modifications, role changes,
        and file operations — are recorded in an immutable, timestamped audit log. Logs are
        scoped by tenant and retained in accordance with our data retention policy. Audit records
        are available to tenant administrators through the reporting interface.
      </p>
    </section>

    <section id="incident-response">
      <h2 className="text-xl font-semibold text-slate-900">6. Incident Response</h2>
      <p className="mt-3 text-sm leading-relaxed">
        We maintain an incident response plan aligned with industry best practices. In the event
        of a confirmed data breach, affected customers will be notified within the timeframes
        mandated by applicable law. We conduct post-incident reviews and implement remediation
        measures to prevent recurrence.
      </p>
    </section>

    <section id="vulnerability-disclosure">
      <h2 className="text-xl font-semibold text-slate-900">7. Vulnerability Disclosure</h2>
      <p className="mt-3 text-sm leading-relaxed">
        We welcome responsible disclosure of security vulnerabilities. If you discover a potential
        security issue in the Docketra platform, please report it directly to our security team
        at{' '}
        <a
          href="mailto:security@docketra.com"
          className="text-slate-800 underline hover:no-underline"
        >
          security@docketra.com
        </a>
        . Please do not disclose vulnerabilities publicly until we have had a reasonable opportunity
        to investigate and respond.
      </p>
    </section>

    <section id="compliance">
      <h2 className="text-xl font-semibold text-slate-900">8. Compliance Alignment</h2>
      <p className="mt-3 text-sm leading-relaxed">
        Our security and data handling practices are designed to align with the requirements of
        the Digital Personal Data Protection Act, 2023 (DPDP Act) and the general principles of
        the General Data Protection Regulation (GDPR). We continuously review our controls to
        remain aligned with evolving regulatory requirements in India and international markets.
      </p>
    </section>
  </LegalLayout>
);
