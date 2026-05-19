import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { ROUTES } from '../../constants/routes';
import { PageSection } from './PlatformShared';

export const PlatformSettingsPage = () => {
  const { firmSlug } = useParams();

  return (
    <PlatformShell
      moduleLabel="Settings"
      title="Settings"
      subtitle="Firm configuration and operational controls"
      actions={<Link to={ROUTES.ADMIN_REPORTS(firmSlug)}>Audit reports</Link>}
    >
      <PageSection
        title="Workspace settings"
        description="Manage firm profile, work routing, team controls, storage, and AI settings from one place."
      >
        <section className="settings-grid" aria-label="Workspace settings modules">
          <article className="panel settings-card">
            <h3>Firm profile</h3>
            <p className="muted">Manage firm identity, branding, default preferences, and compliance configuration.</p>
            <div className="action-row settings-card__primary-action"><Link to={ROUTES.FIRM_SETTINGS(firmSlug)} aria-label="Open firm profile settings">Open firm settings</Link></div>
          </article>

          <article className="panel settings-card">
            <h3>Work settings</h3>
            <p className="muted">Configure categories, subcategories, routing rules, and workbasket setup.</p>
            <div className="action-row settings-card__primary-action"><Link to={ROUTES.WORK_SETTINGS(firmSlug)} aria-label="Open work settings">Open work settings</Link></div>
          </article>

          <article className="panel settings-card">
            <h3>Team & controls</h3>
            <p className="muted">Manage users, roles, hierarchy, access controls, and audit visibility.</p>
            <div className="action-row settings-card__primary-action">
              <Link to={ROUTES.ADMIN(firmSlug)} aria-label="Open team and access controls">Open team & access</Link>
            </div>
            <p className="settings-card__related-links"><Link to={ROUTES.ADMIN_REPORTS(firmSlug)} aria-label="View audit reports">View audit reports</Link></p>
          </article>

          <article className="panel settings-card">
            <h3>Storage & AI</h3>
            <p className="muted">Manage firm-owned storage, BYOS settings, and AI provider controls.</p>
            <div className="action-row settings-card__primary-action">
              <Link to={ROUTES.STORAGE_SETTINGS(firmSlug)} aria-label="Open storage settings">Open storage settings</Link>
            </div>
            <p className="settings-card__related-links"><Link to={ROUTES.AI_SETTINGS(firmSlug)} aria-label="Open AI settings">AI settings</Link></p>
          </article>
        </section>
      </PageSection>
    </PlatformShell>
  );
};

export default PlatformSettingsPage;
