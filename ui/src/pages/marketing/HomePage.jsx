import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Section } from '../../components/layout/Section';
import '../../assets/styles/marketing-tokens.css';

const PROBLEM_POINTS = [
  {
    icon: '📊',
    title: 'Spreadsheets Are Invisible Until Review Time',
    desc: 'Partners discover issues during final approval, not during execution when there is still time to fix them.',
  },
  {
    icon: '💬',
    title: 'WhatsApp Assignments Leave No Trail',
    desc: 'If regulators ask who approved something, teams often cannot provide a verifiable record.',
  },
  {
    icon: '🔍',
    title: 'No One Knows Who Owns What',
    desc: 'When deadlines slip, ownership and blockers are unclear across teams.',
  },
  {
    icon: '👥',
    title: 'Onboarding New Team Members Takes Weeks',
    desc: 'People restart work instead of continuing from documented progress.',
  },
  {
    icon: '⏰',
    title: 'Status Meetings Eat Up Everyone’s Time',
    desc: 'Partners have to chase updates manually instead of seeing one shared view.',
  },
  {
    icon: '🚨',
    title: 'Overdue Items Surface Too Late',
    desc: 'Missed deadlines are often discovered only after clients are already impacted.',
  },
];

const SOLUTION_POINTS = [
  {
    num: '1',
    title: 'Structured Lifecycle Stages',
    desc: 'Track work through explicit checkpoints with ownership and approvals at each stage.',
    icon: '📋',
  },
  {
    num: '2',
    title: 'Real-Time Team Visibility',
    desc: 'See who is responsible, what changed, and what needs attention right now.',
    icon: '👁️',
  },
  {
    num: '3',
    title: 'Audit Trails By Default',
    desc: 'Every action is logged with actor and timestamp for operational accountability.',
    icon: '✅',
  },
];

const AUDIENCE_SEGMENTS = [
  {
    title: 'Audit & Assurance',
    color: 'border-blue-500',
    points: ['Parallel testing workflows', 'Partner review stages', 'Engagement risk visibility', 'Quality gates'],
  },
  {
    title: 'Tax & Compliance',
    color: 'border-green-500',
    points: ['GST, TDS, ROC tracking', 'Multi-office coordination', 'Deadline reminders', 'Filing calendar visibility'],
  },
  {
    title: 'Consulting',
    color: 'border-purple-500',
    points: ['Project phase tracking', 'Deliverable approval chains', 'Client communication notes', 'Escalation workflows'],
  },
];

const FAQS = [
  {
    q: 'How quickly can we get set up?',
    a: 'Most teams can set up a workspace and first workflow in minutes.',
  },
  {
    q: 'Do you support GST, TDS, and ROC filing workflows?',
    a: 'Yes. Docketra is being built with templates for common compliance workflows used by Indian firms.',
  },
  {
    q: 'Can our clients see case status?',
    a: 'Client visibility is role-controlled so you can share only what each client needs to see.',
  },
  {
    q: 'Is there a mobile app?',
    a: 'The web app is mobile responsive. Native app support is on our roadmap.',
  },
  {
    q: 'How is data secured?',
    a: 'Data security controls include access restrictions, encryption, and audited activity logs.',
  },
];

const COMPARISON_ROWS = [
  ['Real-time visibility', '❌', '❌', '✅'],
  ['Audit trail / Compliance', '❌', '❌', '✅'],
  ['Role-based approval flows', '❌', '❌', '✅'],
  ['Automatic deadline alerts', '⚠️', '❌', '✅'],
  ['Partner visibility', '❌', '❌', '✅'],
  ['Multi-office support', '⚠️', '❌', '✅'],
];

const SECTION_REVEAL = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
  viewport: { once: true, amount: 0.2 },
};

const Accordion = ({ question, answer }) => {
  const [open, setOpen] = useState(false);

  const toggle = () => setOpen((prev) => !prev);

  return (
    <div className="marketing-card p-6">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-4 text-left"
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggle();
          }
        }}
        aria-expanded={open}
      >
        <h3 className="min-w-0 flex-1 text-base font-semibold text-gray-900">{question}</h3>
        <span className="flex-shrink-0 font-bold text-blue-600" aria-hidden="true">
          {open ? '−' : '+'}
        </span>
      </button>
      {open ? <p className="pt-4 text-sm text-gray-700">{answer}</p> : null}
    </div>
  );
};

export const HomePage = () => {
  useEffect(() => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Docketra',
      applicationCategory: 'BusinessApplication',
      description: 'Compliance task and case management system for professional firms',
      url: 'https://docketra.com',
      operatingSystem: 'Web',
      browserRequirements: 'Requires JavaScript',
      offers: {
        '@type': 'Offer',
        price: 'Contact for pricing',
        priceCurrency: 'INR',
        url: 'https://docketra.com/pricing',
      },
      author: {
        '@type': 'Organization',
        name: 'GUPTE ENTERPRISES (OPC) PRIVATE LIMITED',
        url: 'https://docketra.com',
      },
      datePublished: '2026-01-01',
      inLanguage: 'en-IN',
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'homepage-structured-data';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      document.getElementById('homepage-structured-data')?.remove();
    };
  }, []);

  const onEarlyAccessSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') || '').trim();
    if (!email) return;
    window.location.href = `mailto:hello@docketra.com?subject=Early%20Access%20Request&body=${encodeURIComponent(
      `Please add me to Docketra early access. Email: ${email}`,
    )}`;
    event.currentTarget.reset();
  };

  return (
    <div className="w-full">
      <Section>
        <div className="grid w-full items-stretch gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="w-full text-left">
            <h1 className="type-hero">
              Compliance Workflows That Actually Stick.
              <br />
              <span className="text-blue-600">No More Spreadsheets. No More Guessing.</span>
            </h1>
            <p className="type-body type-lg w-full max-w-[560px]">
              Docketra gives teams real-time visibility into deadlines, assignments, and ownership—with audit trails
              built in. Made for accounting, audit, and tax teams who need to stay in control.
            </p>
            <div className="mt-8 flex flex-wrap gap-4 pb-2">
              <Link to="/signup" className="marketing-btn-primary px-8 py-3 text-sm font-semibold">
                Request Early Access
              </Link>
              <a href="mailto:hello@docketra.com" className="marketing-btn-secondary px-8 py-3 text-sm font-semibold">
                Contact Team
              </a>
            </div>
            <span className="text-xs text-gray-500">Pre-launch • Early access signups are open</span>
          </div>

          <motion.div
            {...SECTION_REVEAL}
            className="marketing-card w-full border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-8"
          >
            <div className="space-y-4">
              <div className="border-b border-blue-100 pb-4">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Launching Soon</p>
                <h3 className="mt-2 text-lg font-semibold text-gray-900">Be Among the First to Try Docketra</h3>
                <p className="mt-2 text-sm text-gray-600">
                  We are building Docketra with early users. Your feedback directly shapes the product roadmap.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    title: 'Real-Time Compliance Tracking',
                    desc: 'See deadlines, assignments, and ownership in one place.',
                  },
                  {
                    title: 'Audit Trails for Every Action',
                    desc: 'Know who did what and when with event-level history.',
                  },
                  {
                    title: 'Role-Based Workflows',
                    desc: 'Approvals, assignments, and permissions built into daily flow.',
                  },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3">
                    <span className="mt-0.5 text-green-600">✓</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-600">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </Section>

      <Section muted>
        <h2 className="type-section">Why Teams Lose Control</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {PROBLEM_POINTS.map((point, index) => (
            <motion.div
              key={point.title}
              className="marketing-card space-y-2 p-5 transition-shadow hover:shadow-md"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              viewport={{ once: true, amount: 0.2 }}
            >
              <p className="text-2xl" aria-hidden="true">
                {point.icon}
              </p>
              <h3 className="text-sm font-semibold text-gray-900">{point.title}</h3>
              <p className="text-xs text-gray-600">{point.desc}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="mb-12">
          <h2 className="type-section">How Docketra Works</h2>
          <p className="type-body type-lg w-full text-gray-600">
            Built for compliance-heavy teams that need operational discipline and clear ownership.
          </p>
        </div>

        <div className="grid w-full gap-12 md:grid-cols-3">
          {SOLUTION_POINTS.map((item) => (
            <motion.div key={item.num} className="marketing-card p-8" {...SECTION_REVEAL}>
              <div className="flex items-start gap-4">
                <div className="text-4xl" aria-hidden="true">
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="mb-2 font-bold text-gray-900">{item.title}</h3>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </Section>

      <Section muted>
        <div className="mb-12">
          <h2 className="type-section">Built For Your Workflow</h2>
          <p className="type-body type-lg w-full text-gray-600">
            Whether you run audits, manage compliance, or deliver consulting projects, Docketra supports your process.
          </p>
        </div>

        <div className="grid gap-12 md:grid-cols-3">
          {AUDIENCE_SEGMENTS.map((segment) => (
            <motion.div
              key={segment.title}
              className={`marketing-card border-t-4 p-6 transition-shadow hover:shadow-lg ${segment.color}`}
              {...SECTION_REVEAL}
            >
              <h3 className="mb-4 text-lg font-bold text-gray-900">{segment.title}</h3>
              <ul className="space-y-3">
                {segment.points.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="font-bold text-green-600" aria-hidden="true">
                      ✓
                    </span>
                    <span className="text-sm text-gray-700">{point}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </Section>

      <Section muted>
        <div className="space-y-12 text-left">
          <span className="text-sm font-bold tracking-wider text-blue-600 uppercase">Pre-Launch Access</span>
          <h2 className="type-section text-gray-900">Join the Docketra Early Access Program</h2>
          <p className="type-body text-lg text-gray-600">
            We are building the future of compliance workflows. Join our exclusive early access group to secure your free workspace and directly influence our product roadmap.
          </p>

          <form
            className="mt-12 flex w-full max-w-2xl flex-col gap-3 sm:flex-row sm:items-stretch"
            onSubmit={onEarlyAccessSubmit}
            aria-label="Early access signup"
          >
            <input
              id="early-access-email"
              name="email"
              type="email"
              placeholder="Enter your work email"
              className="w-full min-w-0 flex-1 rounded-xl border border-gray-300 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-600"
              required
              aria-required="true"
            />
            <button
              type="submit"
              className="marketing-btn-primary w-full shrink-0 rounded-xl px-6 py-3 font-semibold whitespace-nowrap shadow-sm sm:w-auto"
              aria-label="Request Early Access"
            >
              Request Access
            </button>
          </form>
          <p className="text-xs text-gray-500">No spam. We'll only contact you regarding your workspace setup.</p>
        </div>
      </Section>

      <Section muted>
        <div className="mb-12">
          <h2 className="type-section">Why Choose Docketra Over Spreadsheets &amp; WhatsApp?</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="px-4 py-4 text-left font-semibold">Feature</th>
                <th className="px-4 py-4 text-center font-semibold">Spreadsheets</th>
                <th className="px-4 py-4 text-center font-semibold">WhatsApp</th>
                <th className="px-4 py-4 text-center font-semibold text-blue-600">Docketra</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, idx) => (
                <tr key={row[0]} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 font-medium">{row[0]}</td>
                  <td className="px-4 py-3 text-center">{row[1]}</td>
                  <td className="px-4 py-3 text-center">{row[2]}</td>
                  <td className="px-4 py-3 text-center font-semibold text-blue-600">{row[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section>
        <div className="mb-12">
          <h2 className="type-section">Questions Answered</h2>
        </div>

        <div className="w-full space-y-4">
          {FAQS.map((item) => (
            <Accordion key={item.q} question={item.q} answer={item.a} />
          ))}
        </div>
      </Section>
    </div>
  );
};
