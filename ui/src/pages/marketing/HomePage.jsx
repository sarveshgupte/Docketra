import React from 'react';
import { Link } from 'react-router-dom';
import Container from '../../components/layout/Container';

const CAPABILITIES = [
  {
    title: 'Track tasks with clear ownership',
    desc: 'Know who is responsible for each step.',
  },
  {
    title: 'Centralize decisions and approvals',
    desc: 'No more chasing updates across tools.',
  },
  {
    title: 'Maintain a complete activity trail',
    desc: 'Every action is recorded and reviewable.',
  },
];

export const HomePage = () => {
  return (
    <div className="w-full bg-white text-gray-900">
      {/* HERO */}
      <section className="w-full bg-white py-16 md:py-20">
        <Container className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] gap-12 items-center">
          
          {/* LEFT */}
          <div className="w-full">
            <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05] text-balance">
              Manage work clearly. Move tasks forward without chaos.
            </h1>

            <p className="mt-6 text-lg text-gray-600 leading-relaxed">
              Track tasks, assign ownership, and ensure nothing falls through the cracks.
            </p>

            <div className="mt-8">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center h-11 px-6 rounded-lg bg-black text-white font-medium hover:bg-gray-900 transition-colors"
              >
                Create your workspace
              </Link>
              <p className="mt-4 text-sm text-gray-500">
                No setup complexity. Start in minutes.
              </p>
            </div>
          </div>

          {/* RIGHT */}
          <div className="w-full">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8">
              <h3 className="text-lg font-semibold text-gray-900">
                Why teams choose Docketra
              </h3>

              <ul className="mt-6 space-y-4 text-sm text-gray-600">
                <li>• Assign clear ownership to every task</li>
                <li>• Track progress across workflows</li>
                <li>• Keep approvals and decisions in one place</li>
                <li>• Maintain a complete audit trail</li>
              </ul>
            </div>
          </div>

        </Container>
      </section>

      {/* WHO IT'S FOR */}
      <section className="w-full bg-white py-16 md:py-20 border-t border-gray-100">
        <Container>
          <div className="max-w-xl">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Built for teams that need structured workflows
            </h2>
            <p className="mt-4 text-gray-600 leading-relaxed">
              Docketra is designed for teams where accountability, approvals, and audit trails matter.
            </p>
          </div>

          <div className="mt-12 grid md:grid-cols-3 gap-6">
            <div className="border rounded-xl p-6 hover:shadow-md transition-shadow">
              <h3 className="font-semibold text-gray-900">
                Compliance & Finance Teams
              </h3>
              <p className="mt-3 text-sm text-gray-600">
                Manage filings, approvals, and deadlines without losing visibility.
              </p>
            </div>

            <div className="border rounded-xl p-6 hover:shadow-md transition-shadow">
              <h3 className="font-semibold text-gray-900">
                Operations Teams
              </h3>
              <p className="mt-3 text-sm text-gray-600">
                Track internal processes, assign ownership, and ensure execution.
              </p>
            </div>

            <div className="border rounded-xl p-6 hover:shadow-md transition-shadow">
              <h3 className="font-semibold text-gray-900">
                Client Service Teams
              </h3>
              <p className="mt-3 text-sm text-gray-600">
                Coordinate work across clients with clear accountability and audit trails.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* FEATURES */}
      <section id="features" className="w-full bg-gray-50 py-16 md:py-20">
        <Container>
          <div className="max-w-xl">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              How Docketra helps your team deliver
            </h2>
            <p className="mt-4 text-lg text-gray-600 leading-relaxed">
              Clear ownership, clear approvals, and a complete audit trail.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {CAPABILITIES.map((item) => (
              <div
                key={item.title}
                className="h-full flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-6 hover:shadow-md transition-shadow"
              >
                <h3 className="text-lg font-semibold text-gray-900">
                  {item.title}
                </h3>
                <p className="mt-4 text-sm text-gray-600">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section id="pricing" className="w-full bg-white py-16 md:py-20 border-t border-gray-100">
        <Container>
          <div className="max-w-xl">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Pricing
            </h2>
            <p className="mt-4 text-gray-600 leading-relaxed">
              Start free and move to advanced controls as your team grows.
            </p>
          </div>

          <div className="mt-12 grid md:grid-cols-3 gap-6 w-full">
            <div className="border rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-lg">Starter</h3>
              <p className="mt-2 text-sm text-gray-600">Free during early access</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li>Up to 2 users</li>
                <li>Basic workflows</li>
                <li>Case management</li>
              </ul>
              <Link
                to="/signup"
                className="mt-6 inline-block rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 transition-colors"
              >
                Create workspace
              </Link>
            </div>

            <div className="border rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-lg">Professional</h3>
              <p className="mt-2 text-sm text-gray-600">For growing teams with more workflow volume</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li>Up to 25 users</li>
                <li>Advanced workflows and approvals</li>
                <li>Priority support</li>
              </ul>
              <p className="mt-6 text-sm font-medium text-gray-500">Coming soon</p>
            </div>

            <div className="border rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-lg">Enterprise</h3>
              <p className="mt-2 text-sm text-gray-600">For larger teams with governance requirements</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li>Unlimited users</li>
                <li>Audit-focused controls</li>
                <li>Dedicated onboarding support</li>
              </ul>
              <p className="mt-6 text-sm font-medium text-gray-500">Custom pricing</p>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
};
