import React from 'react';
import { LegalLayout } from '../../components/legal/LegalLayout';

const SECTIONS = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'nature-of-service', label: 'Nature of Service' },
  { id: 'account-eligibility', label: 'Account & Eligibility' },
  { id: 'tenant-isolation', label: 'Tenant Isolation' },
  { id: 'data-ownership', label: 'Data Ownership' },
  { id: 'security-measures', label: 'Security Measures' },
  { id: 'subscription-billing', label: 'Subscription & Billing' },
  { id: 'acceptable-use', label: 'Acceptable Use' },
  { id: 'termination', label: 'Termination' },
  { id: 'limitation-of-liability', label: 'Limitation of Liability' },
  { id: 'governing-law', label: 'Governing Law' },
];

export const TermsPage = () => (
  <LegalLayout
    title="Terms &amp; Conditions"
    description="Enterprise SaaS Terms of Service for Docketra."
    sections={SECTIONS}
  >
    <section id="introduction">
      <h2 className="text-xl font-semibold text-slate-900">1. Introduction</h2>
      <p className="mt-3 text-sm leading-relaxed">
        These Terms and Conditions ("Terms") govern your access to and use of Docketra, a
        multi-tenant B2B SaaS platform operated by GUPTE ENTERPRISES (OPC) PRIVATE LIMITED
        ("Company", "we", "us", or "our"). By accessing or using Docketra, you agree to be bound
        by these Terms. If you do not agree, you must not use the platform.
      </p>
    </section>

    <section id="nature-of-service">
      <h2 className="text-xl font-semibold text-slate-900">2. Nature of Service</h2>
      <p className="mt-3 text-sm leading-relaxed">
        Docketra is a B2B Software-as-a-Service (SaaS) platform built on a multi-tenant
        architecture. It provides structured workflow management, case tracking, role-based access
        control, and secure document handling for service-oriented organizations. Each subscribing
        organization ("Tenant") operates within a fully isolated environment with dedicated data
        boundaries.
      </p>
    </section>

    <section id="account-eligibility">
      <h2 className="text-xl font-semibold text-slate-900">3. Account &amp; Eligibility</h2>
      <p className="mt-3 text-sm leading-relaxed">
        You must be at least 18 years of age and represent a duly authorized legal entity to create
        an account. You are responsible for maintaining the confidentiality of your credentials and
        for all activities that occur under your account. You must notify us immediately of any
        unauthorized use.
      </p>
    </section>

    <section id="tenant-isolation">
      <h2 className="text-xl font-semibold text-slate-900">4. Tenant Isolation &amp; Architecture</h2>
      <p className="mt-3 text-sm leading-relaxed">
        Docketra enforces strict tenant isolation at every layer of the stack. Tenants cannot
        access, view, or interfere with another tenant's data, workflows, or configurations.
        All data queries are scoped to the authenticated tenant context and validated server-side
        on every request.
      </p>
    </section>

    <section id="data-ownership">
      <h2 className="text-xl font-semibold text-slate-900">5. Data Ownership</h2>
      <p className="mt-3 text-sm leading-relaxed">
        You retain full ownership of all data you input into Docketra. We do not sell, license, or
        share your data with third parties except as required to deliver the service or comply with
        applicable law. Upon termination, your data is available for export for a period specified
        in your subscription agreement.
      </p>
    </section>

    <section id="security-measures">
      <h2 className="text-xl font-semibold text-slate-900">6. Security Measures</h2>
      <p className="mt-3 text-sm leading-relaxed">
        We implement industry-standard security controls including encrypted data transmission
        (TLS), encrypted storage, role-based access control, audit logging, and regular security
        reviews. Details are available on our{' '}
        <a href="/security" className="text-slate-800 underline hover:no-underline">
          Security page
        </a>
        .
      </p>
    </section>

    <section id="subscription-billing">
      <h2 className="text-xl font-semibold text-slate-900">7. Subscription &amp; Billing</h2>
      <p className="mt-3 text-sm leading-relaxed">
        Access to Docketra is provided on a subscription basis. Pricing and billing terms are
        agreed upon at the time of onboarding. Subscriptions auto-renew unless cancelled in
        accordance with the agreed notice period. All fees are non-refundable except as required
        by applicable law.
      </p>
    </section>

    <section id="acceptable-use">
      <h2 className="text-xl font-semibold text-slate-900">8. Acceptable Use</h2>
      <p className="mt-3 text-sm leading-relaxed">
        You agree not to use Docketra to transmit unlawful content, attempt to circumvent
        authentication or access controls, reverse-engineer the platform, or engage in activities
        that disrupt service availability. Violations may result in immediate account suspension.
      </p>
    </section>

    <section id="termination">
      <h2 className="text-xl font-semibold text-slate-900">9. Termination</h2>
      <p className="mt-3 text-sm leading-relaxed">
        Either party may terminate the subscription upon the agreed notice period. We reserve the
        right to suspend or terminate accounts that violate these Terms without prior notice. Upon
        termination, your access to the platform is revoked and your data is handled in accordance
        with our data retention policy.
      </p>
    </section>

    <section id="limitation-of-liability">
      <h2 className="text-xl font-semibold text-slate-900">10. Limitation of Liability</h2>
      <p className="mt-3 text-sm leading-relaxed">
        To the maximum extent permitted by applicable law, the Company shall not be liable for
        indirect, incidental, special, consequential, or punitive damages arising from your use of
        the platform. Our total cumulative liability shall not exceed the fees paid by you in the
        three months preceding the claim.
      </p>
    </section>

    <section id="governing-law">
      <h2 className="text-xl font-semibold text-slate-900">11. Governing Law</h2>
      <p className="mt-3 text-sm leading-relaxed">
        These Terms are governed by the laws of India. Any disputes shall be subject to the
        exclusive jurisdiction of the courts of Mumbai, Maharashtra, India.
      </p>
    </section>
  </LegalLayout>
);
