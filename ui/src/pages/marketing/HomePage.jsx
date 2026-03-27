import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Section } from '../../components/layout/Section';
import '../../assets/styles/marketing-tokens.css';

const PROBLEM_POINTS = [
  {
    icon: 'chart',
    title: 'Spreadsheets Are Invisible Until Review Time',
    desc: 'Partners discover issues during final approval, not during execution when there is still time to fix them.',
  },
  {
    icon: 'messages',
    title: 'WhatsApp Assignments Leave No Trail',
    desc: 'If regulators ask who approved something, teams often cannot provide a verifiable record.',
  },
  {
    icon: 'search',
    title: 'No One Knows Who Owns What',
    desc: 'When deadlines slip, ownership and blockers are unclear across teams.',
  },
  {
    icon: 'users',
    title: 'Onboarding New Team Members Takes Weeks',
    desc: 'People restart work instead of continuing from documented progress.',
  },
  {
    icon: 'clock',
    title: 'Status Meetings Eat Up Everyone’s Time',
    desc: 'Partners have to chase updates manually instead of seeing one shared view.',
  },
  {
    icon: 'alert',
    title: 'Overdue Items Surface Too Late',
    desc: 'Missed deadlines are often discovered only after clients are already impacted.',
  },
];

const SOLUTION_POINTS = [
  {
    num: '1',
    title: 'Structured Lifecycle Stages',
    desc: 'Track work through explicit checkpoints with ownership and approvals at each stage.',
    icon: 'list',
  },
  {
    num: '2',
    title: 'Real-Time Team Visibility',
    desc: 'See who is responsible, what changed, and what needs attention right now.',
    icon: 'eye',
  },
  {
    num: '3',
    title: 'Audit Trails By Default',
    desc: 'Every action is logged with actor and timestamp for operational accountability.',
    icon: 'check',
  },
];

const AUDIENCE_SEGMENTS = [
  {
    title: 'Audit & Assurance',
    color: 'bg-blue-500',
    points: ['Parallel testing workflows', 'Partner review stages', 'Engagement risk visibility', 'Quality gates'],
  },
  {
    title: 'Tax & Compliance',
    color: 'bg-emerald-500',
    points: ['GST, TDS, ROC tracking', 'Multi-office coordination', 'Deadline reminders', 'Filing calendar visibility'],
  },
  {
    title: 'Consulting',
    color: 'bg-indigo-500',
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

const TRUST_LOGOS = ['Aster & Co.', 'Northbridge Advisors', 'KVR Compliance', 'TaxLedger Partners'];

const METRICS = [
  { value: '40%', label: 'faster audit cycles' },
  { value: '100%', label: 'activity traceability' },
  { value: 'Zero', label: 'missed deadlines' },
  { value: 'Multi-office', label: 'visibility' },
];

const SECTION_REVEAL = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
  viewport: { once: true, amount: 0.2 },
};

const MinimalIcon = ({ type }) => {
  const iconMap = {
    chart: 'M4 18h16M7 14l2-2 3 3 5-6',
    messages: 'M4 6h16v10H8l-4 4V6Z',
    search: 'm15 15 5 5m-9-3a6 6 0 1 1 0-12 6 6 0 0 1 0 12Z',
    users: 'M15 19v-1a4 4 0 0 0-8 0v1m12 0v-1a4 4 0 0 0-3-3.87M9 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 1a2.5 2.5 0 1 0 0-5',
    clock: 'M12 7v5l3 2m7-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
    alert: 'm12 9.5.01 0M11 13h2m-1-10 9 16H3l9-16Z',
    list: 'M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01',
    eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    check: 'm5 12 4 4 10-10',
  };
  const path = iconMap[type] || iconMap.list;

  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path d={path} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
};

const Accordion = ({ question, answer }) => {
  const [open, setOpen] = useState(false);

  const toggle = () => setOpen((prev) => !prev);

  return (
    <div className="border-b border-gray-100 py-6 first:pt-0 last:border-b-0 last:pb-0">
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
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden"
        >
          <p className="pt-4 text-sm text-gray-700">{answer}</p>
        </motion.div>
      )}
    </div>
  );
};

const renderComparisonCell = (value, accent = false) => {
  if (!value) return <span className="text-gray-400">—</span>;
  if (value === '✅') return <span className={`font-semibold text-green-600 ${accent ? 'text-base' : ''}`}>✅</span>;
  if (value === '❌') return <span className={`font-semibold text-red-500 ${accent ? 'text-base' : ''}`}>❌</span>;
  return <span className={`font-semibold text-amber-500 ${accent ? 'text-base' : ''}`}>{value}</span>;
};

export const HomePage = () => {
  useEffect(() => {
    const originalOnError = window.onerror;
    window.onerror = (msg, src, line, col, err) => {
      console.error('GLOBAL ERROR:', err);
      if (typeof originalOnError === 'function') {
        return originalOnError(msg, src, line, col, err);
      }
      return false;
    };

    return () => {
      window.onerror = originalOnError || null;
    };
  }, []);

  useEffect(() => {
    const collections = {
      PROBLEM_POINTS,
      SOLUTION_POINTS,
      AUDIENCE_SEGMENTS,
      METRICS,
    };
    Object.entries(collections).forEach(([name, list]) => {
      if (!Array.isArray(list)) {
        console.warn(`[HomePage] ${name} is not an array`, list);
        return;
      }
      list.forEach((entry, idx) => {
        if (entry == null) {
          console.warn(`[HomePage] ${name}[${idx}] is null/undefined`, entry);
          return;
        }
        if (typeof entry !== 'object') {
          console.warn(`[HomePage] ${name}[${idx}] is not an object`, entry);
          return;
        }
        const missingKeys = Object.keys(entry).filter((key) => entry[key] == null);
        if (missingKeys.length > 0) {
          console.warn(`[HomePage] ${name}[${idx}] has null/undefined keys`, missingKeys, entry);
        }
      });
    });
  }, []);

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

  console.log({
    PROBLEM_POINTS,
    SOLUTION_POINTS,
    AUDIENCE_SEGMENTS,
    METRICS,
  });

  return (
    <div className="w-full">
      <Section>
        <div className="grid w-full items-center gap-8 lg:grid-cols-2">
          <div className="w-full min-w-0 text-left">
            <div className="max-w-xl">
              <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                Launching soon • Early access open
              </span>
              <h1 className="text-5xl md:text-6xl font-semibold tracking-tight leading-tight text-gray-900">
                Compliance operations
                <br />
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  without the chaos.
                </span>
              </h1>
              <p className="mt-4 text-base text-gray-600">
                Docketra gives leadership and delivery teams one shared system for ownership, deadlines, and
                approvals, with audit-ready visibility built into every step.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-900"
                >
                  Request Early Access
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100"
                >
                  See how it works
                </a>
              </div>
              <p className="mt-3 text-xs text-gray-500">Used by modern CA firms &amp; compliance teams</p>
            </div>
          </div>

          <motion.div
            {...SECTION_REVEAL}
            className="w-full min-w-0 rounded-xl bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.12)]"
          >
            <div className="overflow-hidden rounded-lg bg-white p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Operations dashboard</p>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-700">
                  Live
                </span>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'Open tasks', value: '142' },
                  { label: 'Due this week', value: '26' },
                  { label: 'Awaiting review', value: '9' },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-[11px] text-gray-500">{item.label}</p>
                    <p className="mt-2 text-xl font-semibold text-gray-900">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 space-y-3">
                {['Q4 Tax Filings - West Region', 'Statutory Audit FY 2025-26', 'Client Onboarding Quality Review'].map(
                  (row) => (
                    <div key={row} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5">
                      <p className="truncate pr-3 text-sm text-gray-700">{row}</p>
                      <span className="text-xs font-medium text-indigo-600">In progress</span>
                    </div>
                  ),
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </Section>

      <Section>
        <div className="border-t border-gray-100 pt-10">
          <p className="text-center text-xs font-semibold tracking-[0.16em] text-gray-500 uppercase">
            Built for audit, tax &amp; compliance teams
          </p>
          <div className="mt-6 grid grid-cols-2 items-center gap-6 opacity-70 md:grid-cols-4">
            {TRUST_LOGOS.map((logo) => (
              <div
                key={logo}
                className="flex h-14 items-center justify-center rounded-lg border border-gray-100 bg-white px-4 text-sm font-medium text-gray-500 grayscale transition-opacity hover:opacity-100"
              >
                {logo}
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section muted>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {METRICS?.map((item) => (
            <div key={item.label} className="card-base p-6 text-center">
              <p className="text-3xl font-semibold text-gray-900">{item.value}</p>
              <p className="mt-2 text-sm font-medium text-gray-600">{item.label}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section muted>
        <h2 className="type-section">Why Teams Lose Control</h2>
        <div className="mt-8 grid items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
          {PROBLEM_POINTS?.map((point, index) => (
            <motion.div
              key={point.title}
              className="card-base hover-card relative p-6"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              viewport={{ once: true, amount: 0.2 }}
            >
              <MinimalIcon type={point.icon} />
              <h3 className="mt-3 text-base font-medium text-gray-900">{point.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">{point.desc}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      <Section id="how-it-works">
        <div className="mb-12">
          <h2 className="type-section">How Docketra Works</h2>
          <p className="type-body type-lg w-full text-gray-600">
            Audit-ready workflows that bring compliance-grade visibility and partner-level oversight to every case.
          </p>
        </div>

        <div className="grid w-full gap-8 md:grid-cols-3">
          {SOLUTION_POINTS?.map((item, idx) => (
            <motion.div key={item.num} className="relative" {...SECTION_REVEAL}>
              <span className="text-5xl font-semibold text-gray-200">{item.num}</span>
              <h3 className="mt-3 text-lg font-semibold text-gray-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.desc}</p>
              {idx < SOLUTION_POINTS?.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute top-8 right-[-18px] hidden h-px w-9 bg-gray-200 md:block lg:w-12"
                />
              ) : null}
            </motion.div>
          ))}
        </div>
      </Section>

      <Section muted>
        <div className="mb-12">
          <h2 className="type-section">Configured for each service line</h2>
          <p className="type-body type-lg w-full text-gray-600">
            Standardize delivery with audit-ready workflows and partner-level oversight across audit, tax, and advisory.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {AUDIENCE_SEGMENTS?.map((segment) => (
            <motion.div
              key={segment.title}
              className="card-base hover-card relative p-6"
              {...SECTION_REVEAL}
            >
              <h3 className="text-lg font-medium text-gray-900">{segment.title}</h3>
              <ul className="space-y-3">
                {segment.points.map((point) => (
                  <li key={point} className="mt-3 flex items-start gap-3 text-sm text-gray-600">
                    <span className={`mt-0.5 inline-block h-2 w-2 rounded-full ${segment.color}`} aria-hidden="true" />
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
            Get priority onboarding for audit-ready workflows and help shape the controls your team relies on.
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
              Request Early Access
            </button>
          </form>
          <div className="space-y-2">
            <p className="text-xs text-gray-500">No spam. We&apos;ll only contact you regarding your workspace setup.</p>
            <p className="text-sm font-medium text-gray-600">Used by modern CA firms &amp; compliance teams</p>
          </div>
        </div>
      </Section>

      <Section muted>
        <div className="mb-12">
          <h2 className="type-section">Why Choose Docketra Over Spreadsheets &amp; WhatsApp?</h2>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
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
                  <td className="px-4 py-3 text-center">{renderComparisonCell(row[1])}</td>
                  <td className="px-4 py-3 text-center">{renderComparisonCell(row[2])}</td>
                  <td className="px-4 py-3 text-center">{renderComparisonCell(row[3], true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section>
        <div className="card-base mx-auto w-full max-w-2xl p-8 text-center">
          <p className="text-lg leading-relaxed text-gray-700 italic">
            “Docketra gave us partner-level oversight across offices without chasing status updates. Every compliance
            decision now has a clear, reviewable trail.”
          </p>
          <p className="mt-6 text-sm font-semibold text-gray-900">Priya Mehta</p>
          <p className="text-sm text-gray-600">Head of Assurance, Meridian CA Advisors</p>
        </div>
      </Section>

      <Section>
        <div className="mb-12">
          <h2 className="type-section">Questions Answered</h2>
        </div>

        <div className="w-full rounded-xl border border-gray-200 bg-white p-6 md:p-8">
          {FAQS.map((item) => (
            <Accordion key={item.q} question={item.q} answer={item.a} />
          ))}
        </div>
      </Section>
    </div>
  );
};
