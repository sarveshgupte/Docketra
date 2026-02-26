import React from 'react';
import { Link } from 'react-router-dom';

const WHO_ITS_FOR = [
  { label: 'Law Firms', icon: '⚖️' },
  { label: 'Consulting Firms', icon: '📊' },
  { label: 'Accounting Teams', icon: '🧾' },
  { label: 'HR & Recruitment', icon: '👥' },
  { label: 'Operations Teams', icon: '⚙️' },
];

const CORE_FEATURES = [
  {
    title: 'Multi-Tenant Architecture',
    description:
      'Each organization operates in a fully isolated environment with dedicated data boundaries.',
  },
  {
    title: 'Role-Based Access Control',
    description:
      'Granular permissions enforced at every layer — from UI to API to data queries.',
  },
  {
    title: 'Case Workflow Management',
    description:
      'Structured, auditable workflows that guide cases from intake through resolution.',
  },
  {
    title: 'Secure Document Integration',
    description:
      'Document uploads, versioning, and retrieval with full lifecycle integrity tracking.',
  },
  {
    title: 'Reliability & Queue Handling',
    description:
      'Resilient background processing with retry logic, dead-letter queues, and monitoring.',
  },
  {
    title: 'Audit Logging',
    description:
      'Immutable, timestamped records of every system action for compliance and accountability.',
  },
];

const GOVERNANCE_HIGHLIGHTS = [
  {
    title: 'Organization-Level Isolation',
    description:
      "Tenants cannot access or interfere with each other's data, settings, or workflows.",
  },
  {
    title: 'Strict Access Enforcement',
    description:
      'Permissions are validated server-side on every request — no client-side bypass possible.',
  },
  {
    title: 'Activity Logging',
    description:
      'Every login, action, and data change is recorded with user identity and timestamp.',
  },
  {
    title: 'File Lifecycle Integrity',
    description:
      'Documents are tracked through upload, access, update, and deletion with full traceability.',
  },
];

export const HomePage = () => (
  <div className="bg-white text-slate-900">
    {/* Hero Section */}
    <section className="border-b border-slate-200 py-20 text-center">
      <h1 className="mx-auto max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-5xl">
        Enterprise-Ready Work &amp; Case Management
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
        Structured workflows, role-based governance, and secure document-backed case management.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link
          to="/login"
          className="rounded-md bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-700"
        >
          Start Free Trial
        </Link>
        <a
          href="mailto:demo@docketra.com"
          className="rounded-md border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Request Demo
        </a>
      </div>
    </section>

    {/* Who It's For Section */}
    <section className="bg-slate-50 py-16">
      <div className="mx-auto max-w-5xl px-4">
        <h2 className="mb-10 text-center text-2xl font-semibold text-slate-800">
          Who It&apos;s For
        </h2>
        <div className="flex flex-wrap justify-center gap-4">
          {WHO_ITS_FOR.map(({ label, icon }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm"
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Core Features Grid */}
    <section className="border-t border-slate-200 py-16">
      <div className="mx-auto max-w-5xl px-4">
        <h2 className="mb-10 text-center text-2xl font-semibold text-slate-800">
          Core Features
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CORE_FEATURES.map(({ title, description }) => (
            <div
              key={title}
              className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h3 className="mb-2 text-base font-semibold text-slate-800">{title}</h3>
              <p className="text-sm leading-relaxed text-slate-600">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Security & Governance Section */}
    <section className="border-t border-slate-200 bg-slate-50 py-16">
      <div className="mx-auto max-w-5xl px-4">
        <h2 className="mb-3 text-center text-2xl font-semibold text-slate-800">
          Security &amp; Governance
        </h2>
        <p className="mb-10 text-center text-sm text-slate-500">
          Built for teams that operate under strict compliance and accountability requirements.
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          {GOVERNANCE_HIGHLIGHTS.map(({ title, description }) => (
            <div key={title} className="flex gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mt-0.5 flex-shrink-0 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 1a9 9 0 100 18A9 9 0 0010 1zm3.707 6.293a1 1 0 00-1.414 0L9 11.586 7.707 10.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4a1 1 0 000-1.414z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="mb-1 text-sm font-semibold text-slate-800">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Final CTA Section */}
    <section className="border-t border-slate-200 py-16 text-center">
      <div className="mx-auto max-w-xl px-4">
        <h2 className="text-2xl font-semibold text-slate-800">
          Ready to streamline your operations?
        </h2>
        <p className="mt-3 text-sm text-slate-500">
          Get started with a free trial or speak with our team to see how Docketra fits your workflow.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-4">
          <Link
            to="/login"
            className="rounded-md bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-700"
          >
            Start Free Trial
          </Link>
          <a
            href="mailto:demo@docketra.com"
            className="rounded-md border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Request Demo
          </a>
        </div>
      </div>
    </section>
  </div>
);
