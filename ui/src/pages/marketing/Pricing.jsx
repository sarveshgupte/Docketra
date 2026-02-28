import React from 'react';
import { Link } from 'react-router-dom';

const PRICING_TIERS = [
  {
    name: 'Starter',
    price: 'Custom',
    description: 'For early-stage teams getting started with structured case operations.',
    ctaLabel: 'Start Free Trial',
    ctaTo: '/contact',
  },
  {
    name: 'Professional',
    price: 'Custom',
    description: 'For growing organizations that need role-scoped controls and deeper process rigor.',
    ctaLabel: 'Talk to Sales',
    ctaTo: 'mailto:demo@docketra.com',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For large, governance-heavy teams needing multi-tenant scale and advanced oversight.',
    ctaLabel: 'Book Enterprise Demo',
    ctaTo: 'mailto:demo@docketra.com',
  },
];

export const PricingPage = () => (
  <section className="space-y-8">
    <div className="space-y-3">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Pricing</h1>
      <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
        Placeholder packaging for upcoming plans. Final pricing and billing integration will be introduced in a future release.
      </p>
    </div>

    <div className="grid gap-4 lg:grid-cols-3">
      {PRICING_TIERS.map(({ name, price, description, ctaLabel, ctaTo }) => (
        <article key={name} className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{name}</h2>
          <p className="mt-2 text-2xl font-semibold text-slate-800">{price}</p>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">{description}</p>

          {ctaTo.startsWith('mailto:') ? (
            <a
              href={ctaTo}
              className="mt-6 inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              {ctaLabel}
            </a>
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
