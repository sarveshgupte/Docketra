import React from 'react';
import { Link } from 'react-router-dom';
import { Section } from '../../components/layout/Section';

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
  <Section>
    <div>
      <h1 className="type-section">Pricing</h1>
    </div>

    <div className="mt-8 grid gap-12 lg:grid-cols-3">
      {PRICING_TIERS.map(({ name, price, description, ctaLabel, ctaTo, disabled }) => (
        <article key={name} className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-8 shadow-md hover:shadow-xl transition-shadow duration-300">
          <h2 className="type-card-title">{name}</h2>
          <p className="mt-6 text-3xl font-semibold tracking-tight leading-tight text-gray-900">{price}</p>
          <p className="mt-6 flex-1 type-body">{description}</p>

          {disabled ? (
            <button
              type="button"
              disabled
              className="mt-8 inline-flex items-center justify-center rounded-xl bg-gray-200 px-4 py-2 text-sm font-medium text-gray-500"
            >
              {ctaLabel}
            </button>
          ) : (
            <Link
              to={ctaTo}
              className="mt-8 inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:scale-[1.02] hover:bg-black active:scale-[0.98]"
            >
              {ctaLabel}
            </Link>
          )}
        </article>
      ))}
    </div>
  </Section>
);
