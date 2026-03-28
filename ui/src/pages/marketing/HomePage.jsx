import React from 'react';
import { Link } from 'react-router-dom';
import Container from '../../components/layout/Container';
import './HomePage.css';

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
      <section className="section bg-white">
        <div className="hero-container">
          <div className="hero-left">
            <h1 className="hero-title font-semibold max-w-xl">
              Workflows that actually move work forward.
            </h1>
            <p className="mt-6 text-lg text-gray-600 max-w-md leading-relaxed">
              Track tasks, assign ownership, and ensure nothing falls through the cracks.
            </p>

            <form onSubmit={onEarlyAccessSubmit}>
              <div className="cta-group max-w-md">
                <input
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  className="cta-input border border-gray-300 rounded-lg px-4"
                  required
                />
                <button type="submit" className="cta-button bg-black text-white px-6 rounded-lg whitespace-nowrap">
                  Get Early Access
                </button>
              </div>
            </form>

            <div className="mt-6">
              <Link to="/signup" className="text-sm font-medium text-gray-700 underline hover:text-gray-900">
                Or create your workspace
              </Link>
            </div>
          </div>

          <div className="hero-right">
            <div className="card-preview bg-gray-50 rounded-2xl p-6 border border-gray-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Workflow dashboard</p>
              <div className="mt-6 text-sm text-gray-500">
                Your workflows will appear here
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="section bg-gray-50">
        <Container>
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight">How Docketra helps your team deliver</h2>
            <p className="mt-6 text-lg text-gray-600">Clear ownership, clear approvals, and a complete audit trail.</p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {CAPABILITIES.map((item) => (
              <div key={item.title} className="rounded-xl border border-gray-200 bg-white p-6">
                <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-4 text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>
    </div>
  );
};
