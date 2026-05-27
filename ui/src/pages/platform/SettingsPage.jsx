import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { ROUTES } from '../../constants/routes';
import { PageSection } from './PlatformShared';

const roleRank = { USER: 1, MANAGER: 2, ADMIN: 3, PRIMARY_ADMIN: 4 };
const hasAtLeastRole = (current, minimum) => (roleRank[current] || 0) >= (roleRank[minimum] || 0);

export const PlatformSettingsPage = () => {
  const { firmSlug } = useParams();
  const { user } = useAuth();
  const normalizedRole = String(user?.role || 'USER').trim().toUpperCase().replace(/[\s-]+/g, '_');
  const settingsItems = [
    {
      title: 'General',
      description: 'Firm profile, identity, branding, and workspace defaults.',
      to: ROUTES.FIRM_SETTINGS(firmSlug),
      action: 'Open',
      minRole: 'ADMIN',
    },
    {
      title: 'Users & Team',
      description: 'Users, roles, access controls, and account safety actions.',
      to: ROUTES.ADMIN(firmSlug),
      action: 'Manage',
      minRole: 'ADMIN',
    },
    {
      title: 'Workbaskets',
      description: 'Primary workbaskets, linked QC queues, and docket routing.',
      to: ROUTES.WORK_SETTINGS(firmSlug),
      action: 'Configure',
      minRole: 'MANAGER',
    },
    {
      title: 'Categories',
      description: 'Docket categories, subcategories, and workbasket routing.',
      to: ROUTES.WORK_CATEGORY_MANAGEMENT(firmSlug),
      action: 'Edit',
      minRole: 'ADMIN',
    },
    {
      title: 'Storage',
      description: 'Firm-owned storage mode, Google Drive connection, and exports.',
      to: ROUTES.STORAGE_SETTINGS(firmSlug),
      action: 'Review',
      minRole: 'ADMIN',
    },
    {
      title: 'Storage Map',
      description: 'Where client, docket, and document data is stored.',
      to: ROUTES.DATA_STORAGE_MAP(firmSlug),
      action: 'View',
      minRole: 'ADMIN',
    },
  ].filter((item) => hasAtLeastRole(normalizedRole, item.minRole));

  return (
    <PlatformShell
      moduleLabel="Settings"
      title="Settings"
      subtitle="Firm configuration and operational controls in one place"
    >
      <PageSection
        title="Settings menu"
        description="Choose the area you want to configure. The sidebar stays clean with one Settings entry, and all setting options are listed here."
      >
        <section className="panel settings-menu" aria-label="Workspace settings menu">
          {settingsItems.map((item) => (
            <Link key={item.title} className="settings-menu__item" to={item.to}>
              <span>
                <span className="settings-menu__label">{item.title}</span>
                <span className="settings-menu__description">{item.description}</span>
              </span>
              <span className="settings-menu__action">{item.action}</span>
            </Link>
          ))}
        </section>
      </PageSection>
    </PlatformShell>
  );
};

export default PlatformSettingsPage;
