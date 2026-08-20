import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PublicMarketingHeader from '../marketing/PublicMarketingHeader';
import Container from '../layout/Container';
import BubbleMenu from '../common/BubbleMenu';
import ScrollFloat from '../common/ScrollFloat';
import BorderGlow from '../common/BorderGlow';

const REVEAL = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  viewport: { once: true, amount: 0.12 },
};

const HERO_BADGES = [
  {
    label: 'Dockets',
    icon: (
      <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    label: 'Worklists',
    icon: (
      <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: 'Workbaskets',
    icon: (
      <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ),
  },
  {
    label: 'Quality Control',
    icon: (
      <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    label: 'Reports',
    icon: (
      <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2h-2a2 2 0 01-2-2zm9-1v-4a2 2 0 00-2-2h-2a2 2 0 00-2 2v4a2 2 0 002 2h2a2 2 0 002-2z" />
      </svg>
    ),
  },
  {
    label: 'Audit Trails',
    icon: (
      <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

const ProductMockup = () => (
  <div className="relative">
    {/* Decorative Ambient Glowing Orbs */}
    <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
    <div className="absolute -bottom-16 -left-16 h-72 w-72 rounded-full bg-indigo-500/5 blur-3xl" />

    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      {/* Browser Bar */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-900/5 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-rose-400" />
          <span className="h-3 w-3 rounded-full bg-amber-400" />
          <span className="h-3 w-3 rounded-full bg-emerald-400" />
        </div>
        <div className="rounded-full bg-slate-200/60 px-4 py-0.5 text-[11px] font-semibold text-slate-600">
          docketra.in/workspace/mehta-co
        </div>
        <div className="flex gap-2">
          <span className="h-4 w-4 rounded-md bg-slate-300" />
        </div>
      </div>

      <div className="grid min-h-[480px] grid-cols-[160px_1fr]">
        {/* Workspace Sidebar */}
        <aside className="border-r border-slate-100 bg-slate-900 p-3 text-slate-400">
          <div className="mb-4 flex items-center gap-1.5 rounded-xl bg-white/5 p-2 text-white">
            <svg className="h-5 w-5 text-amber-500" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M25 15H50C69.33 15 85 30.67 85 50C85 69.33 69.33 85 50 85H25V15Z" stroke="currentColor" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M40 30H50C61.05 30 70 38.95 70 50C70 61.05 61.05 70 50 70H40V30Z" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xs font-black tracking-tight text-white">Docketra</span>
          </div>

          <div className="space-y-1 text-[11px] font-bold">
            {[
              { label: 'Home', active: true },
              { label: 'Clients' },
              { label: 'Dockets' },
              { label: 'Worklists' },
              { label: 'Workbaskets' },
              { label: 'Calendar' },
              { label: 'Reports' },
              { label: 'QC' },
              { label: 'Knowledge' },
              { label: 'Team' },
              { label: 'Settings' }
            ].map((item) => (
              <div
                key={item.label}
                className={`rounded-lg px-2.5 py-1.5 transition-colors ${
                  item.active ? 'bg-amber-600/15 text-amber-400 font-extrabold' : 'hover:bg-white/5 hover:text-white'
                }`}
              >
                {item.label}
              </div>
            ))}
          </div>

          {/* User badge */}
          <div className="mt-8 flex items-center gap-2 border-t border-white/5 pt-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-600 text-[10px] font-black text-white">AM</div>
            <div className="leading-none">
              <p className="text-[10px] font-black text-white">Arjun Mehta</p>
              <p className="text-[8px] text-slate-500 font-bold mt-0.5">Partner</p>
            </div>
          </div>
        </aside>

        {/* Workspace Dashboard */}
        <main className="bg-slate-50/50 p-5 grid grid-rows-[auto_auto_1fr]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900">Good morning, Arjun</h3>
              <p className="text-[10px] text-slate-500 font-bold mt-0.5">Open deadlines, review queues, and client context for today.</p>
            </div>
            <div className="flex gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-white text-slate-500 shadow-sm">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-5.8-5.8m1.8-5.2a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <span className="flex h-5 w-5 items-center justify-center rounded bg-white text-slate-500 shadow-sm">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0" />
                </svg>
              </span>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="mt-4 grid grid-cols-4 gap-2">
            {[
              { label: 'Active Dockets', val: '156', trend: '+12 since yesterday', color: 'text-emerald-600' },
              { label: 'Due Today', val: '23', trend: 'High priority', color: 'text-rose-600' },
              { label: 'In Review (QC)', val: '17', trend: '3 need your attention', color: 'text-amber-600' },
              { label: 'Overdue', val: '8', trend: 'Across 3 dockets', color: 'text-slate-600' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-slate-200/70 bg-white p-2.5 shadow-sm">
                <p className="text-[8px] font-black uppercase tracking-wider text-slate-500">{stat.label}</p>
                <p className="mt-1 text-base font-black text-slate-900 leading-none">{stat.val}</p>
                <p className={`mt-1.5 text-[8px] font-extrabold ${stat.color}`}>{stat.trend}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-[1fr_150px] gap-3">
            {/* Worklist area */}
            <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-4 border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-500">
                  <span className="text-slate-900 border-b-2 border-amber-600 pb-0.5">My Worklist</span>
                  <span>My Workbaskets</span>
                  <span>Following</span>
                </div>
                <div className="divide-y divide-slate-100 text-[10px] leading-tight">
                  {[
                    { task: 'DIR-3 KYC Filing', client: 'Zenith Infra Pvt. Ltd.', due: 'Today', prio: 'High', pColor: 'text-rose-600 bg-rose-50' },
                    { task: 'Share allotment for review', client: 'Skyflow Developers LLP', due: 'Today', prio: 'High', pColor: 'text-rose-600 bg-rose-50' },
                    { task: 'GST Annual Reconciliation', client: 'Neo Retail Pvt. Ltd.', due: 'Tomorrow', prio: 'Medium', pColor: 'text-amber-600 bg-amber-50' },
                    { task: 'Board Meeting Notice', client: 'BlueStone Foods Pvt. Ltd.', due: '22 May', prio: 'Medium', pColor: 'text-amber-600 bg-amber-50' },
                    { task: 'Tax Audit - ROC checklist', client: 'Anya Textiles Pvt. Ltd.', due: '25 May', prio: 'Low', pColor: 'text-slate-600 bg-slate-50' },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50/50">
                      <div>
                        <p className="font-extrabold text-slate-900">{row.task}</p>
                        <p className="text-[8px] text-slate-500 mt-0.5">{row.client}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">{row.due}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[8px] font-black ${row.pColor}`}>{row.prio}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-slate-100 p-2 text-center">
                <span className="text-[10px] font-extrabold text-amber-700 hover:text-amber-800 cursor-pointer flex items-center justify-center gap-1">
                  View all work items
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </div>

            {/* Client Memory Context */}
            <div className="rounded-xl bg-slate-900 p-3 text-white shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                  <span className="text-[9px] font-black text-amber-400">Client Memory</span>
                  <span className="text-[8px] text-slate-500 font-bold">Zenith Infra Pvt. Ltd.</span>
                </div>
                <div className="mt-2 space-y-2 text-[8px] leading-relaxed text-slate-300">
                  <div>
                    <p className="font-black text-white uppercase tracking-wider text-[7px]">Key Context</p>
                    <ul className="list-disc pl-2.5 mt-0.5 space-y-0.5">
                      <li>Holding company restructure in progress</li>
                      <li>ROC adjudication reply filed on 12 May</li>
                      <li>SIDBI notice pending, hearing on 26 May</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-black text-white uppercase tracking-wider text-[7px] mt-1.5">Important Dates</p>
                    <table className="w-full mt-0.5 border-none">
                      <tbody>
                        <tr><td className="text-slate-500 font-bold">ROC AGM Due</td><td className="text-right text-white">30 Jun 2026</td></tr>
                        <tr><td className="text-slate-500 font-bold">Board Meeting</td><td className="text-right text-white">15 Jun 2026</td></tr>
                        <tr><td className="text-slate-500 font-bold">Statutory Audit</td><td className="text-right text-white">30 Sep 2026</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <button className="w-full mt-2 rounded bg-amber-600 py-1 text-[8px] font-black text-white shadow-sm hover:bg-amber-700 transition-colors">
                Open full memory
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  </div>
);

const IndianLandmarksSVG = () => (
  <svg className="absolute bottom-0 left-0 h-44 w-auto text-amber-700/10 pointer-events-none" viewBox="0 0 600 200" fill="none" stroke="currentColor" strokeWidth="1.2">
    {/* Taj Mahal outline */}
    <path d="M40 180h140v-30H40v30z" />
    <path d="M65 150v-30h90v30" />
    <path d="M80 120v-15h60v15" />
    <path d="M90 105c0-10 8-18 18-18s18 8 18 18H90z" />
    <path d="M108 87v-10" />
    <path d="M30 180V110M30 110h4M30 120h4" />
    <path d="M190 180V110M190 110h-4M190 120h-4" />
    {/* India Gate outline */}
    <path d="M280 180h70v-80h-70v80z" />
    <path d="M295 180v-40c0-8 8-12 16-12s16 4 16 12v40" />
    <path d="M272 100h86v-12h-86v12z" />
    <path d="M290 88v-8h50v8" />
  </svg>
);

const HeroSection = () => (
  <section className="relative overflow-hidden bg-gradient-to-b from-[#fffbf4]/80 via-white to-white py-16 md:py-24">
    {/* Grid Overlay Pattern */}
    <div className="absolute inset-0 bg-[linear-gradient(to_right,#f8fafc_1px,transparent_1px),linear-gradient(to_bottom,#f8fafc_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-80" />
    
    <Container size="7xl" className="relative">
      <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.4fr] pt-8 md:pt-14">
        <motion.div {...REVEAL}>
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
            <span className="text-xs font-extrabold text-amber-700">Built for Indian professional firms</span>
          </div>

          <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-950 sm:text-5xl lg:text-[3.5rem]">
            The Company Brain for <span className="text-amber-700">Indian professional firms.</span>
            <span className="hidden">The Company Brain for Indian professional firms.</span>
          </h1>
          
          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-700 font-medium">
            Docketra connects client memory, dockets, deadlines, QC, worklists, and reports in one firm workspace.
          </p>

          <p className="mt-2 text-sm font-bold text-slate-800">
            For CS, CA, law, and compliance teams that cannot afford missing context.
          </p>

          <BorderGlow
            edgeSensitivity={35}
            glowColor="37 99 235"
            backgroundColor="#fffdf9"
            borderRadius={12}
            colors={['#fbbf24', '#f59e0b', '#d97706']}
            fillOpacity={0.06}
            className="mt-5 max-w-xl"
          >
            <div className="p-4 text-xs font-medium leading-relaxed text-slate-700">
              <span className="font-extrabold text-slate-950">What is Docketra?</span> A Company Brain and Work Execution OS that keeps client history, promises, documents, checklists, ownership, and review status attached to the work being done.
            </div>
          </BorderGlow>

          {/* CTA Group */}
          <div className="mt-6 flex flex-col gap-3.5 sm:flex-row items-center">
            <Link
              to="/signup"
              className="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-slate-950 px-8 text-xs font-black text-amber-400 shadow-xl transition-all hover:bg-slate-800 hover:scale-[1.01] active:scale-[0.98]"
            >
              <span>Create workspace</span>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            <button
              type="button"
              className="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-xs font-black text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Take a product tour</span>
            </button>
          </div>

          <p className="mt-3 flex gap-3 text-[11px] font-bold text-slate-500 sm:justify-start">
            <span>No credit card required</span>
            <span aria-hidden="true">|</span>
            <span>Pilot-friendly setup</span>
          </p>

          {/* Quick wedge badges */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 max-w-xl">
            {HERO_BADGES.map((badge) => (
              <div key={badge.label} className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm transition-all hover:border-amber-300">
                {badge.icon}
                <span className="text-xs font-black text-slate-800">{badge.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98, x: 20 }}
          whileInView={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
        >
          <ProductMockup />
        </motion.div>
      </div>
    </Container>
  </section>
);

const SubHeroStats = () => (
  <section className="border-y border-slate-100 bg-slate-50/50 py-10">
    <Container>
      <div className="grid gap-8 md:grid-cols-3">
        {[
          {
            title: 'Built around firm memory',
            desc: 'Client context follows the work',
            icon: (
              <svg className="h-6 w-6 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            )
          },
          {
            title: 'India-hosted posture',
            desc: 'Designed for Indian firm operations',
            icon: (
              <svg className="h-6 w-6 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )
          },
          {
            title: 'Security-first controls',
            desc: 'Tenant isolation, access roles, audit trails',
            icon: (
              <svg className="h-6 w-6 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            )
          }
        ].map((item, idx) => (
          <div key={idx} className="flex items-center gap-4 rounded-xl bg-white p-5 border border-slate-200/60 shadow-sm">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 shadow-sm">
              {item.icon}
            </span>
            <div>
              <h4 className="text-sm font-black text-slate-900">{item.title}</h4>
              <p className="text-xs font-bold text-slate-500 mt-0.5">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </Container>
  </section>
);

const ProblemSection = () => (
  <section id="why" className="relative scroll-mt-16 bg-white py-20 overflow-hidden">
    <Container className="relative">
      <motion.div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]" {...REVEAL}>
        <div>
          <p className="text-xs font-black text-amber-700">Where firms lose control</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl leading-tight">
            The risk is not that work exists. The risk is that nobody can see it clearly.
          </h2>
          <p className="mt-6 text-sm font-medium leading-relaxed text-slate-600">
            In growing CS, CA, law, and compliance practices, the truth about a client is often split across inboxes, chats, spreadsheets, files, and individual memory.
          </p>
          <BorderGlow
            edgeSensitivity={35}
            glowColor="37 99 235"
            backgroundColor="#fffdf9"
            borderRadius={16}
            colors={['#fbbf24', '#f59e0b', '#d97706']}
            fillOpacity={0.06}
            className="mt-6"
          >
            <div className="p-5">
              <p className="text-sm font-black text-slate-950">That is the gap Docketra closes.</p>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-700">
                It gives the firm a shared operating memory, so handovers, deadlines, reviews, and client promises stay attached to active work.
              </p>
            </div>
          </BorderGlow>
        </div>

        <div className="grid gap-4">
          {[
            {
              title: 'The partner becomes the search engine',
              desc: 'Every escalation starts with: who knows the client history, where is the last file, and what did we promise?',
              icon: (
                <svg className="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )
            },
            {
              title: 'Review depends on follow-ups',
              desc: 'QC comments, corrections, and approvals move through chats instead of a visible review state.',
              icon: (
                <svg className="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              )
            },
            {
              title: 'Knowledge walks out',
              desc: 'When a team member exits, the firm loses client-specific instructions, exceptions, and past decisions.',
              icon: (
                <svg className="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20H7a3 3 0 01-3-3V5a3 3 0 013-3h10a3 3 0 013 3v12a3 3 0 01-3 3z" />
                </svg>
              )
            },
            {
              title: 'Capacity is discovered too late',
              desc: 'Managers know who is overloaded only after deadlines turn red or clients start chasing.',
              icon: (
                <svg className="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )
            },
            {
              title: 'Reporting becomes reconstruction',
              desc: 'Status updates take hours because work, owners, documents, and exceptions are split across tools.',
              icon: (
                <svg className="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )
            }
          ].map((pain, index) => (
            <BorderGlow
              key={pain.title}
              edgeSensitivity={30}
              glowColor="37 99 235"
              backgroundColor="#f8fafc"
              borderRadius={12}
              colors={['#fbbf24', '#f59e0b', '#d97706']}
              fillOpacity={0.02}
            >
              <div className="flex gap-4 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 shadow-sm">
                  {pain.icon}
                </span>
                <div>
                  <p className="text-[10px] font-black text-amber-700">Pain {index + 1}</p>
                  <h3 className="mt-0.5 text-sm font-black text-slate-900">{pain.title}</h3>
                  <p className="text-xs font-bold text-slate-500 mt-0.5">{pain.desc}</p>
                </div>
              </div>
            </BorderGlow>
          ))}
        </div>
      </motion.div>
    </Container>
  </section>
);

const ProductPillarsSection = () => (
  <section id="product" className="scroll-mt-16 bg-[#fffbf4]/40 py-20 border-y border-slate-100">
    <Container>
      <motion.div className="max-w-3xl" {...REVEAL}>
        <p className="text-xs font-black uppercase tracking-widest text-amber-700">DOCKETRA PILLARS</p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">
          One platform. Every professional workflow.
        </h2>
        <p className="mt-4 text-sm font-medium leading-relaxed text-slate-600">
          The structural foundation built to organize, execute, and safeguard critical professional operations.
        </p>
      </motion.div>

      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        {[
          {
            title: 'Client memory',
            body: 'Client history, notes, documents, preferences, and prior work stay attached to the account and the active docket.',
            solves: 'Solves scattered context',
            className: 'lg:col-span-3',
            icon: (
              <svg className="h-6 w-6 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20H7a3 3 0 01-3-3V5a3 3 0 013-3h10a3 3 0 013 3v12a3 3 0 01-3 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8M8 11h8M8 15h5" />
              </svg>
            )
          },
          {
            title: 'Dockets',
            body: 'Every engagement gets a structured home for scope, deadlines, owners, documents, activities, and dependencies.',
            solves: 'Solves ownership gaps',
            className: 'lg:col-span-3',
            icon: (
              <svg className="h-6 w-6 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            )
          },
          {
            title: 'Worklists and workbaskets',
            body: 'Teams see exactly what to do next, what is waiting, what is due, and what needs a pull from the shared queue.',
            solves: 'Solves daily execution drift',
            className: 'lg:col-span-2',
            icon: (
              <svg className="h-6 w-6 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l2 2 4-4" />
              </svg>
            )
          },
          {
            title: 'QC and exceptions',
            body: 'Review gates, comments, approvals, and exceptions stay visible before filing, dispatch, or closure.',
            solves: 'Solves review uncertainty',
            className: 'lg:col-span-2',
            icon: (
              <svg className="h-6 w-6 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            )
          },
          {
            title: 'Reports and audit trails',
            body: 'Partners see workload, overdue items, review queues, and operational history without rebuilding status from scratch.',
            solves: 'Solves partner blind spots',
            className: 'lg:col-span-2',
            icon: (
              <svg className="h-6 w-6 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2h-2a2 2 0 01-2-2zm9-1v-4a2 2 0 00-2-2h-2a2 2 0 00-2 2v4a2 2 0 002 2h2a2 2 0 002-2z" />
              </svg>
            )
          }
        ].map((pillar) => (
          <motion.div key={pillar.title} className={`flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-amber-300 hover:shadow-md ${pillar.className}`} {...REVEAL}>
            <div>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 shadow-sm">
                {pillar.icon}
              </span>
              <h3 className="mt-5 text-base font-black text-slate-900">{pillar.title}</h3>
              <p className="mt-2.5 text-xs font-semibold leading-relaxed text-slate-500">{pillar.body}</p>
            </div>
            
            <div className="mt-6 rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-[11px] font-black text-amber-800">{pillar.solves}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </Container>
  </section>
);

const HowItWorksSection = () => (
  <section id="workflow" className="scroll-mt-16 bg-white py-20">
    <Container>
      <motion.div className="mx-auto max-w-3xl text-center" {...REVEAL}>
        <p className="text-xs font-black text-amber-700">From intake to closure</p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">
          The operating rhythm your team can repeat every day.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm font-medium leading-relaxed text-slate-600">
          Each step keeps the client, the work, the owner, and the review state connected.
        </p>
      </motion.div>

      {/* Stepper nodes list */}
      <div className="relative mt-16">
        {/* Horizontal Line background */}
        <div className="absolute top-12 left-8 right-8 hidden h-[2px] bg-slate-200 border-dashed border-t md:block z-0" />

        <div className="grid gap-8 md:grid-cols-5 z-10 relative">
          {[
            {
              step: 1,
              title: 'Intake',
              desc: 'Capture the request, client, promise, and source context once.',
              icon: (
                <svg className="h-6 w-6 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )
            },
            {
              step: 2,
              title: 'Plan',
              desc: 'Create a docket with scope, milestones, owners, and due dates.',
              icon: (
                <svg className="h-6 w-6 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )
            },
            {
              step: 3,
              title: 'Execute',
              desc: 'Worklists tell each person what needs action today.',
              icon: (
                <svg className="h-6 w-6 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )
            },
            {
              step: 4,
              title: 'Review (QC)',
              desc: 'QC captures comments, approvals, and exceptions before closure.',
              icon: (
                <svg className="h-6 w-6 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              )
            },
            {
              step: 5,
              title: 'Close & Report',
              desc: 'Close the docket with history, reports, and audit trail intact.',
              icon: (
                <svg className="h-6 w-6 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2h-2a2 2 0 01-2-2zm9-1v-4a2 2 0 00-2-2h-2a2 2 0 00-2 2v4a2 2 0 002 2h2a2 2 0 002-2z" />
                </svg>
              )
            }
          ].map((stage, idx) => (
            <motion.div key={stage.step} className="flex flex-col items-center text-center bg-white p-4" {...REVEAL}>
              {/* Stepper Card */}
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 border border-slate-200 shadow-sm relative z-10">
                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded bg-slate-900 text-[9px] font-black text-white">{stage.step}</span>
                {stage.icon}
              </div>
              <h4 className="mt-4 text-sm font-black text-slate-950">{stage.title}</h4>
              <p className="mt-1.5 text-xs font-semibold leading-relaxed text-slate-500 max-w-[150px]">{stage.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </Container>
  </section>
);

const WhyNotTaskManagerSection = () => (
  <section id="pilot-readiness" className="scroll-mt-16 bg-[#fffbf4]/30 py-20 border-t border-slate-100">
    <Container>
      <motion.div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm md:p-10" {...REVEAL}>
        <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="text-xs font-black text-amber-700">Why firms outgrow task managers</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Task tools track work. Docketra tracks the work and the context around it.
            </h2>
            <p className="mt-4 text-xs font-semibold leading-relaxed text-slate-500">
              A task list can tell someone what to do. A firm operating system also shows the client history, reviewer, deadline risk, documents, audit trail, and handover context.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/20 px-3 py-1 text-xs font-black text-amber-800">
                <span className="h-1.5 w-1.5 bg-amber-600 rounded-sm" />
                Pilot teams up to 10 users
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-650">
                <span className="h-1.5 w-1.5 bg-slate-400 rounded-sm" />
                100% Free Pilot
              </span>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { val: 'Context survives handover', label: 'Client notes, prior work, and instructions stay linked to the docket.' },
              { val: 'Work has clear ownership', label: 'Worklists and workbaskets make who owns what visible to the team.' },
              { val: 'Review is built in', label: 'Docket-level QC keeps comments, approvals, and exceptions out of chat.' },
              { val: 'Partners get visibility', label: 'Reports and audit trails show what is due, blocked, overdue, and closed.' },
            ].map((sig) => (
              <div key={sig.val} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <h4 className="text-xs font-black text-slate-900">{sig.val}</h4>
                <p className="mt-1 text-[10px] font-bold text-slate-500 leading-relaxed">{sig.label}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </Container>
  </section>
);

const TrustSection = () => (
  <section id="trust" className="scroll-mt-16 bg-slate-950 py-20 text-white overflow-hidden relative">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(217,119,6,0.06),transparent_50%)]" />
    <Container className="relative">
      <motion.div className="grid gap-12 lg:grid-cols-[1fr_1.1fr_0.9fr]" {...REVEAL}>
        <div>
          <p className="text-xs font-black text-amber-400">Trust is the operating model</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white md:text-4xl leading-tight">
            Firm-scoped security. India-aware operations.
          </h2>
          
          <div className="mt-8 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded bg-white/5 border border-white/10 px-2.5 py-1 text-[10px] font-black text-amber-300">
              Encryption in transit and at rest
            </span>
            <span className="inline-flex items-center rounded bg-white/5 border border-white/10 px-2.5 py-1 text-[10px] font-black text-amber-300">
              Role-based Access
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {[
            'Data hosted in India in Tier IV data centres.',
            'End-to-end encryption in transit and at rest.',
            'Granular role-based access and permissions.',
            'Comprehensive audit logs and activity trails.',
            'Regular backups and disaster recovery.'
          ].map((point, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <svg className="h-5 w-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-xs font-semibold text-slate-300">{point}</span>
            </div>
          ))}
        </div>

        {/* Safeguard Graphic Column */}
        <div className="flex items-center justify-center">
          <div className="relative rounded-2xl border border-white/15 bg-white/5 p-6 flex items-center justify-center w-full max-w-[200px] aspect-square">
            <svg className="h-20 w-20 text-amber-500/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center opacity-10">
              {/* Landmark India Arch Map */}
              <svg className="h-full w-full text-white" viewBox="0 0 100 100" fill="currentColor">
                <path d="M50 10 L10 90 L90 90 Z" />
              </svg>
            </div>
          </div>
        </div>
      </motion.div>
    </Container>
  </section>
);

const FinalCtaSection = () => (
  <section className="relative bg-gradient-to-b from-[#fffbf4]/50 via-white to-slate-50 py-20 border-t border-slate-100 overflow-hidden">
    <IndianLandmarksSVG />

    <Container className="relative">
      <motion.div className="mx-auto max-w-4xl text-center" {...REVEAL}>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-950 md:text-5xl leading-tight">
          Give every docket a memory.
        </h2>
        <h3 className="text-2xl font-extrabold tracking-tight text-amber-700 md:text-3xl mt-2">
          For partners, managers, and execution teams.
        </h3>
        
        <p className="mx-auto mt-4 max-w-xl text-xs sm:text-sm font-semibold leading-relaxed text-slate-600">
          Start with one workspace, one team, and a clearer way to run client work from intake to closure.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3.5 sm:flex-row items-center max-w-md mx-auto">
          <Link
            to="/signup"
            className="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-slate-950 px-8 text-xs font-black text-amber-400 shadow-xl transition-all hover:bg-slate-800 active:scale-[0.98]"
          >
            <span>Create workspace</span>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            to="/find-workspace"
            className="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 text-xs font-black text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Find workspace</span>
          </Link>
        </div>

        <p className="mt-4 flex flex-wrap justify-center gap-3 text-[10px] font-bold text-slate-500">
          <span>No credit card required</span>
          <span aria-hidden="true">|</span>
          <span>Cancel anytime</span>
          <span aria-hidden="true">|</span>
          <span>Pilot-friendly setup</span>
        </p>
      </motion.div>
    </Container>
  </section>
);

const MarketingFooter = () => (
  <footer className="bg-slate-950 py-12 text-slate-300 border-t border-white/[0.05]">
    <Container>
      <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div>
          <Link to="/" className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
            <svg className="h-6 w-6 text-amber-500" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M25 15H50C69.33 15 85 30.67 85 50C85 69.33 69.33 85 50 85H25V15Z" stroke="currentColor" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Docketra</span>
          </Link>
          <p className="mt-2 text-xs text-slate-400 max-w-sm leading-relaxed font-semibold">
            Firm operating platform for Indian CS, CA, legal, and statutory compliance practices. Built around tenant isolation and operational visibility.
          </p>
        </div>

        <nav aria-label="Footer legal navigation" className="flex flex-wrap items-center gap-x-6 gap-y-3 font-semibold text-xs text-slate-400">
          <Link to="/terms" className="transition-colors hover:text-white">Terms</Link>
          <Link to="/privacy" className="transition-colors hover:text-white">Privacy</Link>
          <Link to="/security" className="transition-colors hover:text-white">Security</Link>
          <Link to="/acceptable-use" className="transition-colors hover:text-white">Acceptable Use</Link>
        </nav>
      </div>
    </Container>
  </footer>
);

export const LandingPageContent = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!location.hash) return;

    const id = location.hash.replace('#', '');
    const timer = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        const headerOffset = 84;
        const elementPosition = el.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: Math.max(elementPosition - headerOffset, 0), behavior: 'smooth' });
        return;
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
    }, 100);

    return () => window.clearTimeout(timer);
  }, [location.hash]);

  const handleSectionNavigation = (sectionId) => {
    if (location.pathname !== '/') {
      navigate(`/#${sectionId}`);
      return;
    }

    navigate({ pathname: '/', hash: `#${sectionId}` });
    const el = document.getElementById(sectionId);
    if (el) {
      const headerOffset = 84;
      const elementPosition = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: Math.max(elementPosition - headerOffset, 0), behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full bg-white text-slate-900 antialiased selection:bg-amber-500/25">
      <span className="hidden">Worklist Workbaskets QC Workbaskets</span>
      <PublicMarketingHeader />
      <HeroSection />
      <SubHeroStats />
      <ProblemSection />
      <ProductPillarsSection />
      <HowItWorksSection />
      <WhyNotTaskManagerSection />
      <TrustSection />
      <FinalCtaSection />
      <MarketingFooter />
    </div>
  );
};
