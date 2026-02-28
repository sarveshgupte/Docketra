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

export const HomePage = () => (
  <div className="w-full">
    <Section>
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="type-hero">
              Prevent Compliance Delays Before They Happen.
            </h1>
            <p className="mt-6 text-lg type-body max-w-xl">
              Docketra enforces structured, accountable workflows and gives partners real-time
              visibility into their firm&apos;s operations.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="mailto:demo@docketra.com"
                className="rounded-xl bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-all duration-150 hover:scale-[1.01] hover:-translate-y-0.5 hover:bg-black active:scale-[0.98]"
              >
                Book a Demo
              </a>
              <Link
                to="/signup"
                className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-800 transition-all duration-150 hover:scale-[1.01] hover:-translate-y-0.5 hover:bg-gray-50 active:scale-[0.98]"
              >
                Request Early Access
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-100 p-8 shadow-md hover:shadow-xl transition-shadow duration-300">
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
          </div>
        </div>
    </Section>

    <Section muted>
        <h2 className="type-section">Why Professional Firms Lose Control</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {PROBLEM_POINTS.map((point, index) => (
            <motion.div
              key={point}
              className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-md hover:shadow-xl transition-shadow duration-300"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.2) }}
            >
              {point}
            </motion.div>
          ))}
        </div>
    </Section>

    <Section>
        <h2 className="type-section">Enforced Workflow. Not Just Task Tracking.</h2>
        <div className="mt-8 grid gap-12 md:grid-cols-2">
          {SOLUTION_POINTS.map((point, index) => (
            <motion.div
              key={point}
              className="rounded-2xl shadow-md hover:shadow-xl transition-shadow duration-300 border border-gray-200 bg-white p-8"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.2) }}
            >
              <p className="type-body">{point}</p>
            </motion.div>
          ))}
        </div>
    </Section>
  </div>
);
