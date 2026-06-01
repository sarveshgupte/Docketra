import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PlatformShell } from '../components/platform/PlatformShell';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { adminApi } from '../api/admin.api';
import { ROUTES } from '../constants/routes';
import { spacingClasses } from '../theme/tokens';
import { StatusMessageStack } from './platform/PlatformShared';
import { PageHeader } from '../components/layout/PageHeader';

// Custom vector SVG for Workbasket
const WorkbasketIcon = ({ className = 'h-5 w-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 12h-6l-2 3h-4l-2-3H2v7a2 2 0 002 2h16a2 2 0 002-2v-7z" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M2 12V5a2 2 0 012-2h16a2 2 0 012 2v7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
  </svg>
);

export const WorkSettingsPage = () => {
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const [workbaskets, setWorkbaskets] = useState([]);
  const [workbasketName, setWorkbasketName] = useState('');
  const [workbasketSaving, setWorkbasketSaving] = useState(false);
  const [loadingWorkbaskets, setLoadingWorkbaskets] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  const statusMessages = useMemo(() => ([
    loadError ? { tone: 'error', message: loadError } : null,
    statusMessage.text
      ? {
        tone: statusMessage.type === 'error' ? 'error' : statusMessage.type === 'success' ? 'success' : 'info',
        message: statusMessage.text,
      }
      : null,
  ].filter(Boolean)), [loadError, statusMessage]);

  const loadWorkbaskets = async () => {
    setLoadingWorkbaskets(true);
    setLoadError('');
    try {
      const response = await adminApi.listWorkbaskets({ includeInactive: true });
      setWorkbaskets(response?.success ? (response.data || []) : []);
    } catch {
      setWorkbaskets([]);
      setLoadError('Unable to load workbaskets. Retry to continue configuring work settings.');
    } finally {
      setLoadingWorkbaskets(false);
    }
  };

  useEffect(() => {
    void loadWorkbaskets();
  }, []);

  const primaryWorkbaskets = useMemo(() => workbaskets.filter((entry) => String(entry?.type || 'PRIMARY').toUpperCase() === 'PRIMARY'), [workbaskets]);
  const qcByPrimaryId = useMemo(() => new Map(
    workbaskets
      .filter((entry) => String(entry?.type || '').toUpperCase() === 'QC' && entry?.parentWorkbasketId)
      .map((entry) => [String(entry.parentWorkbasketId), entry]),
  ), [workbaskets]);

  const createWorkbasketByName = async (name) => {
    const nextName = String(name || '').trim();
    if (!nextName) return;
    setWorkbasketSaving(true);
    setStatusMessage({ type: 'info', text: 'Creating workbasket…' });
    try {
      await adminApi.createWorkbasket(nextName);
      setWorkbasketName('');
      await loadWorkbaskets();
      setStatusMessage({ type: 'success', text: 'Workbasket created.' });
    } catch (error) {
      if (error?.status === 409) {
        setStatusMessage({ type: 'error', text: 'A workbasket with this name already exists for this firm.' });
      } else if (error?.status === 400) {
        setStatusMessage({ type: 'error', text: 'Workbasket name is required and must be valid.' });
      } else if (error?.status === 403) {
        setStatusMessage({ type: 'error', text: 'You do not have permission to manage work settings for this firm.' });
      } else {
        setStatusMessage({ type: 'error', text: 'Could not create the workbasket due to a server or network error. Please retry.' });
      }
    } finally {
      setWorkbasketSaving(false);
    }
  };

  const handleCreateWorkbasket = async () => createWorkbasketByName(workbasketName);

  const handleCreateDefaultRouting = async () => {
    setWorkbasketSaving(true);
    setStatusMessage({ type: 'info', text: 'Configuring default routing…' });
    try {
      await adminApi.createDefaultRouting();
      await loadWorkbaskets();
      setStatusMessage({ type: 'success', text: 'Default routing configured.' });
    } catch (error) {
      if (error?.status === 403) {
        setStatusMessage({ type: 'error', text: 'You do not have permission to configure default routing for this firm.' });
      } else {
        setStatusMessage({ type: 'error', text: 'Could not configure default routing. Please retry.' });
      }
    } finally {
      setWorkbasketSaving(false);
    }
  };

  const handleRenameWorkbasket = async (workbasket) => {
    const nextName = window.prompt('Rename workbasket', workbasket.name || '');
    if (!nextName || !nextName.trim() || nextName.trim() === workbasket.name) return;
    setStatusMessage({ type: 'info', text: 'Updating workbasket name…' });
    try {
      await adminApi.renameWorkbasket(workbasket._id, nextName.trim());
      await loadWorkbaskets();
      setStatusMessage({ type: 'success', text: 'Workbasket renamed.' });
    } catch {
      setStatusMessage({ type: 'error', text: 'Could not rename this workbasket.' });
    }
  };

  const handleToggleWorkbasket = async (workbasket) => {
    setStatusMessage({ type: 'info', text: 'Updating workbasket status…' });
    try {
      await adminApi.toggleWorkbasketStatus(workbasket._id, !workbasket.isActive);
      await loadWorkbaskets();
      setStatusMessage({ type: 'success', text: 'Workbasket status updated.' });
    } catch {
      setStatusMessage({ type: 'error', text: 'Could not update workbasket status.' });
    }
  };

  return (
    <PlatformShell moduleLabel="Settings" title="Work settings" subtitle="Use Work Settings to control how new dockets enter team queues.">
      <div className="min-h-screen bg-slate-50/50 pb-16 font-sans">
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 space-y-6">
          
          {/* Go Back to Settings Link */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => navigate(ROUTES.SETTINGS(firmSlug))}
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-indigo-600 transition"
            >
              ← Go back to settings
            </button>
          </div>

          <PageHeader title="Work Settings" subtitle="Use Work Settings to control how new dockets enter team queues." />
          
          <StatusMessageStack messages={statusMessages} />

          {/* Premium Glassmorphic Configuration Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8 space-y-6 transition hover:shadow-md duration-300">
            <div className="border-b border-slate-100 pb-5">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Queue Configuration</span>
              <h2 className="text-xl font-bold text-slate-800 mt-1">Workbasket linkage & routing</h2>
              <p className="text-slate-500 text-sm mt-1 leading-relaxed">
                Use primary workbaskets to control queue destinations for incoming dockets. Linked QC workbaskets are maintained automatically.
              </p>
            </div>

            {/* Inline Add Workbasket Form */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4 max-w-2xl">
              <h3 className="font-bold text-sm text-slate-700">Add Primary Workbasket</h3>
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 w-full">
                  <Input 
                    label="Workbasket Name" 
                    value={workbasketName} 
                    onChange={(event) => setWorkbasketName(event.target.value)} 
                    placeholder="e.g. Compliance WB" 
                  />
                </div>
                <div className="w-full sm:w-auto">
                  <Button 
                    type="button" 
                    variant="primary" 
                    onClick={handleCreateWorkbasket} 
                    disabled={workbasketSaving || !workbasketName.trim()}
                  >
                    Add Workbasket
                  </Button>
                </div>
              </div>
            </div>

            {/* Workbaskets List Area */}
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Configured Workbaskets</h3>
              
              {loadingWorkbaskets && (
                <div className="py-6 flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
                  <span className="text-sm text-slate-500 font-medium">Resolving workbaskets...</span>
                </div>
              )}

              {!loadingWorkbaskets && primaryWorkbaskets.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center space-y-4 bg-slate-50/50">
                  <div className="h-12 w-12 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-xl">📁</div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-700">No active workbaskets configured</p>
                    <p className="text-xs text-slate-400">Create a workbasket above or trigger default routing to start.</p>
                  </div>
                  <Button 
                    type="button" 
                    variant="primary" 
                    onClick={() => void handleCreateDefaultRouting()} 
                    disabled={workbasketSaving}
                  >
                    Create Default Routing
                  </Button>
                </div>
              )}

              {!loadingWorkbaskets && primaryWorkbaskets.map((workbasket) => {
                const linkedQc = qcByPrimaryId.get(String(workbasket._id))?.name || 'Missing';
                return (
                  <div 
                    key={workbasket._id} 
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-100 hover:bg-slate-50/50 hover:shadow-sm transition-all duration-300 bg-white"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-600 flex-shrink-0 mt-0.5">
                        <WorkbasketIcon className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-800 text-sm">{workbasket.name}</h4>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            workbasket.isActive 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            {workbasket.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        {String(workbasket.type || 'PRIMARY').toUpperCase() === 'PRIMARY' && workbasket._id && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <span className="font-medium text-slate-400">Linked Queue:</span>
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded-lg border border-indigo-100 text-[10px]">
                              {linkedQc}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleRenameWorkbasket(workbasket)}
                      >
                        Rename
                      </Button>
                      <Button 
                        type="button" 
                        variant={workbasket.isActive ? 'danger' : 'primary'} 
                        size="sm"
                        onClick={() => handleToggleWorkbasket(workbasket)}
                      >
                        {workbasket.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </PlatformShell>
  );
};

export default WorkSettingsPage;
