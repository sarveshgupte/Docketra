import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { ROUTES } from '../../constants/routes';

const roleRank = { USER: 1, MANAGER: 2, ADMIN: 3, PRIMARY_ADMIN: 4 };
const hasAtLeastRole = (current, minimum) => (roleRank[current] || 0) >= (roleRank[minimum] || 0);

const Icons = {
  General: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  Users: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  Workbaskets: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  Categories: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2zM9 16h6m-6-4h6m-6-4h6" />
    </svg>
  ),
  Storage: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
  ),
  StorageMap: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  ),
};

export const PlatformSettingsPage = () => {
  const { firmSlug } = useParams();
  const { user } = useAuth();
  const normalizedRole = String(user?.role || 'USER').trim().toUpperCase().replace(/[\s-]+/g, '_');

  const settingsItems = [
    {
      title: 'General',
      description: 'Firm profile, identity, branding, and workspace defaults.',
      to: ROUTES.FIRM_SETTINGS(firmSlug),
      action: 'Open Configuration',
      minRole: 'ADMIN',
      icon: Icons.General,
      hoverBorder: 'hover:border-indigo-400/50',
      hoverShadow: 'hover:shadow-indigo-500/10',
      iconBg: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white',
      badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      actionColor: 'text-indigo-600',
    },
    {
      title: 'Users & Team',
      description: 'Users, roles, access controls, and account safety actions.',
      to: ROUTES.ADMIN(firmSlug),
      action: 'Manage Directory',
      minRole: 'ADMIN',
      icon: Icons.Users,
      hoverBorder: 'hover:border-emerald-400/50',
      hoverShadow: 'hover:shadow-emerald-500/10',
      iconBg: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      actionColor: 'text-emerald-600',
    },
    {
      title: 'Workbaskets',
      description: 'Primary workbaskets, linked QC queues, and docket routing.',
      to: ROUTES.WORK_SETTINGS(firmSlug),
      action: 'Configure Queues',
      minRole: 'MANAGER',
      icon: Icons.Workbaskets,
      hoverBorder: 'hover:border-sky-400/50',
      hoverShadow: 'hover:shadow-sky-500/10',
      iconBg: 'bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white',
      badgeBg: 'bg-sky-50 text-sky-700 border-sky-100',
      actionColor: 'text-sky-600',
    },
    {
      title: 'Categories',
      description: 'Docket categories, subcategories, and workbasket routing.',
      to: ROUTES.WORK_CATEGORY_MANAGEMENT(firmSlug),
      action: 'Edit Categories',
      minRole: 'ADMIN',
      icon: Icons.Categories,
      hoverBorder: 'hover:border-amber-400/50',
      hoverShadow: 'hover:shadow-amber-500/10',
      iconBg: 'bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-100',
      actionColor: 'text-amber-600',
    },
    {
      title: 'Storage',
      description: 'Firm-owned storage mode, Google Drive connection, and exports.',
      to: ROUTES.STORAGE_SETTINGS(firmSlug),
      action: 'Review Storage',
      minRole: 'ADMIN',
      icon: Icons.Storage,
      hoverBorder: 'hover:border-purple-400/50',
      hoverShadow: 'hover:shadow-purple-500/10',
      iconBg: 'bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white',
      badgeBg: 'bg-purple-50 text-purple-700 border-purple-100',
      actionColor: 'text-purple-600',
    },
    {
      title: 'Storage Map',
      description: 'Where client, docket, and document data is stored.',
      to: ROUTES.DATA_STORAGE_MAP(firmSlug),
      action: 'View Servers',
      minRole: 'ADMIN',
      icon: Icons.StorageMap,
      hoverBorder: 'hover:border-rose-400/50',
      hoverShadow: 'hover:shadow-rose-500/10',
      iconBg: 'bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white',
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-100',
      actionColor: 'text-rose-600',
    },
  ].filter((item) => hasAtLeastRole(normalizedRole, item.minRole));

  return (
    <PlatformShell
      moduleLabel="Settings"
      title="Settings"
      subtitle="Firm configuration and operational controls in one place"
    >
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-slate-800">Workspace Management Hub</h2>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          Select an administrative domain to configure. The Docketra system enforces role-based access control, showing only the settings you are authorized to manage.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsItems.map((item) => (
          <Link
            key={item.title}
            to={item.to}
            className={`group block bg-white/70 backdrop-blur-md border border-slate-200/60 rounded-2xl p-6 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg ${item.hoverShadow} ${item.hoverBorder} flex flex-col justify-between h-full`}
          >
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${item.iconBg}`}>
                  {item.icon}
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${item.badgeBg}`}>
                  {item.minRole === 'ADMIN' ? 'Admin Access' : 'Manager Access'}
                </span>
              </div>

              <h3 className="text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors duration-300">
                {item.title}
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                {item.description}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-sm font-semibold">
              <span className={`${item.actionColor} opacity-90 group-hover:opacity-100 transition-opacity duration-300`}>
                {item.action}
              </span>
              <svg className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-1.5 transition-all duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </PlatformShell>
  );
};

export default PlatformSettingsPage;
