import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Section } from '../../components/layout/Section';

const SECTION_REVEAL = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: 'easeOut' },
  viewport: { once: true, amount: 0.1 },
};

export const PricingPage = () => (
  <Section>
    <div className="mb-12">
      <h1 className="type-section text-gray-900">Early Access Pricing</h1>
      <p className="mt-4 type-body text-lg text-gray-600">
        Docketra is currently free while in testing. Billing and subscriptions are not live yet.
      </p>
    </div>

    <motion.div {...SECTION_REVEAL} className="grid w-full gap-8 lg:grid-cols-2">
      <article className="relative flex h-full w-full flex-col rounded-2xl border-2 border-blue-500 p-8 bg-white shadow-xl">
        <span className="absolute -top-3 left-6 rounded-full bg-blue-600 text-white px-3 py-1 text-xs font-bold uppercase tracking-wide">
          Current phase
        </span>
        <div className="mb-10 mt-4">
          <h2 className="text-xl font-bold text-gray-900">Early Access</h2>
          <div className="mt-4 flex items-baseline text-4xl font-extrabold text-gray-900">
            Free
          </div>
          <p className="mt-3 text-sm text-gray-600">
            Use Docketra during testing and help shape the product roadmap.
          </p>
        </div>

        <ul className="mb-10 flex-1 space-y-4">
          {[
            'No billing setup yet',
            'No subscription checkout flow',
            'Access to CMS + CRM + Tasks operating flow',
            'Direct product feedback channel',
          ].map((feature) => (
            <li key={feature} className="flex items-start gap-3 text-sm text-gray-700">
              <span className="text-green-500 font-bold">✓</span>
              {feature}
            </li>
          ))}
        </ul>

        <Link to="/signup" className="w-full flex justify-center items-center rounded-xl px-4 py-3 text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors">
          Request Early Access
        </Link>
      </article>

      <article className="rounded-2xl border border-gray-200 bg-gray-50 p-8">
        <h3 className="text-lg font-semibold text-gray-900">Future Pricing</h3>
        <p className="mt-3 text-sm text-gray-600 leading-relaxed">
          Commercial plans will be shared after testing milestones are complete. We are keeping
          pricing simple and transparent until billing infrastructure is ready.
        </p>
        <p className="mt-6 text-sm text-gray-700">
          Questions? Email{' '}
          <a href="mailto:sarveshgupte@gmail.com" className="underline">
            sarveshgupte@gmail.com
          </a>
          .
        </p>
      </article>
    </motion.div>
  </Section>
);
