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
  <div className="w-full">
    <section className="w-full py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-5xl font-semibold tracking-tight leading-tight">
              Enterprise-Ready Work &amp; Case Management
            </h1>
            <p className="mt-6 text-lg text-gray-600 leading-relaxed max-w-xl">
              Structured workflows, role-based governance, and secure document-backed case
              management.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/signup"
                className="rounded-xl bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-all duration-200 hover:scale-[1.02] hover:bg-black active:scale-[0.98]"
              >
                Create Free Workspace
              </Link>
              <a
                href="mailto:demo@docketra.com"
                className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-800 transition-all duration-200 hover:scale-[1.02] hover:bg-gray-50 active:scale-[0.98]"
              >
                Request Demo
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-100 p-8 shadow-md hover:shadow-xl transition-shadow duration-300">
            <p className="text-sm font-semibold text-gray-700">Platform Preview</p>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-500">Open Cases</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">124</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-500">SLA Compliance</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">98.6%</p>
              </div>
              <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-500">Live Workstreams</p>
                <div className="mt-3 space-y-2">
                  <div className="h-2 rounded bg-gray-200">
                    <div className="h-2 w-4/5 rounded bg-gray-900" />
                  </div>
                  <div className="h-2 rounded bg-gray-200">
                    <div className="h-2 w-2/3 rounded bg-gray-700" />
                  </div>
                  <div className="h-2 rounded bg-gray-200">
                    <div className="h-2 w-1/2 rounded bg-gray-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className="w-full py-24 px-6 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-semibold tracking-tight leading-tight">Who It&apos;s For</h2>
        <div className="mt-8 flex flex-wrap gap-4">
          {WHO_ITS_FOR.map(({ label, icon }) => (
            <div
              key={label}
              className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-md hover:shadow-xl transition-shadow duration-300"
            >
              <span className="mr-2" aria-hidden="true">{icon}</span>
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="w-full py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-semibold tracking-tight leading-tight">Core Features</h2>
        <div className="mt-8 grid gap-12 md:grid-cols-2 lg:grid-cols-3">
          {CORE_FEATURES.map(({ title, description }) => (
            <div
              key={title}
              className="rounded-2xl shadow-md hover:shadow-xl transition-shadow duration-300 border border-gray-200 bg-white p-8"
            >
              <h3 className="text-lg font-semibold tracking-tight leading-tight">{title}</h3>
              <p className="mt-6 text-gray-600 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="w-full py-24 px-6 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-semibold tracking-tight leading-tight">Security &amp; Governance</h2>
        <p className="mt-6 text-gray-600 leading-relaxed max-w-xl">
          Built for teams that operate under strict compliance and accountability requirements.
        </p>
        <div className="mt-8 grid gap-12 md:grid-cols-2">
          {GOVERNANCE_HIGHLIGHTS.map(({ title, description }) => (
            <div
              key={title}
              className="rounded-2xl shadow-md hover:shadow-xl transition-shadow duration-300 border border-gray-200 bg-white p-8"
            >
              <h3 className="text-lg font-semibold tracking-tight leading-tight">{title}</h3>
              <p className="mt-6 text-gray-600 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  </div>
);
