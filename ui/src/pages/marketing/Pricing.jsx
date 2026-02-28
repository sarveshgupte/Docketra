import React from 'react';
import { Link } from 'react-router-dom';

const PRICING_TIERS = [
  {
    name: 'Starter',
    price: 'Free',
    description: 'For small teams. Includes up to 2 users (1 admin + 1 user).',
    ctaLabel: 'Create Free Workspace',
    ctaTo: '/signup',
    disabled: false,
  },
  {
    name: 'Professional',
    price: 'Coming Soon',
    description: 'For growing organizations with advanced operational controls.',
    ctaLabel: 'Coming Soon',
    ctaTo: null,
    disabled: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For large organizations needing advanced governance and scale.',
    ctaLabel: 'Contact Enterprise Team',
    ctaTo: '/contact',
    disabled: false,
  },
];

export const PricingPage = () => (
  <section className="space-y-8">
    <div className="space-y-3">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Pricing</h1>
    </div>

    <div className="grid gap-4 lg:grid-cols-3">
      {PRICING_TIERS.map(({ name, price, description, ctaLabel, ctaTo, disabled }) => (
        <article key={name} className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{name}</h2>
          <p className="mt-2 text-2xl font-semibold text-slate-800">{price}</p>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">{description}</p>

          {disabled ? (
            <button
              type="button"
              disabled
              className="mt-6 inline-flex items-center justify-center rounded-md bg-slate-300 px-4 py-2 text-sm font-medium text-slate-600"
            >
              {ctaLabel}
            </button>
          ) : (
            <Link
              to={ctaTo}
              className="mt-6 inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              {ctaLabel}
            </Link>
          )}
        </article>
      ))}
    </div>
  </section>
);
