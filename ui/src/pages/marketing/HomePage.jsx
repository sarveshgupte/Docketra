import React from 'react';
import { Link } from 'react-router-dom';
import Container from '../../components/layout/Container';
import Navbar from '../../components/layout/Navbar';

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
      <Navbar />
      {/* HERO */}
      <section className="w-full bg-white py-20 md:py-28">
        <Container className="grid grid-cols-1 md:grid-cols-[1.3fr_0.7fr] gap-12 items-center">
          
          {/* LEFT */}
          <div className="w-full">
            <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05] text-balance">
              Workflows that actually move work forward.
            </h1>

            <p className="mt-6 text-lg text-gray-600 leading-relaxed">
              Track tasks, assign ownership, and ensure nothing falls through the cracks.
            </p>

            <div className="mt-8">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center h-11 px-6 rounded-lg bg-black text-white font-medium hover:bg-gray-900 transition-colors"
              >
                Start your workspace
              </Link>
            </div>
          </div>

          {/* RIGHT */}
          <div className="w-full">
            <div className="rounded-2xl border bg-white shadow-md p-6 min-h-[320px] flex flex-col">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Workflow dashboard
              </p>

              <div className="mt-6 text-sm text-gray-500">
                Your workflows will appear here
              </div>

              <div className="mt-6 space-y-4 flex-1">
                <div className="h-3 w-2/3 rounded-full bg-gray-100" />
                <div className="h-3 w-1/2 rounded-full bg-gray-100" />
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="h-16 rounded-lg bg-gray-100" />
                  <div className="h-16 rounded-lg bg-gray-100" />
                  <div className="h-16 rounded-lg bg-gray-100" />
                </div>
              </div>
            </div>
          </div>

        </Container>
      </section>

      {/* FEATURES */}
      <section id="how-it-works" className="w-full bg-gray-50 py-20 md:py-28">
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
    </div>
  );
};
