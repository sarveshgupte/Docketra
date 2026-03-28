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

            <form onSubmit={onEarlyAccessSubmit} className="mt-8 max-w-md">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <input
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  className="h-11 w-full rounded-lg border border-gray-300 px-4 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  required
                />
                <button
                  type="submit"
                  className="h-11 w-full sm:w-auto rounded-lg bg-black px-6 text-white whitespace-nowrap hover:bg-gray-900 transition-colors"
                >
                  Get Early Access
                </button>
              </div>
            </form>

            <div className="flex items-center gap-4 mt-6">
              <Link
                to="/signup"
                className="text-sm font-medium text-gray-700 underline underline-offset-4 hover:text-gray-900"
              >
                Or create your workspace
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
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              How Docketra helps your team deliver
            </h2>
            <p className="mt-6 text-lg text-gray-600 max-w-lg">
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
