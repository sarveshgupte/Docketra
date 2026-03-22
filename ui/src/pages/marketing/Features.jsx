import React from 'react';
import { motion } from 'framer-motion';
import { Section } from '../../components/layout/Section';

const FEATURES = [
  {
    title: 'Centralized Firm Dashboard',
    description: 'Manage all your clients, cases, and team members from a single, secure platform. Say goodbye to scattered spreadsheets and isolated WhatsApp groups.',
  },
  {
    title: 'Granular Access Controls',
    description: 'Data privacy is built-in. Assign specific roles to partners, managers, and trainees so everyone only accesses the information they are authorized to see.',
  },
  {
    title: 'Standardized Workflows',
    description: 'Turn chaotic processes into predictable, step-by-step workflows. Set clear intake-to-resolution checkpoints with SLA-aware tracking and deadlines.',
  },
  {
    title: 'Automated Audit Trails',
    description: 'Never wonder "who approved this?" again. Every action, document upload, and status change is logged with an immutable timestamp and user ID.',
  },
  {
    title: 'Secure Document Storage',
    description: 'Keep client files attached directly to their specific cases. Ensure document hygiene with version control and secure retrieval.',
  },
  {
    title: 'Real-Time Operational Metrics',
    description: 'Partners get a bird\'s-eye view of firm performance. Identify bottlenecks, track overdue items, and monitor team workload instantly.',
  },
];

export const FeaturesPage = () => (
  <Section>
    <div className="mx-auto w-full max-w-3xl text-center">
      <h1 className="type-section text-gray-900">Platform Features</h1>
      <p className="mt-6 type-body text-lg text-gray-600">
        Everything you need to bring operational discipline to your firm. Built for compliance, audit, and tax teams who cannot afford to miss a deadline.
      </p>
    </div>
    <div className="mt-16 grid w-full gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map(({ title, description }, index) => (
        <motion.div
          key={title}
          className="flex h-full w-full flex-col rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-shadow duration-300 hover:shadow-lg"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: Math.min(index * 0.1, 0.4) }}
        >
          <div className="mb-6 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
            <span className="text-blue-600 font-bold text-xl">✓</span>
          </div>
          <h2 className="type-card-title text-gray-900 mb-3">{title}</h2>
          <p className="type-body text-gray-600 flex-1">{description}</p>
        </motion.div>
      ))}
    </div>
  </Section>
);
