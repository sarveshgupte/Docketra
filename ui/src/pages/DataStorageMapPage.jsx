import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlatformShell } from '../components/platform/PlatformShell';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { getStorageDataMap } from '../services/storageService';
import { formatDateTime } from '../utils/formatDateTime';
import { ROUTES } from '../constants/routes';

// Polished inline SVG icons
const FileIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const FolderIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const CloudIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
  </svg>
);

const DatabaseIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
  </svg>
);

const ShieldIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const CopyIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
  </svg>
);

const CheckIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const ExternalLinkIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const LockIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const GoogleDriveIcon = ({ className = 'h-8 w-8' }) => (
  <svg className={className} viewBox="0 0 87.3 78" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.6 78l17.5-30.2h56.6L63.2 78H6.6z" fill="#0b57d0"/>
    <path d="M63.2 78L87.3 36.3 70.8 7.8 46.7 49.5 63.2 78z" fill="#00ac47"/>
    <path d="M24.1 47.8L0 6.1 16.5 6.1l40.7 70.4L24.1 47.8z" fill="#ea4335"/>
    <path d="M57.2 76.5L16.5 6.1H49.5l40.7 70.4H57.2z" fill="#ffba00"/>
  </svg>
);

export function DataStorageMapPage() {
  const [dataMap, setDataMap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getStorageDataMap();
        setDataMap(data);
      } catch (err) {
        setError('Unable to load your Data Storage Map right now.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleCopyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const locations = dataMap ? [
    {
      key: 'profiles',
      title: 'Client Profiles',
      description: 'Workspace names, addresses, and registration numbers.',
      path: dataMap.businessDataLocations?.clientProfiles || 'firms/{firmId}/clients/{clientId}/profile.json',
      icon: <FileIcon className="w-5 h-5 text-emerald-500" />,
      badge: 'Firm-Owned',
    },
    {
      key: 'cfs',
      title: 'Client CFS (Compliance Files)',
      description: 'Client Fact Sheets, notes, and compliance registers.',
      path: dataMap.businessDataLocations?.clientCfs || 'firms/{firmId}/clients/{clientId}/cfs.json',
      icon: <FolderIcon className="w-5 h-5 text-emerald-500" />,
      badge: 'Firm-Owned',
    },
    {
      key: 'attachments',
      title: 'Attachments & Documents',
      description: 'All docket uploads, case attachments, and user documents.',
      path: dataMap.businessDataLocations?.attachments || 'firms/{firmId}/clients/{clientId}/attachments/',
      icon: <CloudIcon className="w-5 h-5 text-emerald-500" />,
      badge: 'Firm-Owned',
    },
    {
      key: 'dockets',
      title: 'Dockets, Tasks & Comments',
      description: 'Historical case records, task workflows, and user discussion logs.',
      path: dataMap.businessDataLocations?.docketsTasksComments || 'planned cloud storage path: firms/{firmId}/clients/{clientId}/dockets/{docketId}/',
      icon: <DatabaseIcon className="w-5 h-5 text-indigo-500" />,
      badge: dataMap.strictFirmOwnedStorage ? 'Firm-Owned' : 'Docketra Cloud',
    },
  ] : [];

  return (
    <PlatformShell moduleLabel="Settings" title="Data Storage Map" subtitle="Trust transparency for storage and metadata boundaries.">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 space-y-6">
        
        {/* Sleek Gradient Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/60 pb-5">
          <PageHeader 
            title="Data Storage Map" 
            subtitle="Transparent mappings of your data locations, control plane details, and compliance configurations." 
          />
          {dataMap && (
            <Link to={ROUTES.STORAGE_SETTINGS(dataMap?.firm?.slug || '')} className="shrink-0">
              <Button type="button" variant="outline" size="sm" className="flex items-center gap-1.5 hover:bg-slate-50">
                ← Back to Storage Settings
              </Button>
            </Link>
          )}
        </div>

        {/* Global Policy Banner */}
        <div className="bg-gradient-to-r from-indigo-50/70 to-blue-50/40 border border-indigo-100/70 rounded-2xl p-5 flex gap-4 items-start backdrop-blur-md shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
            <ShieldIcon className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-indigo-950">Zero-Residency Policy (BYOS)</h4>
            <p className="text-xs text-indigo-900/80 leading-relaxed">
              Docketra operates under a strict segregation model. All legal client profiles, documents, and CFS registers remain on your own firm's servers. We only load metadata inside the local user session to populate screens, ensuring your files are never exposed or retained on our systems.
            </p>
          </div>
        </div>

        {loading ? (
          <Card animateOnMount className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
            <p className="text-sm text-slate-500">Loading your data storage configurations...</p>
          </Card>
        ) : error ? (
          <Card animateOnMount className="border-rose-200 bg-rose-50/50 p-6 flex flex-col items-center justify-center py-12">
            <span className="text-3xl">⚠️</span>
            <p className="text-sm font-semibold text-rose-700 mt-2">{error}</p>
            <Button size="sm" variant="outline" className="mt-4" onClick={() => window.location.reload()}>
              Retry Connection
            </Button>
          </Card>
        ) : dataMap ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Left Column (2 Span) - Active Provider & Data Locations Map */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Active Provider Card */}
              <Card animateOnMount className="relative overflow-hidden border-slate-200/80 hover:border-slate-300 transition-all duration-300">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4 mb-4">
                  <div className="flex items-center gap-3">
                    {dataMap.activeStorage?.provider === 'firm_owned_google_drive' ? (
                      <GoogleDriveIcon className="h-10 w-10 shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        <CloudIcon className="w-6 h-6 text-slate-600" />
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Workspace Storage</span>
                      <h3 className="text-base font-bold text-slate-800">{dataMap.activeStorage?.providerLabel}</h3>
                    </div>
                  </div>
                  
                  {/* Glowing Connectivity Badge */}
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                      Connected & Active
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  <div>
                    <span className="text-xs font-medium text-slate-400 block">Authorized Account</span>
                    <span className="font-semibold text-slate-700 truncate block">{dataMap.activeStorage?.connectedEmail || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-400 block">Last Integrity Verification</span>
                    <span className="font-semibold text-slate-700 block">
                      {dataMap.activeStorage?.lastStorageHealthCheck ? formatDateTime(dataMap.activeStorage.lastStorageHealthCheck) : 'Not Checked'}
                    </span>
                  </div>
                </div>

                {/* Storage Capacity Slider */}
                {dataMap.activeStorage?.storageCapacity ? (
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <div className="flex justify-between items-center mb-1.5 text-xs">
                      <span className="font-semibold text-slate-500">Connected Storage Quota</span>
                      <span className="font-bold text-slate-700">
                        {dataMap.activeStorage.storageCapacity.displayUsed} of {dataMap.activeStorage.storageCapacity.displayTotal} ({dataMap.activeStorage.storageCapacity.usagePercent}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 border border-slate-200/40 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, Math.max(0, dataMap.activeStorage.storageCapacity.usagePercent))}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400 italic">
                    <DatabaseIcon className="w-4 h-4 text-slate-400" />
                    Quota details are available when a firm-connected storage provider is configured.
                  </div>
                )}
              </Card>

              {/* Data Location Map */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-800">Business Data Residency Mapping</h3>
                  <span className="text-xs text-slate-400">Strict client-ownership boundaries</span>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  {locations.map((loc) => (
                    <div 
                      key={loc.key} 
                      className="bg-white/80 border border-slate-200/60 hover:border-slate-300 rounded-2xl p-5 shadow-sm transition-all duration-200 flex flex-col gap-3 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-150 flex items-center justify-center shrink-0">
                            {loc.icon}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-800">{loc.title}</h4>
                            <p className="text-xs text-slate-500 mt-0.5">{loc.description}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                          loc.badge === 'Firm-Owned' 
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-600' 
                            : 'bg-indigo-50 border-indigo-100 text-indigo-600'
                        }`}>
                          {loc.badge}
                        </span>
                      </div>

                      {/* Code Snippet Box */}
                      <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200/50 rounded-xl p-2.5 font-mono text-[10px] text-slate-600 overflow-x-auto w-full group-hover:bg-slate-100/50 transition-colors">
                        <code className="truncate max-w-[85%] select-all">{loc.path}</code>
                        <button 
                          type="button"
                          className="p-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-700 shadow-sm shrink-0 transition-all active:scale-95"
                          title="Copy file path pattern"
                          onClick={() => handleCopyToClipboard(loc.path, loc.key)}
                        >
                          {copiedKey === loc.key ? (
                            <CheckIcon className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <CopyIcon className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column (1 Span) - Control Plane Data & Verification Actions */}
            <div className="space-y-6">
              
              {/* MongoDB Control Plane Card */}
              <Card animateOnMount className="border-slate-200/80">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3">
                  <LockIcon className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-slate-800">Control Plane Data</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  Docketra retains only the minimum structural coordinates in our central database to route connections and execute core platform workflows.
                </p>

                <div className="space-y-2.5">
                  {(dataMap.mongoControlPlaneCategories || []).map((category, index) => (
                    <div key={index} className="flex gap-2.5 items-start text-xs text-slate-700">
                      <span className="text-indigo-500 shrink-0 select-none mt-0.5">•</span>
                      <span>{category}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 p-3 rounded-xl bg-slate-50 border border-slate-150 text-[10px] text-slate-500 flex gap-2 items-start leading-normal">
                  <ShieldIcon className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>No client case folder structures or private identity documents are cached or mirrored inside our MongoDB tables.</span>
                </div>
              </Card>

              {/* Verification & Compliance Actions */}
              <Card animateOnMount className="border-slate-200/80">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3">
                  <DatabaseIcon className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-slate-800">Residency Audits</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  Trigger raw audits, download compliance schemas, or inspect the root storage structures manually.
                </p>

                <div className="space-y-3">
                  {/* Open Drive folder */}
                  {dataMap.verificationActions?.openFirmCloudFolderUrl ? (
                    <a 
                      href={dataMap.verificationActions.openFirmCloudFolderUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100/60 hover:border-indigo-200 text-xs font-bold text-indigo-700 hover:text-indigo-800 transition-all shadow-sm"
                    >
                      <span className="flex items-center gap-2">
                        <GoogleDriveIcon className="w-4 h-4 shrink-0" />
                        Open Google Drive folder
                      </span>
                      <ExternalLinkIcon className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/50 text-xs text-slate-400 italic">
                      Google Drive folder access is disabled (Managed storage fallback active).
                    </div>
                  )}

                  {/* Download Residency Summary */}
                  {dataMap.verificationActions?.downloadResidencySummaryPath && (
                    <a 
                      href={dataMap.verificationActions.downloadResidencySummaryPath}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-all shadow-sm"
                    >
                      <span className="flex items-center gap-2">
                        📄
                        Download residency report
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-200/60 border border-slate-300/40 px-1.5 py-0.5 rounded uppercase">TEXT</span>
                    </a>
                  )}

                  {/* View policy */}
                  {dataMap.verificationActions?.policyDocPath && (
                    <a 
                      href={dataMap.verificationActions.policyDocPath}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-all shadow-sm"
                    >
                      <span className="flex items-center gap-2">
                        🛡️
                        View data residency policy
                      </span>
                      <ExternalLinkIcon className="w-3.5 h-3.5 text-slate-400" />
                    </a>
                  )}
                </div>
              </Card>

            </div>

          </div>
        ) : null}

      </div>
    </PlatformShell>
  );
}
