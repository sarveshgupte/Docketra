import React from 'react';

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
  <section className="space-y-8">
    <div className="space-y-3">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Features</h1>
      <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
        Built for modern service organizations that need multi-tenant, role-scoped, and governance-ready operations without sacrificing usability.
      </p>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      {FEATURES.map(({ title, description }) => (
        <div key={title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
        </div>
      ))}
    </div>
  </section>
);
