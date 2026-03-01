import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Section } from '../../components/layout/Section';

const PRICING_TIERS = [
  {
    name: 'Starter',
    price: 'Free',
    description: 'For small teams. Includes up to 2 users (1 admin + 1 user).',
    ctaLabel: 'Request Early Access',
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

const SECTION_REVEAL = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
  viewport: { once: true, amount: 0.2 },
};

export const PricingPage = () => (
  <Section>
    <div>
      <h1 className="type-section">Pricing</h1>
    </div>

    <motion.div
      {...SECTION_REVEAL}
      className="grid gap-8 lg:grid-cols-3"
      style={{ marginTop: 'var(--space-md)' }}
    >
      {PRICING_TIERS.map(({ name, price, description, ctaLabel, ctaTo, disabled }, index) => (
        <motion.article
          key={name}
          className="marketing-card flex h-full flex-col p-8"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: Math.min(index * 0.06, 0.2), ease: [0.4, 0, 0.2, 1] }}
          viewport={{ once: true, amount: 0.2 }}
        >
          <h2 className="type-card-title">{name}</h2>
          <p className="mt-6 text-3xl font-semibold leading-tight tracking-tight text-gray-900">{price}</p>
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
              className="marketing-btn-primary mt-8 inline-flex items-center justify-center px-4 py-2 text-sm font-medium"
            >
              {ctaLabel}
            </Link>
          )}
        </motion.article>
      ))}
    </motion.div>
  </Section>
);
