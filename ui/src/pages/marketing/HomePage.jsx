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
      <section className="w-full bg-white py-20 md:py-28">
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
                Built for teams that need clarity
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

      {/* FEATURES */}
      <section id="features" className="w-full bg-gray-50 py-20 md:py-28">
        <Container>
          <div className="w-full">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              How Docketra helps your team deliver
            </h2>
            <p className="mt-6 text-lg text-gray-600 leading-relaxed">
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

      <section id="pricing" className="w-full bg-white py-20 md:py-28 border-t border-gray-100">
        <Container>
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Pricing
            </h2>
            <p className="mt-6 text-gray-600">
              Start free. Scale as your team grows.
            </p>
          </div>

          <div className="mt-12 grid md:grid-cols-3 gap-6">
            <div className="border rounded-xl p-6">
              <h3 className="font-semibold">Starter</h3>
              <p className="mt-2 text-sm text-gray-600">Free during early access</p>
            </div>

            <div className="border rounded-xl p-6 opacity-60">
              <h3 className="font-semibold">Professional</h3>
              <p className="mt-2 text-sm text-gray-600">Coming soon</p>
            </div>

            <div className="border rounded-xl p-6 opacity-60">
              <h3 className="font-semibold">Enterprise</h3>
              <p className="mt-2 text-sm text-gray-600">Custom pricing</p>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
};
