import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Container from '../../components/layout/Container';
import SeoHead from '../../components/common/SeoHead';
import { SUPPORT_EMAIL } from '../../config/publicContact';

const REVEAL = {
  initial: false,
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  viewport: { once: true, amount: 0.08 },
};

const CheckIcon = () => (
  <svg className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
  </svg>
);

const COMPARISON_ROWS = [
  {
    feature: 'Storage & Document Custody',
    docketra: 'Your Firm’s Own Google Drive (100% private custody)',
    jamku: 'Centralized Shared Cloud Database',
    excel: 'Local Hard Drives / Unencrypted WhatsApp',
  },
  {
    feature: 'Trainee Laptop Shield (Endpoint Leak Protection)',
    docketra: 'Active (Blocks junior staff from downloading client files to personal laptops)',
    jamku: 'None (Unrestricted file downloads to personal devices)',
    excel: 'None (Client files scatter across personal folders)',
  },
  {
    feature: 'Mandatory Setup & Migration Fees',
    docketra: 'Zero setup fees (Free assisted migration)',
    jamku: 'Paid setup & migration surcharge',
    excel: 'Manual spreadsheet setup',
  },
  {
    feature: 'Client Document Intake',
    docketra: '1-Click Drop Link & WhatsApp Forwarding',
    jamku: 'Requires Client Portal Registration',
    excel: 'Unorganized WhatsApp Threads & Email Chaos',
  },
  {
    feature: 'Out-of-the-box Statutory Blueprints',
    docketra: '15+ Checklists (MCA, ROC, GST, Tax Audit 3CD)',
    jamku: 'Generic Task Lists / Custom Setup Required',
    excel: 'Static Outdated Spreadsheets',
  },
  {
    feature: 'Maker-Checker Approval Hierarchy',
    docketra: 'Native Trainee-Prepare / Partner-Sign-off',
    jamku: 'Flat Task Re-assignment',
    excel: 'Verbal / No Audit Trail',
  },
  {
    feature: 'ICAI / ICSI Peer-Review Audit Trail',
    docketra: 'Timestamped SQC-1 Audit History',
    jamku: 'Basic Change Log',
    excel: 'None (Fails Peer-Review Standard)',
  },
  {
    feature: 'Accidental Deletion & Tamper Protection',
    docketra: 'Folder Tamper Guard (Auto-detects moved folders & 1-click restore)',
    jamku: 'Proprietary Cloud Lock (Files held on external servers)',
    excel: 'Zero Recovery (Accidental deletion permanently loses working papers)',
  },
];

const FAQS = [
  {
    question: 'Can DocketsHQ read our firm’s existing confidential files in Google Drive?',
    answer: 'No. When you connect Google Drive, DocketsHQ uses Google’s restricted drive.file permission. It only accesses the specific /DocketsHQ/ folder it created. We have zero access to read, search, or index any of your pre-existing client files, PAN copies, or private archives.',
  },
  {
    question: 'What happens to our client records if we choose not to continue after the pilot?',
    answer: '100% of your client files and organized folders stay inside your firm’s own Google Drive. If you ever discontinue, you keep everything. No lock-in, no export delays, and no charges.',
  },
  {
    question: 'Our clients refuse to open web links and only dump files in WhatsApp. How does DocketsHQ handle this?',
    answer: 'Clients do not need to register on any portal or click links. They can keep texting documents on WhatsApp as usual. Your team simply forwards or drops the WhatsApp file into DocketsHQ with one click. DocketsHQ saves it directly to the client’s Google Drive folder, notes the message details, and checks off the pending task.',
  },
  {
    question: 'Our article clerks and trainees rotate every 2 to 3 years. How long does training take?',
    answer: 'Zero days. DocketsHQ comes with ready-made statutory checklists for MCA filings (MGT-7/AOC-4), DIR-3 KYC, GST returns, and Tax Audit Form 3CD. Fresh article assistants can follow the steps from Day 1, and partners review and sign off before final submission.',
  },
  {
    question: 'How does the 26-Firm Founding Pilot work?',
    answer: 'DocketsHQ is currently onboarding the first 26 founding Indian CA, CS, and legal practices into a 1-year free pilot. Participating firms receive full access with unlimited team seats, unlimited active clients, and unlimited dockets across active workflows for 12 consecutive months at zero cost.',
  },
  {
    question: 'When will paid pricing for Starter, Growth, and Pro tiers be announced?',
    answer: 'Paid tier pricing is coming soon and will be finalized once our founding pilot reaches the 20-firm operational milestone. All tier limits (team seats, client allowances, and features) are published here transparently, and founding pilot firms keep their full 1-year free evaluation period.',
  },
  {
    question: 'What are the planned team size and client limits for each post-pilot tier?',
    answer: 'Starter Tier is structured for boutique practices (up to 5 team seats, 50 active clients, unlimited dockets). Growth Tier supports mid-sized practices (up to 12 team seats with add-on seat flexibility, 150 active clients, unlimited dockets). Pro Tier supports corporate and multi-branch firms (up to 25 team seats, unlimited clients and dockets).',
  },
  {
    question: 'What if an assistant or clerk accidentally deletes or moves a folder inside Google Drive?',
    answer: 'If an assistant accidentally moves or deletes a folder in Google Drive, DocketsHQ detects it immediately, alerts the partner or admin, and restores or re-links the folder in one click.',
  },
];

export const PricingPage = () => {
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="w-full bg-white text-slate-900 antialiased selection:bg-amber-500/25">
      <SeoHead
        canonicalPath="/pricing"
        title="Plans, Capacity & Pilot Access | DocketsHQ"
        description="Transparent plan capacities and feature tiers for Indian CA, CS, and compliance firms. Onboard into our 26-firm 1-year unlimited pilot — commercial pricing coming soon."
      />

      {/* Header Section */}
      <section className="relative overflow-hidden bg-slate-50/60 pt-20 pb-16 sm:pt-24 sm:pb-20 border-b border-slate-200">
        <Container size="7xl" className="text-center">
          <motion.div {...REVEAL} className="max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 rounded-xs border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
              <span>26-Firm Founding Pilot Open</span>
              <span className="text-amber-400">•</span>
              <span>1 Year Full Access (Unlimited Usage)</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl [text-wrap:balance] mx-auto w-full">
              Transparent plans for Indian professional practices.
            </h1>
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed [text-wrap:pretty]">
              We are currently onboarding 26 founding firms with full unlimited access for 1 full year under our pilot. Commercial tier pricing is coming soon.
            </p>
          </motion.div>
        </Container>
      </section>

      {/* Plans & Capacity Grid */}
      <section className="py-16 sm:py-24 bg-white border-b border-slate-200">
        <Container size="7xl">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 items-stretch">
            {/* Active 26-Firm Founding Pilot */}
            <motion.div
              {...REVEAL}
              className="relative flex flex-col rounded-sm border-2 border-slate-950 bg-white p-6 sm:p-7 shadow-md"
            >
              <div className="border-b border-slate-100 pb-6 pt-1">
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-xs border border-emerald-200">
                  Open Now • First 26 Firms
                </span>
                <h2 className="mt-3 text-xl font-bold text-slate-950">Founding Pilot</h2>
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                  1-year free evaluation cohort for Indian CA, CS, and legal firms. Full access across active pilot workflows with zero usage caps.
                </p>
                <div className="mt-6 flex items-baseline gap-1.5 text-slate-950">
                  <span className="text-3xl font-extrabold tracking-tight text-slate-950">1 Year Free</span>
                  <span className="text-xs font-medium text-slate-500">/ under pilot</span>
                </div>
                <div className="mt-2 text-xs text-slate-700 font-semibold">
                  Unlimited team seats / Unlimited clients / Unlimited dockets
                </div>
              </div>

              <div className="flex-1 py-6 space-y-3">
                <span className="text-xs font-semibold text-slate-700 block">
                  What is included for 1 year:
                </span>
                <ul className="space-y-2.5 text-xs text-slate-700">
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span>No seat, client, or docket limits during pilot</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span>Connect your firm Google Drive (restricted scope)</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span>Folder Tamper Guard &amp; Auto-Restore</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span>Trainee Laptop Shield blocks local downloads</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span>Maker-Checker partner sign-offs and MCA/GST checklists</span>
                  </li>
                </ul>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <Link
                  to="/signup"
                  className="inline-flex w-full h-11 items-center justify-center rounded-xs bg-slate-950 px-4 text-xs font-semibold text-amber-300 shadow-sm hover:bg-slate-800 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950 active:bg-slate-900"
                >
                  Join 1-Year Free Pilot (26 Firms)
                </Link>
                <p className="mt-2 text-center text-xs text-slate-500">
                  No card required / Instant Google Drive setup
                </p>
              </div>
            </motion.div>

            {/* Starter Tier */}
            <motion.div
              {...REVEAL}
              className="flex flex-col rounded-sm border border-slate-200 bg-white p-6 sm:p-7 hover:border-slate-300 transition-colors shadow-xs"
            >
              <div className="border-b border-slate-100 pb-6 pt-1">
                <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-xs border border-amber-200">
                  Pricing Coming Soon
                </span>
                <h2 className="mt-3 text-xl font-bold text-slate-950">Starter Tier</h2>
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                  Complete practice OS for boutique firms (2 to 5 members). Replaces messy WhatsApp groups and Excel trackers.
                </p>
                <div className="mt-6 flex items-baseline gap-2 text-slate-950">
                  <span className="text-2xl font-bold tracking-tight text-slate-900">Coming Soon</span>
                </div>
                <div className="mt-2 text-xs text-slate-700 font-semibold">
                  Up to 5 team seats / 50 active clients / Unlimited dockets
                </div>
              </div>

              <div className="flex-1 py-6 space-y-3.5">
                <span className="text-xs font-semibold text-slate-700 block">
                  Planned inclusions:
                </span>
                <ul className="space-y-2.5 text-xs text-slate-700">
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span>WhatsApp forwarding &amp; client document drop link</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span>15+ statutory checklists (MCA, ROC, GST, Tax Audit)</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span>Assisted client onboarding and data import</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span>Google Drive security &amp; permission isolation</span>
                  </li>
                  <li className="flex items-start gap-2.5 pt-1 border-t border-slate-100">
                    <CheckIcon />
                    <span className="font-semibold text-slate-950">100% Data Sovereignty in your Drive</span>
                  </li>
                </ul>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <Link
                  to="/signup"
                  className="inline-flex w-full h-11 items-center justify-center rounded-xs border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950 active:bg-slate-100"
                >
                  Coming Soon • Try via Pilot
                </Link>
                <p className="mt-2 text-center text-xs text-slate-500">
                  Commercial pricing announced post-pilot
                </p>
              </div>
            </motion.div>

            {/* Growth Tier */}
            <motion.div
              {...REVEAL}
              className="relative flex flex-col rounded-sm border border-slate-200 bg-white p-6 sm:p-7 hover:border-slate-300 transition-colors shadow-xs"
            >
              <div className="border-b border-slate-100 pb-6 pt-1">
                <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-xs border border-amber-200">
                  Pricing Coming Soon
                </span>
                <h2 className="mt-3 text-xl font-bold text-slate-950">Growth Tier</h2>
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                  Practice OS for mid-sized firms (6 to 12 staff). Department queues, Form 3CD blueprints, and Trainee Shield.
                </p>
                <div className="mt-6 flex items-baseline gap-2 text-slate-950">
                  <span className="text-2xl font-bold tracking-tight text-slate-900">Coming Soon</span>
                </div>
                <div className="mt-2 text-xs text-slate-700 font-semibold">
                  Up to 12 team seats / 150 active clients / Unlimited dockets
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Additional team seat add-ons supported
                </div>
              </div>

              <div className="flex-1 py-6 space-y-3">
                <span className="text-xs font-semibold text-slate-700 block">
                  Everything in Starter, plus:
                </span>
                <ul className="space-y-2.5 text-xs text-slate-700">
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span>Pre-loaded blueprints: Tax Audit 3CD, MCA &amp; GST</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span>SQC-1 maker-checker review with partner sign-offs</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span>Trainee Laptop Shield blocks file downloads</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span>Drive Tamper Guard auto-restores moved folders</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span>Department queues: ROC, Tax, GST, and Audit</span>
                  </li>
                </ul>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <Link
                  to="/signup"
                  className="inline-flex w-full h-11 items-center justify-center rounded-xs border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950 active:bg-slate-100"
                >
                  Coming Soon • Try via Pilot
                </Link>
                <p className="mt-2 text-center text-xs text-slate-500">
                  Commercial pricing announced post-pilot
                </p>
              </div>
            </motion.div>

            {/* Pro Tier */}
            <motion.div
              {...REVEAL}
              className="flex flex-col rounded-sm border border-slate-200 bg-white p-6 sm:p-7 hover:border-slate-300 transition-colors shadow-xs"
            >
              <div className="border-b border-slate-100 pb-6 pt-1">
                <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-xs border border-amber-200">
                  Pricing Coming Soon
                </span>
                <h2 className="mt-3 text-xl font-bold text-slate-950">Pro Tier</h2>
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                  For expanding compliance and audit firms (15+ staff) requiring multi-branch controls and partner DSC sign-off workflows.
                </p>
                <div className="mt-6 flex items-baseline gap-2 text-slate-950">
                  <span className="text-2xl font-bold tracking-tight text-slate-900">Coming Soon</span>
                </div>
                <div className="mt-2 text-xs text-slate-700 font-semibold">
                  Up to 25 team seats / Unlimited active clients / Unlimited dockets
                </div>
              </div>

              <div className="flex-1 py-6 space-y-3">
                <span className="text-xs font-semibold text-slate-700 block">
                  Everything in Growth, plus:
                </span>
                <ul className="space-y-2.5 text-xs text-slate-700">
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span>Multi-department queues (ROC, Direct Tax, GST, Legal)</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span>Multi-partner DSC sign-off routing workflows</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span>Priority SLA &amp; direct concierge onboarding</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span>Dedicated firm onboarding &amp; data migration engineer</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span>Custom practice roles and granular staff permissions</span>
                  </li>
                </ul>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <Link
                  to="/signup"
                  className="inline-flex w-full h-11 items-center justify-center rounded-xs border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950 active:bg-slate-100"
                >
                  Coming Soon • Try via Pilot
                </Link>
                <p className="mt-2 text-center text-xs text-slate-500">
                  Commercial pricing announced post-pilot
                </p>
              </div>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* Sovereign Data Promise Banner */}
      <section className="bg-slate-950 py-16 text-white border-b border-slate-800">
        <Container size="7xl">
          <div className="rounded-sm border border-slate-800 bg-slate-900/60 p-8 sm:p-10 flex flex-col md:flex-row items-center gap-8 justify-between">
            <div className="space-y-2 max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight text-white">
                100% In Your Firm’s Google Drive
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Onboard into our 26-firm Founding Pilot with full 1-year free access and zero usage limits. All your documents, working papers, and client files stay safely inside your firm’s own Google Drive with zero vendor lock-in.
              </p>
            </div>
            <div className="shrink-0 text-center">
              <Link
                to="/signup"
                className="inline-flex h-12 items-center justify-center rounded-xs bg-amber-400 px-6 text-xs font-bold text-slate-950 transition-colors hover:bg-amber-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-400 active:bg-amber-500"
              >
                Start 1-Year Free Pilot
              </Link>
              <div className="mt-2 text-xs text-slate-400">
                Files stay in your firm’s Drive / Instant setup
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Competitor Comparison Table */}
      <section className="py-16 sm:py-24 bg-slate-50/50 border-b border-slate-200">
        <Container size="7xl">
          <motion.div {...REVEAL} className="max-w-2xl mx-auto text-center space-y-2 mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              How DocketsHQ compares to legacy tools and Excel
            </h2>
            <p className="text-sm text-slate-600">
              Why leading Indian firms are abandoning centralized servers and messy spreadsheets.
            </p>
          </motion.div>

          <div className="overflow-x-auto rounded-md border border-slate-200 bg-white shadow-xs">
            <table className="w-full table-fixed text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-900 border-b border-slate-200 text-xs font-semibold">
                <tr>
                  <th scope="col" className="p-4 w-1/4 font-semibold text-slate-900">Operational Capability</th>
                  <th scope="col" className="p-4 w-1/4 bg-emerald-50/60 text-slate-950 font-bold border-x border-emerald-200">
                    DocketsHQ (The Company Brain)
                  </th>
                  <th scope="col" className="p-4 w-1/4 text-slate-700 font-medium">Jamku / Legacy</th>
                  <th scope="col" className="p-4 w-1/4 text-slate-700 font-medium">Excel + WhatsApp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.feature} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-semibold text-slate-950 align-top">{row.feature}</td>
                    <td className="p-4 bg-emerald-50/20 text-slate-950 font-medium border-x border-emerald-100 align-top">
                      <div className="flex items-start gap-2">
                        <CheckIcon />
                        <span className="leading-relaxed">{row.docketra}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-600 align-top leading-relaxed">{row.jamku}</td>
                    <td className="p-4 text-slate-600 align-top leading-relaxed">{row.excel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </section>

      {/* FAQ Accordion */}
      <section className="py-16 sm:py-24 bg-white border-b border-slate-200">
        <Container size="7xl">
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
                Questions Managing Partners Ask Us
              </h2>
            </div>

            <div className="divide-y divide-slate-200 border-y border-slate-200">
              {FAQS.map((faq, idx) => (
                <div key={faq.question} className="py-4">
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    aria-expanded={openFaq === idx}
                    className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-950 hover:text-amber-800 transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950 active:text-slate-900"
                  >
                    <span>{faq.question}</span>
                    <span className="ml-4 text-base font-normal text-slate-500" aria-hidden="true">
                      {openFaq === idx ? '−' : '+'}
                    </span>
                  </button>
                  {openFaq === idx && (
                    <p className="mt-2.5 text-xs sm:text-sm text-slate-600 leading-relaxed pr-8">
                      {faq.answer}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-4 text-center text-xs text-slate-600">
              Have a specific question about firm onboarding or custom roles? Reach our engineering team at{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-slate-950 underline hover:text-amber-800">
                {SUPPORT_EMAIL}
              </a>
              .
            </div>
          </div>
        </Container>
      </section>

      {/* Bottom CTA */}
      <section className="bg-slate-50/60 py-16 sm:py-24 text-center">
        <Container size="7xl">
          <motion.div {...REVEAL} className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Take control of your practice with The Company Brain.
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Join 26 founding Indian CA &amp; CS practices running audit-ready, zero-stress client operations free for 1 full year.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/signup"
                className="inline-flex w-full sm:w-auto h-12 items-center justify-center rounded-xs bg-slate-950 px-6 text-xs font-semibold text-amber-300 hover:bg-slate-800 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950 active:bg-slate-900"
              >
                <span>Start 1-Year Free Pilot</span>
              </Link>
              <Link
                to="/find-workspace"
                className="inline-flex w-full sm:w-auto h-12 items-center justify-center rounded-xs border border-slate-300 bg-white px-5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950 active:bg-slate-100"
              >
                Find existing workspace
              </Link>
            </div>
            <p className="text-xs text-slate-500 pt-1">
              Zero setup fees / One-click Google Drive connection / Unlimited usage during pilot
            </p>
          </motion.div>
        </Container>
      </section>
    </div>
  );
};

export default PricingPage;
