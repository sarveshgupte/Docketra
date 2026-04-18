import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { ROUTES } from '../../constants/routes';
import { PageSection } from './PlatformShared';

export const PlatformSettingsPage = () => {
  const { firmSlug } = useParams();

  return (
    <PlatformShell
      title="Settings"
      subtitle="Firm configuration and operational controls"
      actions={<Link to={ROUTES.ADMIN_REPORTS(firmSlug)}>Audit reports</Link>}
    >
      <PageSection title="Configuration areas" description="Use these sections to maintain secure and predictable workflows.">
        <section className="grid-cards">
          <article className="panel">
            <h3>Firm profile</h3>
            <p className="muted">Branding, default settings, and compliance configuration.</p>
            <div className="action-row"><Link to={ROUTES.FIRM_SETTINGS(firmSlug)}>Open firm settings</Link></div>
          </article>

          <article className="panel">
            <h3>Work settings</h3>
            <p className="muted">Category mapping, routing, and workbasket setup.</p>
            <div className="action-row"><Link to={ROUTES.WORK_SETTINGS(firmSlug)}>Open work settings</Link></div>
          </article>

          <article className="panel">
            <h3>Admin controls</h3>
            <p className="muted">User, role, and hierarchy administration.</p>
            <div className="action-row"><Link to={ROUTES.ADMIN(firmSlug)}>Open admin panel</Link></div>
          </article>

          <article className="panel">
            <h3>Storage & AI integrations</h3>
            <p className="muted">Manage BYOS and AI provider controls for your firm.</p>
            <div className="action-row">
              <Link to={ROUTES.STORAGE_SETTINGS(firmSlug)}>Storage settings</Link>
              <Link to={ROUTES.AI_SETTINGS(firmSlug)}>AI settings</Link>
            </div>
          </article>
        </section>
      </PageSection>
    </PlatformShell>
  );
};

export default PlatformSettingsPage;
