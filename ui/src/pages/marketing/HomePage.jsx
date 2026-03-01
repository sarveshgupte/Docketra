import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Section } from '../../components/layout/Section';

const PROBLEM_POINTS = [
  'Deadlines tracked in spreadsheets',
  'Compliance items assigned on WhatsApp',
  'No ownership visibility across execution teams',
  'No audit trail for lifecycle actions',
  'Partners informed too late to intervene',
  'Staff exits causing institutional knowledge loss',
];

const SOLUTION_POINTS = [
  'Structured lifecycle stages with governance checkpoints',
  'Role-based permissions with restricted approvals',
  'Audit logging for every lifecycle transition',
  'Accountability visibility by responsible executive',
  'Risk monitoring for overdue and escalation-prone compliance items',
];

const SECTION_REVEAL = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
  viewport: { once: true, amount: 0.2 },
};

export const HomePage = () => (
  <div className="w-full">
    <Section>
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div className="text-left">
            <h1 className="type-hero">
              Prevent Compliance Delays Before They Happen.
            </h1>
            <p className="type-body text-lg max-w-[520px]">
              Docketra enforces structured, accountable workflows and gives partners real-time
              visibility into their firm&apos;s operations.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="mailto:demo@docketra.com"
                className="marketing-btn-primary px-6 py-3 text-sm font-medium"
              >
                Book a Demo
              </a>
              <Link
                to="/signup"
                className="marketing-btn-secondary px-6 py-3 text-sm font-medium"
              >
                Request Early Access
              </Link>
            </div>
          </div>

          <motion.div
            {...SECTION_REVEAL}
            className="marketing-card bg-gradient-to-br from-white to-gray-50 p-8"
          >
            <p className="text-sm font-semibold text-gray-700">Demo Firm: Agarwal &amp; Co. Chartered Accountants</p>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-500">Overdue Compliance Items</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-red-700">1</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-500">Awaiting Partner Review</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-amber-700">2</p>
              </div>
              <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-500">Case Lifecycle Snapshot</p>
                <ul className="mt-3 space-y-2 text-sm text-gray-700">
                  <li>GST Filing – March 2026 · Under Execution</li>
                  <li>ROC Annual Filing · Awaiting Partner Review</li>
                  <li>TDS Return Q4 · Executed</li>
                  <li>Internal Audit Assignment · Under Execution</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
    </Section>

    <Section muted>
        <h2 className="type-section">Why Professional Firms Lose Control</h2>
        <motion.div
          {...SECTION_REVEAL}
          className="grid gap-x-8 gap-y-6 md:grid-cols-2"
          style={{ marginTop: 'var(--space-md)' }}
        >
          {PROBLEM_POINTS.map((point, index) => (
            <motion.div
              key={point}
              className="marketing-card px-5 py-4 text-sm font-medium text-gray-700"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.2), ease: [0.4, 0, 0.2, 1] }}
              viewport={{ once: true, amount: 0.2 }}
            >
              {point}
            </motion.div>
          ))}
        </motion.div>
    </Section>

    <Section>
        <h2 className="type-section">Enforced Workflow. Not Just Task Tracking.</h2>
        <motion.div
          {...SECTION_REVEAL}
          className="grid gap-8 md:grid-cols-2"
          style={{ marginTop: 'var(--space-md)' }}
        >
          {SOLUTION_POINTS.map((point, index) => (
            <motion.div
              key={point}
              className="marketing-card p-8"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.2), ease: [0.4, 0, 0.2, 1] }}
              viewport={{ once: true, amount: 0.2 }}
            >
              <p className="type-body">{point}</p>
            </motion.div>
          ))}
        </motion.div>
    </Section>
  </div>
);
