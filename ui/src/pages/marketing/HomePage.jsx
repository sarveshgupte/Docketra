import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Container from '../../components/layout/Container';

const CAPABILITIES = [
  {
    title: 'Track tasks with clear ownership',
    desc: 'Know who is responsible for each step, from initiation to completion.',
  },
  {
    title: 'Centralize decisions and approvals',
    desc: 'Capture every approval decision in one place with the right context.',
  },
  {
    title: 'Maintain a complete activity trail',
    desc: 'Keep a reliable, reviewable record of task updates and status changes.',
  },
];

const HOW_IT_WORKS = [
  {
    title: 'Create workflow',
    desc: 'Set up structured process stages tailored to your team’s operations.',
  },
  {
    title: 'Assign tasks',
    desc: 'Route work with clear ownership so every item has accountable assignees.',
  },
  {
    title: 'Track progress & approvals',
    desc: 'Monitor status changes and approval milestones without chasing updates.',
  },
];

const FEATURE_ICONS = ['◌', '◎', '◍'];

const HERO_TASKS = [
  { name: 'Review monthly filing checklist', status: 'In Progress', assignee: 'AR', tone: 'text-amber-700 bg-amber-50 border-amber-200' },
  { name: 'Collect final sign-off from approver', status: 'Pending', assignee: 'KP', tone: 'text-slate-700 bg-slate-100 border-slate-200' },
  { name: 'Submit compliance packet', status: 'Done', assignee: 'SJ', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { name: 'Attach supporting documents', status: 'In Progress', assignee: 'MN', tone: 'text-amber-700 bg-amber-50 border-amber-200' },
];

const statusDotMap = {
  Pending: 'bg-slate-400',
  'In Progress': 'bg-amber-500',
  Done: 'bg-emerald-500',
};

export const HomePage = () => {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) {
      return undefined;
    }

    const id = location.hash.replace('#', '');
    const timer = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);

    return () => window.clearTimeout(timer);
  }, [location.hash]);

  return (
    <div className="w-full bg-white text-gray-900">
      {/* HERO */}
      <section className="w-full bg-white py-20 md:py-28">
        <Container className="grid grid-cols-1 md:grid-cols-[1.3fr_0.7fr] gap-12 md:gap-16 items-center">
          <div className="w-full">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-tight max-w-none">
              Manage work clearly. Move every task forward with confidence.
            </h1>

            <p className="mt-6 md:mt-8 text-base sm:text-lg text-gray-600 leading-relaxed max-w-xl md:max-w-2xl">
              Docketra helps teams run structured workflows, assign accountable owners, and keep approvals moving without chaos.
            </p>

            <div className="mt-10 flex flex-col items-start gap-4">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center h-11 px-6 rounded-lg bg-black text-white font-medium shadow-md hover:shadow-lg hover:bg-gray-900 transition-colors"
              >
                Create your workspace
              </Link>
              <p className="text-sm text-gray-500">
                No setup complexity. Start in minutes.
              </p>
            </div>
          </div>

          <div className="w-full">
            <div className="rounded-2xl border border-gray-200 bg-white/95 backdrop-blur shadow-md p-4 sm:p-5 md:p-6">
              <div className="flex items-center justify-between pb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Live workflow</p>
                  <h3 className="mt-1 text-sm font-semibold text-gray-900">Month-end Operations</h3>
                </div>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                  4 active tasks
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {HERO_TASKS.map((task) => (
                  <div key={task.name} className="rounded-lg bg-white p-3 sm:p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 text-sm font-medium text-gray-900 leading-snug break-words">{task.name}</p>
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[11px] font-semibold text-white">
                        {task.assignee}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${statusDotMap[task.status]}`} aria-hidden="true" />
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${task.tone}`}>
                        {task.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* HOW IT WORKS */}
      <section className="w-full bg-gray-50 py-24 md:py-28 border-t border-gray-100">
        <Container>
          <div className="grid gap-16">
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight">How it works</h2>
              <p className="mt-4 text-gray-600 leading-relaxed">
                Launch a reliable workflow in minutes and keep every stakeholder aligned from start to completion.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {HOW_IT_WORKS.map((step, index) => (
                <div key={step.title} className="h-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 text-sm font-semibold text-gray-700">
                    {index + 1}
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-gray-900">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-gray-600">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* FEATURES */}
      <section id="features" className="w-full bg-gray-50 py-24 md:py-28 border-t border-gray-100">
        <Container>
          <div className="grid gap-16">
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight">
                How Docketra helps your team deliver
              </h2>
              <p className="mt-4 text-gray-600 leading-relaxed">
                Clear ownership, clear approvals, and a complete audit trail.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 md:gap-8 lg:gap-6">
              {CAPABILITIES.map((item, index) => (
                <div
                  key={item.title}
                  className="h-full flex flex-col rounded-xl border border-gray-200 bg-white p-7 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 text-base text-gray-600">
                    {FEATURE_ICONS[index]}
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-gray-900">
                    {item.title}
                  </h3>
                  <p className="mt-4 text-sm text-gray-600 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* PRICING */}
      <section id="pricing" className="w-full bg-white py-24 md:py-28 border-t border-gray-100">
        <Container>
          <div className="grid gap-16">
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight">
                Pricing
              </h2>
              <p className="mt-4 text-gray-600 leading-relaxed">
                Start free and move to advanced controls as your team grows.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 md:gap-10 w-full items-stretch">
              <div className="h-full border border-gray-200 ring-1 ring-black/5 md:scale-[1.02] bg-white rounded-xl p-6 md:p-7 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col">
                <h3 className="font-semibold text-lg">Starter</h3>
                <p className="mt-2 text-sm text-gray-600">Free during early access</p>
                <ul className="mt-5 space-y-2 text-sm text-gray-600">
                  <li>Up to 2 users</li>
                  <li>Basic workflows</li>
                  <li>Case management</li>
                </ul>
                <Link
                  to="/signup"
                  className="mt-auto pt-6 inline-block rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 transition-colors"
                >
                  Create workspace
                </Link>
              </div>

              <div className="h-full border border-gray-200 bg-white rounded-xl p-6 md:p-7 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col">
                <h3 className="font-semibold text-lg">Professional</h3>
                <p className="mt-2 text-sm text-gray-600">Coming soon</p>
                <ul className="mt-5 space-y-2 text-sm text-gray-600">
                  <li>Up to 25 users</li>
                  <li>Advanced workflows and approvals</li>
                  <li>Priority support</li>
                </ul>
                <p className="mt-auto pt-6 text-sm font-medium text-gray-500">Coming soon</p>
              </div>

              <div className="h-full border border-gray-200 bg-white rounded-xl p-6 md:p-7 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col">
                <h3 className="font-semibold text-lg">Enterprise</h3>
                <p className="mt-2 text-sm text-gray-600">Coming soon</p>
                <ul className="mt-5 space-y-2 text-sm text-gray-600">
                  <li>Unlimited users</li>
                  <li>Audit-focused controls</li>
                  <li>Dedicated onboarding support</li>
                </ul>
                <p className="mt-auto pt-6 text-sm font-medium text-gray-500">Coming soon</p>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
};
