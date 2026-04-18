import React from 'react';
import { PlatformShell } from '../../components/platform/PlatformShell';

export const PlatformSettingsPage = () => (
  <PlatformShell title="Settings" subtitle="Firm controls, mapping, team access and BYO integrations">
    <section className="grid-cards">
      {['Client management', 'Category mapping (service → WB)', 'Team management', 'Access control', 'BYOS / BYOAI'].map((title) => (
        <article className="panel" key={title}><h3>{title}</h3><p className="muted">Configured with role-based visibility and audit-safe updates.</p></article>
      ))}
    </section>
  </PlatformShell>
);

export default PlatformSettingsPage;
