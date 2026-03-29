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
    if (!location.hash) return;

    const id = location.hash.replace('#', '');
    const timer = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    return () => window.clearTimeout(timer);
  }, [location.hash]);

  return (
    <div className="w-full bg-white text-gray-900">

      {/* HERO */}
      <section className="w-full bg-white py-16 md:py-24">
        <Container className="grid min-w-0 grid-cols-1 gap-10 md:grid-cols-12 md:gap-8 lg:gap-12 items-start">

          {/* LEFT */}
          <div className="w-full min-w-0 md:col-span-7 lg:col-span-8">

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.06] max-w-none">
              Manage work clearly. Move every task forward with confidence.
            </h1>

            <p className="mt-6 md:mt-8 text-base sm:text-lg text-gray-600 leading-relaxed max-w-none">
              Docketra helps teams run structured workflows, assign accountable owners, and keep approvals moving without chaos.
            </p>

            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row sm:items-center items-start gap-3 sm:gap-4">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center h-11 px-6 rounded-lg bg-black text-white text-sm sm:text-base font-medium shadow-md hover:shadow-lg hover:bg-gray-900 transition-colors"
              >
                Create your workspace
              </Link>

              <p className="text-sm text-gray-500">
                No setup complexity. Start in minutes.
              </p>
            </div>
          </div>

          {/* RIGHT */}
          <div className="w-full min-w-0 md:col-span-5 lg:col-span-4">
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 sm:p-5 md:p-6">

              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-gray-500">
                    Live workflow
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-gray-900">
                    Month-end Operations
                  </h3>
                </div>

                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                  4 active tasks
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {HERO_TASKS.map((task) => (
                  <div
                    key={task.name}
                    className="rounded-lg border border-gray-100 bg-white p-3 sm:p-3.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 text-sm font-medium text-gray-900 leading-snug">
                        {task.name}
                      </p>

                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[11px] font-semibold text-white">
                        {task.assignee}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${statusDotMap[task.status]}`} />
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
      <section className="w-full bg-gray-50 py-20 md:py-24 border-t border-gray-100">
        <Container>
          <div className="grid gap-16">
            <div>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight">
                How it works
              </h2>
              <p className="mt-4 text-gray-600 leading-relaxed">
                Launch a reliable workflow in minutes and keep every stakeholder aligned from start to completion.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {HOW_IT_WORKS.map((step, index) => (
                <div key={step.title} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 text-sm font-semibold text-gray-700">
                    {index + 1}
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-gray-900">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm text-gray-600">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* FEATURES */}
      <section id="features" className="w-full bg-gray-50 py-20 md:py-24 border-t border-gray-100">
        <Container>
          <div className="grid gap-16">
            <div>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight">
                How Docketra helps your team deliver
              </h2>
              <p className="mt-4 text-gray-600">
                Clear ownership, clear approvals, and a complete audit trail.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 md:gap-8">
              {CAPABILITIES.map((item, index) => (
                <div key={item.title} className="rounded-xl border border-gray-200 bg-white p-7 shadow-sm">
                  <span className="inline-flex h-10 min-w-10 px-3 items-center justify-center rounded-lg bg-gray-50 text-xs font-semibold">
                    {`0${index + 1}`}
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-gray-900">
                    {item.title}
                  </h3>
                  <p className="mt-4 text-sm text-gray-600">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* PRICING */}
      <section id="pricing" className="w-full bg-white py-20 md:py-24 border-t border-gray-100">
        <Container>
          <div className="grid gap-16">
            <div>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight">
                Pricing
              </h2>
              <p className="mt-4 text-gray-600">
                Start free and move to advanced controls as your team grows.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 md:gap-10">
              <div className="border border-gray-200 rounded-xl p-6 md:p-7 shadow-sm">
                <h3 className="font-semibold text-lg">Starter</h3>
                <p className="mt-2 text-sm text-gray-600">Free during early access</p>
                <Link to="/signup" className="mt-6 inline-block bg-black text-white px-4 py-2 rounded-lg">
                  Create workspace
                </Link>
              </div>

              <div className="border border-gray-200 rounded-xl p-6 md:p-7 shadow-sm">
                <h3 className="font-semibold text-lg">Professional</h3>
                <p className="mt-2 text-sm text-gray-600">Coming soon</p>
              </div>

              <div className="border border-gray-200 rounded-xl p-6 md:p-7 shadow-sm">
                <h3 className="font-semibold text-lg">Enterprise</h3>
                <p className="mt-2 text-sm text-gray-600">Coming soon</p>
              </div>
            </div>
          </div>
        </Container>
      </section>

    </div>
  );
};
