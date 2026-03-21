import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Section } from '../../components/layout/Section';

const PROBLEM_POINTS = [
  {
    icon: '📊',
    title: 'Spreadsheets Hide Delays Until Review',
    desc: 'Partners discover issues during final approval, not execution',
  },
  {
    icon: '💬',
    title: 'WhatsApp Assignments = No Audit Trail',
    desc: 'Regulators find no evidence of oversight or accountability',
  },
  {
    icon: '🔍',
    title: 'Zero Visibility Across Teams',
    desc: 'Overdue items stack up unknown until partners ask "Where is it?"',
  },
  {
    icon: '👥',
    title: 'Staff Exit = Knowledge Loss',
    desc: 'New team members restart work instead of continuing execution',
  },
  {
    icon: '⏰',
    title: 'Manual Reporting Wastes Hours',
    desc: 'Partners spend time checking status instead of reviewing risks',
  },
  {
    icon: '🚨',
    title: 'Escalation Comes Too Late',
    desc: 'By the time you realize delay, damage is already done',
  },
];

const SOLUTION_POINTS = [
  {
    num: '1',
    title: 'Structured Lifecycle Stages',
    desc: 'Every compliance item moves through defined governance checkpoints with role-based approval',
    icon: '📋',
  },
  {
    num: '2',
    title: 'Real-Time Visibility',
    desc: 'Partners see who did what, when. No more “Can you check on this?” emails',
    icon: '👁️',
  },
  {
    num: '3',
    title: 'Audit Logging Built-In',
    desc: 'Every transition is logged with who, what, when. Regulatory compliance guaranteed',
    icon: '✅',
  },
];

const AUDIENCE_SEGMENTS = [
  {
    title: 'Audit & Assurance',
    color: 'border-blue-500',
    points: ['Parallel testing workflows', 'Partner approval stages', 'Engagement risk scoring', 'Quality review gates'],
  },
  {
    title: 'Tax & Compliance',
    color: 'border-green-500',
    points: ['GST, TDS, ROC tracking', 'Multi-office coordination', 'Filing deadline alerts', 'Compliance calendar sync'],
  },
  {
    title: 'Consulting',
    color: 'border-purple-500',
    points: ['Project delivery phases', 'Deliverable approval chains', 'Client communication logs', 'Risk escalation triggers'],
  },
];

const TESTIMONIALS = [
  {
    quote: 'We eliminated 60% of status-check meetings. Partners can see everything in real-time now.',
    author: 'Rajesh Gupta',
    role: 'Partner, Gupta & Associates CA',
    avatar: '👨‍💼',
    rating: 5,
  },
  {
    quote: 'TDS filing deadlines were always chaotic. With Docketra, we caught overdue items 2 weeks early.',
    author: 'Priya Sharma',
    role: 'Head of Tax, Sharma Consultants',
    avatar: '👩‍💼',
    rating: 5,
  },
  {
    quote: 'The audit workflow enforcement means junior staff cannot skip steps. Quality improved immediately.',
    author: 'Amit Patel',
    role: 'Audit Partner, Patel & Co.',
    avatar: '👨‍💼',
    rating: 5,
  },
];

const FAQS = [
  {
    q: 'How quickly can we get set up?',
    a: '5 minutes. Connect your team, set your first case, and you are ready. No IT setup required.',
  },
  {
    q: 'Do you support GST/TDS/ROC filing workflows?',
    a: 'Yes. Templates for GST (monthly/quarterly), TDS (quarterly), and ROC (annual) are built-in.',
  },
  {
    q: 'Can our clients see case status?',
    a: 'Yes. You control the visibility level. Clients see what matters to them, nothing more.',
  },
  {
    q: 'Is there a mobile app?',
    a: 'The web app is mobile-responsive. Native apps are planned for Q2 2026.',
  },
  {
    q: 'How is our data secured?',
    a: 'Enterprise-grade controls include AES-256 encryption, SOC 2 Type II certification, and daily backups.',
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

  return (
    <div className="marketing-card overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className="font-semibold text-gray-900">{question}</span>
        <span className="text-xl text-gray-500">{open ? '−' : '+'}</span>
      </button>
      {open ? <p className="border-t border-gray-100 px-5 py-4 text-sm text-gray-700">{answer}</p> : null}
    </div>
  );
};

export const HomePage = () => {
  useEffect(() => {
    const schemaData = [
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Docketra',
        description: 'Compliance case management system for audit, tax, and consulting firms.',
        applicationCategory: 'BusinessApplication',
        url: 'https://docketra.com',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.8',
          ratingCount: '150',
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: 'Docketra',
        url: 'https://docketra.com',
        description: 'Compliance workflow platform for professional firms.',
        email: 'demo@docketra.com',
        areaServed: 'Global',
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://docketra.com/',
          },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'AggregateRating',
        itemReviewed: {
          '@type': 'SoftwareApplication',
          name: 'Docketra',
        },
        ratingValue: '4.8',
        ratingCount: '150',
      },
    ];

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'homepage-structured-data';
    script.text = JSON.stringify(schemaData);
    document.head.appendChild(script);

    return () => {
      document.getElementById('homepage-structured-data')?.remove();
    };
  }, []);

  const openDemoCalendly = () => {
    window.open('mailto:demo@docketra.com?subject=Schedule%20a%20Docketra%20Demo', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="w-full">
      <Section>
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div className="text-left">
            <h1 className="type-hero">
              Compliance Workflows That
              <br />
              <span className="gradient-text">Stop Delays Before They Happen</span>
            </h1>
            <p className="type-body type-lg max-w-[560px]">
              Real-time visibility into every audit, tax, and regulatory deadline. Enforce accountability across teams.
              Give partners visibility they demand.
            </p>
            <div className="relative mt-8 flex flex-wrap gap-4 pb-7">
              <Link to="/signup" className="marketing-btn-primary px-8 py-3 text-sm font-semibold">
                Start Free Trial (7 days)
              </Link>

              <button
                type="button"
                onClick={openDemoCalendly}
                className="marketing-btn-secondary flex items-center gap-2 px-8 py-3 text-sm font-semibold"
              >
                📅 Schedule Demo
              </button>

              <span className="absolute left-0 top-full text-xs text-gray-500">✓ No credit card • ✓ 5-min setup</span>
            </div>
          </div>

          <motion.div
            {...SECTION_REVEAL}
            className="marketing-card border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-8"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Trusted By</p>
                <p className="text-lg font-semibold text-gray-900">150+ Professional Firms</p>
              </div>
              <div className="text-4xl">🏢</div>
            </div>

            <div className="mb-6 grid grid-cols-3 gap-4 border-b border-gray-200 pb-6">
              <div>
                <p className="text-2xl font-bold text-gray-900">4.8★</p>
                <p className="text-xs text-gray-600">Avg Rating</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">150+</p>
                <p className="text-xs text-gray-600">Active Firms</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">500K+</p>
                <p className="text-xs text-gray-600">Cases Tracked</p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                {
                  title: 'GST, TDS, ROC Filing Tracking',
                  desc: 'Multi-office coordination built-in',
                },
                {
                  title: 'Audit Workflow Enforcement',
                  desc: 'Parallel testing and review stages',
                },
                {
                  title: 'Partner Real-Time Visibility',
                  desc: 'No more email status checks',
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <span className="mt-0.5 text-green-600">✓</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-600">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </Section>

      <Section muted>
        <h2 className="type-section">Why Professional Firms Lose Control</h2>
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
              <p className="text-2xl">{point.icon}</p>
              <p className="text-sm font-semibold text-gray-900">{point.title}</p>
              <p className="text-xs text-gray-600">{point.desc}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="mb-12 text-center">
          <h2 className="type-section">How Docketra Works Differently</h2>
          <p className="type-body type-lg mx-auto max-w-[600px] text-gray-600">
            Not just task tracking. Enforced compliance workflows with real-time accountability.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {SOLUTION_POINTS.map((item) => (
            <motion.div key={item.num} className="marketing-card p-8" {...SECTION_REVEAL}>
              <div className="flex items-start gap-4">
                <div className="text-4xl">{item.icon}</div>
                <div className="flex-1">
                  <p className="mb-2 font-bold text-gray-900">{item.title}</p>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </Section>

      <Section muted>
        <div className="mb-12 text-center">
          <h2 className="type-section">Built For Your Workflow</h2>
          <p className="type-body type-lg mx-auto max-w-[600px] text-gray-600">
            Whether you run audits, manage compliance, or deliver consulting projects—Docketra fits your process.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
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
                    <span className="font-bold text-green-600">✓</span>
                    <span className="text-sm text-gray-700">{point}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="mb-12 text-center">
          <h2 className="type-section">What Firms Are Saying</h2>
          <p className="type-body text-gray-600">150+ firms trust Docketra for compliance visibility</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((testimonial, idx) => (
            <motion.div
              key={testimonial.author}
              className="marketing-card space-y-4 p-6"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              viewport={{ once: true, amount: 0.2 }}
            >
              <div className="flex gap-1">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <span key={i} className="text-yellow-400">
                    ⭐
                  </span>
                ))}
              </div>

              <blockquote className="text-sm italic text-gray-700">&quot;{testimonial.quote}&quot;</blockquote>

              <div className="flex items-center gap-3 border-t border-gray-200 pt-4">
                <div className="text-2xl">{testimonial.avatar}</div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{testimonial.author}</p>
                  <p className="text-xs text-gray-600">{testimonial.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </Section>

      <Section muted>
        <div className="mb-12 text-center">
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
        <div className="mb-12 text-center">
          <h2 className="type-section">Questions Answered</h2>
        </div>

        <div className="mx-auto max-w-2xl space-y-4">
          {FAQS.map((item) => (
            <Accordion key={item.q} question={item.q} answer={item.a} />
          ))}
        </div>
      </Section>

      <Section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="rounded-lg px-4 py-4 text-center">
          <h2 className="type-section text-white">Ready to Stop Compliance Delays?</h2>
          <p className="type-body type-lg mx-auto max-w-[600px] text-blue-100">
            Join 150+ firms already using Docketra. 7-day free trial. No credit card required.
          </p>

          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <Link
              to="/signup"
              className="rounded-lg bg-white px-8 py-3 font-semibold text-blue-600 transition-colors hover:bg-blue-50"
            >
              Start Free Trial
            </Link>
            <button
              type="button"
              onClick={openDemoCalendly}
              className="rounded-lg border-2 border-white px-8 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Schedule Demo
            </button>
          </div>
        </div>
      </Section>
    </div>
  );
};
