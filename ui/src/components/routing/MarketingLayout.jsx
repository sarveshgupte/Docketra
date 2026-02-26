import React from 'react';
import { Link, Outlet } from 'react-router-dom';

export const MarketingLayout = () => {
  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <header style={{ borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
        <nav style={{ maxWidth: '960px', margin: '0 auto', padding: '1rem', display: 'flex', gap: '1rem' }}>
          <Link to="/">Home</Link>
          <Link to="/features">Features</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/login">Login</Link>
        </nav>
      </header>
      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1rem' }}>
        <Outlet />
      </main>
    </div>
  );
};
