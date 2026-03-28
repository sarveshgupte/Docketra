import React from 'react';
import { Link } from 'react-router-dom';
import { Section } from '../../components/layout/Section';
import Container from '../../components/layout/Container';

const CHALLENGES = [
  {
    title: 'Scattered work across tools',
    desc: 'Tasks, approvals, and updates are spread across chats, docs, and inboxes.',
  },
  {
    title: 'Unclear ownership',
    desc: 'Teams lose momentum when accountability is not visible at every step.',
  },
  {
    title: 'Late risk discovery',
    desc: 'Missed deadlines are often discovered after customer timelines are impacted.',
  },
];

const CAPABILITIES = [
  {
    title: 'Track every workflow stage',
    desc: 'Move work forward with clear status, owners, and due dates.',
  },
  {
    title: 'Assign and review with context',
    desc: 'Keep decisions, approvals, and updates in one shared place.',
  },
  {
    title: 'Stay audit-ready',
    desc: 'Maintain a complete activity trail across teams and cases.',
  },
];

const FAQS = [
  {
    q: 'How quickly can we start?',
    a: 'Most teams can configure a workspace and launch their first workflow in minutes.',
  },
  {
    q: 'Can teams customize workflows?',
    a: 'Yes. You can customize stages, ownership, and approvals by workflow.',
  },
  {
    q: 'Is Docketra secure?',
    a: 'Docketra supports role-based access, encryption, and detailed activity logs.',
  },
];

export const HomePage = () => {
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
    <div className="w-full bg-white text-gray-900">
      <section className="py-20 bg-white">
        <Container>
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="max-w-2xl">
              <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                Launching soon • Early access open
              </span>
              <h1 className="mt-6 text-5xl font-semibold leading-tight tracking-tight">
                Workflows that actually move work forward.
              </h1>
              <p className="mt-6 text-lg text-gray-600">
                Track tasks, assign ownership, and ensure nothing falls through the cracks — all in one place.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/signup" className="rounded-lg bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-black">
                  Get Early Access
                </Link>
                <a href="#how-it-works" className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  See how it works
                </a>
              </div>

              <form onSubmit={onEarlyAccessSubmit} className="mt-8 max-w-md" aria-label="Early access signup">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="email"
                    name="email"
                    placeholder="Enter your email"
                    className="flex-1 border rounded-lg px-4 py-2"
                    required
                  />
                  <button type="submit" className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:bg-black whitespace-nowrap">
                    Get Early Access
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Workflow dashboard</p>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">Live</span>
              </div>

              <div className="mt-6 grid gap-6 sm:grid-cols-3">
                {[{ label: 'Open tasks', value: '142' }, { label: 'Due this week', value: '26' }, { label: 'Awaiting review', value: '9' }].map((item) => (
                  <div key={item.label} className="rounded-lg bg-gray-50 p-4">
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-3">
                {['New client onboarding', 'Monthly reporting review', 'Vendor contract renewal'].map((row) => (
                  <div key={row} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-3">
                    <p className="truncate pr-3 text-sm text-gray-700">{row}</p>
                    <span className="text-xs font-medium text-indigo-600">In progress</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </section>

      <Section muted>
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight">Why teams lose momentum</h2>
          <p className="mt-6 text-lg text-gray-600">Docketra keeps execution predictable by replacing fragmented updates with a single operating view.</p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {CHALLENGES.map((item) => (
            <div key={item.title} className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
              <p className="mt-6 text-sm text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="how-it-works">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight">How Docketra helps your team deliver</h2>
          <p className="mt-6 text-lg text-gray-600">Unify planning, ownership, and execution across every workflow.</p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {CAPABILITIES.map((item) => (
            <div key={item.title} className="rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
              <p className="mt-6 text-sm text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section muted>
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight">Questions answered</h2>
        </div>
        <div className="mt-10 rounded-xl border border-gray-200 bg-white p-6">
          <div className="space-y-6">
            {FAQS.map((item) => (
              <div key={item.q}>
                <h3 className="text-base font-semibold text-gray-900">{item.q}</h3>
                <p className="mt-2 text-sm text-gray-600">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </div>
  );
};
