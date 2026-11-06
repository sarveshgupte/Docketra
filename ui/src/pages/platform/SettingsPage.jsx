import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import useStorageStatusSummary from '../../hooks/useStorageStatusSummary';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { PageSection } from './PlatformShared';
import { ROUTES } from '../../constants/routes';
import {
  Building2,
  CreditCard,
  Users,
  Layers,
  Tag,
  HardDrive,
  Map,
  ShieldCheck,
  Search,
  CheckCircle2,
  Lock,
} from '../../components/onboarding/OnboardingIcons';

const roleRank = { USER: 1, MANAGER: 2, ADMIN: 3, PRIMARY_ADMIN: 4 };
const hasAtLeastRole = (current, minimum) => (roleRank[current] || 0) >= (roleRank[minimum] || 0);

const GROUPS = [
  { id: 'identity', title: '1. Practice Identity & Subscription' },
  { id: 'team', title: '2. Team & Access Controls' },
  { id: 'operations', title: '3. Operations & Statutory Routing' },
  { id: 'storage', title: '4. Zero-Custody Storage Governance' },
];

export const PlatformSettingsPage = () => {
  const { firmSlug } = useParams();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const normalizedRole = String(user?.role || 'USER').trim().toUpperCase().replace(/[\s-]+/g, '_');
  const isPrimary = normalizedRole === 'PRIMARY_ADMIN' || Boolean(user?.isPrimaryAdmin);
  const firmName = user?.firmName || user?.firm?.name || 'Firm Workspace';
  const practiceType = String(user?.firm?.practiceType || 'PCS').toUpperCase();

  const storageSummary = useStorageStatusSummary(firmSlug);
  const isStorageDrive = Boolean(
    storageSummary?.isGoogleDriveConnected
    || storageSummary?.provider === 'google_drive'
    || storageSummary?.provider === 'google-drive'
  );

  const settingsItems = [
    {
      title: 'General',
      description: 'Firm profile, identity, branding, and workspace defaults.',
      to: ROUTES.FIRM_SETTINGS(firmSlug),
      action: 'Open',
      minRole: 'ADMIN',
      group: 'identity',
      icon: Building2,
      badge: 'Practice Defaults',
      hint: 'Firm Profile & Specialization',
    },
    {
      title: 'Plans & Billing',
      description: 'Subscription tier, seat capacity, invoices, and UPI payment renewal.',
      to: `${ROUTES.FIRM_SETTINGS(firmSlug)}?tab=plan`,
      action: 'Upgrade',
      minRole: 'ADMIN',
      group: 'identity',
      icon: CreditCard,
      badge: 'Active Tier',
      hint: 'Pilot Evaluation & Quotas',
    },
    {
      title: 'Users & Team',
      description: 'Users, roles, access controls, and account safety actions.',
      to: ROUTES.ADMIN(firmSlug),
      action: 'Manage',
      minRole: 'ADMIN',
      group: 'team',
      icon: Users,
      badge: 'RBAC Safety',
      hint: 'Partners, Managers, Trainees',
    },
    {
      title: 'Organization Structure',
      description: 'Interactive firm org chart, reporting lines, direct reports, and team headcount.',
      to: ROUTES.HIERARCHY(firmSlug),
      action: 'View',
      minRole: 'USER',
      group: 'team',
      icon: Users,
      badge: 'Org Chart',
      hint: 'Reporting lines & Headcount',
    },
    {
      title: 'Workbaskets',
      description: 'Primary workbaskets, linked QC queues, and docket routing.',
      to: ROUTES.WORK_SETTINGS(firmSlug),
      action: 'Configure',
      minRole: 'MANAGER',
      group: 'operations',
      icon: Layers,
      badge: 'Maker-Checker',
      hint: 'Routing & Partner QC',
    },
    {
      title: 'Categories',
      description: 'Docket categories, subcategories, and workbasket routing.',
      to: ROUTES.WORK_CATEGORY_MANAGEMENT(firmSlug),
      action: 'Edit',
      minRole: 'ADMIN',
      group: 'operations',
      icon: Tag,
      badge: 'Statutory Blueprints',
      hint: 'MCA, ROC, GST & Tax Audit',
    },
    {
      title: 'Storage',
      description: 'Firm-owned storage mode, Google Drive connection, and exports.',
      to: ROUTES.STORAGE_SETTINGS(firmSlug),
      action: 'Review',
      minRole: 'ADMIN',
      group: 'storage',
      icon: HardDrive,
      badge: isStorageDrive ? 'Zero-Custody BYOS' : 'Encrypted Cloud',
      hint: isStorageDrive ? 'Restricted drive.file isolation' : 'Standard encrypted storage',
    },
    {
      title: 'Storage Map',
      description: 'Where client, docket, and document data is stored.',
      to: ROUTES.DATA_STORAGE_MAP(firmSlug),
      action: 'View',
      minRole: 'ADMIN',
      group: 'storage',
      icon: Map,
      badge: 'Physical Topology',
      hint: 'Folder Audit & Data Residencies',
    },
  ];

  const visibleItems = useMemo(() => {
    return settingsItems.filter((item) => hasAtLeastRole(normalizedRole, item.minRole));
  }, [normalizedRole, isStorageDrive, firmSlug]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return visibleItems;
    const q = searchQuery.toLowerCase().trim();
    return visibleItems.filter((item) => (
      item.title.toLowerCase().includes(q)
      || item.description.toLowerCase().includes(q)
      || item.badge.toLowerCase().includes(q)
      || item.hint.toLowerCase().includes(q)
    ));
  }, [visibleItems, searchQuery]);

  return (
    <PlatformShell
      moduleLabel="Settings"
      title="Settings"
      subtitle="Firm configuration and operational controls in one place"
    >
      <div className="settings-hub-shell">
        {/* Top Operational Telemetry Strip */}
        <section className="settings-summary-strip" aria-label="Settings telemetry overview">
          <div className="settings-summary-card">
            <div className="settings-summary-card__icon settings-summary-card__icon--amber">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="settings-summary-card__content">
              <div className="settings-summary-card__top">
                <span className="settings-summary-card__kicker">Firm Workspace</span>
                <span className="text-[10px] font-mono font-bold uppercase text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  {practiceType} Practice
                </span>
              </div>
              <div className="settings-summary-card__title">{firmName}</div>
              <div className="settings-summary-card__meta">
                <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                <span>{isPrimary ? 'Primary Administrator Access' : `${normalizedRole} Access`}</span>
              </div>
            </div>
          </div>

          <div className="settings-summary-card">
            <div className="settings-summary-card__icon settings-summary-card__icon--emerald">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="settings-summary-card__content">
              <div className="settings-summary-card__top">
                <span className="settings-summary-card__kicker">Storage Boundary</span>
                <span className="text-[10px] font-mono font-bold uppercase text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  {isStorageDrive ? 'Zero-Custody' : 'Encrypted Cloud'}
                </span>
              </div>
              <div className="settings-summary-card__title">
                {isStorageDrive ? 'Google Drive Active' : 'Docketra Cloud Storage'}
              </div>
              <div className="settings-summary-card__meta">
                <span className="font-mono text-emerald-800 font-semibold">drive.file</span>
                <span>Restricted Isolation</span>
              </div>
            </div>
          </div>

          <div className="settings-summary-card">
            <div className="settings-summary-card__icon settings-summary-card__icon--blue">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="settings-summary-card__content">
              <div className="settings-summary-card__top">
                <span className="settings-summary-card__kicker">Subscription</span>
                <span className="text-[10px] font-mono font-bold uppercase text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                  Pilot Partner
                </span>
              </div>
              <div className="settings-summary-card__title">Professional Edition</div>
              <div className="settings-summary-card__meta">
                <span>Unlimited partner &amp; trainee seats</span>
              </div>
            </div>
          </div>
        </section>

        {/* Live Filter Bar */}
        <div className="settings-filter-bar">
          <div className="settings-filter-bar__input-wrapper">
            <Search className="settings-filter-bar__icon h-3.5 w-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter settings or permissions..."
              className="settings-filter-bar__input"
              aria-label="Filter settings"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="Clear filter"
              >
                &times;
              </button>
            ) : (
              <span className="settings-filter-bar__badge">⌘K</span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {filteredItems.length} of {visibleItems.length} configuration areas visible
          </p>
        </div>

        {/* Grouped Settings Menu */}
        <PageSection
          title="Settings menu"
          description="Choose the area you want to configure. The sidebar stays clean with one Settings entry, and all setting options are listed here."
        >
          <div className="space-y-6">
            {GROUPS.map((grp) => {
              const groupItems = filteredItems.filter((item) => item.group === grp.id);
              if (groupItems.length === 0) return null;
              return (
                <div key={grp.id} className="settings-group">
                  <div className="settings-group__header">
                    <h3 className="settings-group__title">
                      <span>{grp.title}</span>
                      <span className="settings-group__count">{groupItems.length}</span>
                    </h3>
                  </div>
                  <div className="panel settings-menu" aria-label={grp.title}>
                    {groupItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.title}
                          className="settings-menu__item"
                          to={item.to}
                        >
                          <div>
                            <div className="settings-menu__top">
                              <div className="settings-menu__icon">
                                <Icon className="h-4.5 w-4.5" />
                              </div>
                              <span className={`settings-menu__badge ${item.badge.includes('BYOS') ? 'settings-menu__badge--emerald' : item.badge.includes('Tier') ? 'settings-menu__badge--blue' : ''}`}>
                                {item.badge}
                              </span>
                            </div>
                            <div className="settings-menu__main">
                              <span className="settings-menu__label">
                                {item.title}
                              </span>
                              <span className="settings-menu__description">
                                {item.description}
                              </span>
                            </div>
                          </div>
                          <div className="settings-menu__footer">
                            <span className="settings-menu__hint">{item.hint}</span>
                            <span className="settings-menu__action">
                              <span>{item.action}</span>
                              <span aria-hidden="true">&rarr;</span>
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </PageSection>

        {/* Bottom Compliance & Security Assurance */}
        <div className="settings-trust-strip">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Firm administrator changes are cryptographically hashed and logged to immutable audit trails.</span>
          </div>
          <div className="settings-trust-strip__badges">
            <span>ISO-27001 Ready</span>
            <span>&bull;</span>
            <span>Zero File Leakage</span>
          </div>
        </div>
      </div>
    </PlatformShell>
  );
};

export default PlatformSettingsPage;
