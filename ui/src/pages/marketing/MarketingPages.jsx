import React from 'react';
import { Link } from 'react-router-dom';

const MarketingPage = ({ title, description }) => (
  <section>
    <h1>{title}</h1>
    <p>{description}</p>
    <p style={{ marginTop: '1rem' }}>
      <Link to="/login">Go to Login</Link>
    </p>
  </section>
);

export const MarketingHomePage = () => (
  <MarketingPage
    title="Welcome to Docketra"
    description="Case and workflow operations for modern legal teams."
  />
);

export const MarketingFeaturesPage = () => (
  <MarketingPage
    title="Features"
    description="Track cases, monitor workload, and streamline firm operations."
  />
);

export const MarketingPricingPage = () => (
  <MarketingPage
    title="Pricing"
    description="Flexible plans for growing firms and enterprise legal operations."
  />
);
