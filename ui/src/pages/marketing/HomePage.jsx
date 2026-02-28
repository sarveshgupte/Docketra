import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Section } from '../../components/layout/Section';

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
    <Section>
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="type-hero">
              Enterprise-Ready Work &amp; Case Management
            </h1>
            <p className="mt-6 text-lg type-body max-w-xl">
              Structured workflows, role-based governance, and secure document-backed case
              management.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/signup"
                className="rounded-xl bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-all duration-150 hover:scale-[1.01] hover:-translate-y-0.5 hover:bg-black active:scale-[0.98]"
              >
                Create Free Workspace
              </Link>
              <a
                href="mailto:demo@docketra.com"
                className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-800 transition-all duration-150 hover:scale-[1.01] hover:-translate-y-0.5 hover:bg-gray-50 active:scale-[0.98]"
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
    </Section>

    <Section muted>
        <h2 className="type-section">Who It&apos;s For</h2>
        <div className="mt-8 flex flex-wrap gap-4">
          {WHO_ITS_FOR.map(({ label, icon }, index) => (
            <motion.div
              key={label}
              className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-md hover:shadow-xl transition-shadow duration-300"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.2) }}
            >
              <span className="mr-2" aria-hidden="true">{icon}</span>
              {label}
            </motion.div>
          ))}
        </div>
    </Section>

    <Section>
        <h2 className="type-section">Core Features</h2>
        <div className="mt-8 grid gap-12 md:grid-cols-2 lg:grid-cols-3">
          {CORE_FEATURES.map(({ title, description }, index) => (
            <motion.div
              key={title}
              className="rounded-2xl shadow-md hover:shadow-xl transition-shadow duration-300 border border-gray-200 bg-white p-8"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.2) }}
            >
              <h3 className="type-card-title">{title}</h3>
              <p className="mt-6 type-body">{description}</p>
            </motion.div>
          ))}
        </div>
    </Section>

    <Section muted>
        <h2 className="type-section">Security &amp; Governance</h2>
        <p className="mt-6 type-body max-w-xl">
          Built for teams that operate under strict compliance and accountability requirements.
        </p>
        <div className="mt-8 grid gap-12 md:grid-cols-2">
          {GOVERNANCE_HIGHLIGHTS.map(({ title, description }, index) => (
            <motion.div
              key={title}
              className="rounded-2xl shadow-md hover:shadow-xl transition-shadow duration-300 border border-gray-200 bg-white p-8"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.2) }}
            >
              <h3 className="type-card-title">{title}</h3>
              <p className="mt-6 type-body">{description}</p>
            </motion.div>
          ))}
        </div>
    </Section>
  </div>
);
