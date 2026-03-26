import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Section } from '../../components/layout/Section';

const PRICING_TIERS = [
  {
    name: 'Starter',
    price: 'Free',
    interval: 'forever',
    description: 'Perfect for small teams testing the waters during our Early Access phase.',
    features: ['Up to 2 users (1 Admin + 1 Member)', 'Basic Case Management', 'Standard Workflows', 'Community Support'],
    ctaLabel: 'Get Early Access',
    ctaTo: '/signup',
    disabled: false,
    badge: 'Current Phase',
    highlight: true,
  },
  {
    name: 'Professional',
    price: 'TBA',
    interval: 'coming soon',
    description: 'For growing firms that need advanced operational controls and partner visibility.',
    features: ['Unlimited Users', 'Advanced Role Permissions', 'Custom Workflow Templates', 'Priority Support'],
    ctaLabel: 'Coming Soon',
    ctaTo: null,
    disabled: true,
    badge: 'Roadmap',
    highlight: false,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    interval: 'tailored',
    description: 'For large organizations requiring bespoke governance, scaling, and integrations.',
    features: ['Multi-Office Coordination', 'Dedicated Account Manager', 'Custom API Access', 'On-Premise / Private Cloud Setup'],
    ctaLabel: 'Contact Sales',
    ctaTo: '/contact',
    disabled: false,
    badge: null,
    highlight: false,
  },
];

const SECTION_REVEAL = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: 'easeOut' },
  viewport: { once: true, amount: 0.1 },
};

export const PricingPage = () => (
  <Section>
    <div className="mx-auto mb-12 w-full max-w-2xl px-4 text-center sm:px-6 lg:px-8">
      <h1 className="type-section text-gray-900">Simple, Transparent Pricing</h1>
      <p className="mt-4 type-body text-lg text-gray-600">
        We are currently in Early Access. Join now to lock in your free Starter workspace and help shape the future of Docketra.
      </p>
    </div>

    <motion.div {...SECTION_REVEAL} className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-3">
      {PRICING_TIERS.map((tier, index) => (
        <motion.article
          key={tier.name}
          className={`relative flex h-full w-full flex-col rounded-2xl border p-8 ${
            tier.highlight ? 'border-blue-500 shadow-xl bg-white relative' : 'border-gray-200 bg-gray-50 shadow-sm'
          }`}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: index * 0.1 }}
          viewport={{ once: true }}
        >
          {tier.badge && (
            <span className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
              tier.highlight ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}>
              {tier.badge}
            </span>
          )}

          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900">{tier.name}</h2>
            <div className="mt-4 flex items-baseline text-4xl font-extrabold text-gray-900">
              {tier.price}
              {tier.interval && <span className="ml-1 text-sm font-medium text-gray-500">/{tier.interval}</span>}
            </div>
            <p className="mt-4 min-h-[40px] text-sm text-gray-600">{tier.description}</p>
          </div>

          <ul className="mb-8 flex-1 space-y-4">
            {tier.features.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm text-gray-700">
                <span className="text-green-500 font-bold">✓</span>
                {feature}
              </li>
            ))}
          </ul>

          {tier.disabled ? (
            <button disabled className="w-full rounded-xl bg-gray-200 px-4 py-3 text-sm font-bold text-gray-500 cursor-not-allowed">
              {tier.ctaLabel}
            </button>
          ) : (
            <Link to={tier.ctaTo} className={`w-full flex justify-center items-center rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
              tier.highlight ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-900 text-white hover:bg-gray-800'
            }`}>
              {tier.ctaLabel}
            </Link>
          )}
        </motion.article>
      ))}
    </motion.div>
  </Section>
);
