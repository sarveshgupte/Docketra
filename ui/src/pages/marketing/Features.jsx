import React from 'react';
import { Section } from '../../components/layout/Section';

const FEATURES = [
  {
    title: 'Multi-Tenant Foundation',
    description:
      'Docketra is architected as a multi-tenant platform, keeping each organization isolated while allowing centralized operations at scale.',
  },
  {
    title: 'Role-Scoped Access Control',
    description:
      'Permissions are role-scoped by default so admins, managers, and contributors only see and act on what their responsibilities allow.',
  },
  {
    title: 'Governance-Ready Workflows',
    description:
      'Every workflow is governance-ready with auditable actions, traceable status transitions, and policy-aligned operational controls.',
  },
  {
    title: 'Case Workflow Management',
    description:
      'Standardize intake-to-resolution processes with predictable handoffs, SLA-aware queues, and clear ownership across teams.',
  },
  {
    title: 'Secure Document Operations',
    description:
      'Handle upload, storage, and retrieval in a controlled lifecycle that supports accountability and enterprise-grade document hygiene.',
  },
  {
    title: 'Audit & Reliability Controls',
    description:
      'Operational visibility is built in through immutable activity logs, resilient background processing, and monitoring-ready system signals.',
  },
];

export const FeaturesPage = () => (
  <Section>
    <div>
      <h1 className="type-section">Features</h1>
      <p className="mt-6 max-w-3xl type-body">
        Built for modern service organizations that need multi-tenant, role-scoped, and
        governance-ready operations without sacrificing usability.
      </p>
    </div>
    <div className="mt-8 grid gap-12 sm:grid-cols-2">
      {FEATURES.map(({ title, description }) => (
        <div key={title} className="rounded-2xl border border-gray-200 bg-white p-8 shadow-md hover:shadow-xl transition-shadow duration-300">
          <h2 className="type-card-title">{title}</h2>
          <p className="mt-6 type-body">{description}</p>
        </div>
      ))}
    </div>
  </Section>
);
