import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Building2,
  HardDrive,
  Users,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Copy,
  Check,
  Plus,
  Trash2,
  Sparkles,
  ExternalLink,
  Lock,
  Cloud,
} from '../../components/onboarding/OnboardingIcons';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { adminApi } from '../../api/admin.api';
import { connectGoogleDrive, getStorageConfiguration } from '../../services/storageService';

const PRACTICE_TYPES = [
  { id: 'PCS', label: 'Company Secretary (PCS)', desc: 'MCA, ROC filings, secretarial audits, board resolutions' },
  { id: 'CA', label: 'Chartered Accountant (CA)', desc: 'GST, Income Tax, statutory audits, financial compliance' },
  { id: 'LEGAL', label: 'Legal & Corporate Practice', desc: 'NCLT litigation, corporate governance, contracts, dispute resolution' },
  { id: 'ADVISORY', label: 'Compliance & Governance Advisory', desc: 'Cross-functional compliance, corporate advisory, secretarial retainers' },
];

const ROLES = [
  { id: 'ADMIN', label: 'Admin', badge: 'Full Control', desc: 'Firm settings, billing, storage configuration, user access' },
  { id: 'MANAGER', label: 'Manager', badge: 'Queue Oversight', desc: 'Workbasket allocation, reviewer sign-offs, QC oversight' },
  { id: 'USER', label: 'Employee', badge: 'Execution', desc: 'Daily statutory filings, task lists, docket processing' },
];

export function WorkspaceSetupPage() {
  const navigate = useNavigate();
  const { firmSlug: routeFirmSlug } = useParams();
  const [searchParams] = useSearchParams();
  const { user, updateUser, fetchProfile } = useAuth();
  const { showSuccess, showError } = useToast();

  const firmSlug = routeFirmSlug || user?.firmSlug || user?.firm?.firmSlug || '';
  const initialStep = Number(searchParams.get('step')) || 1;

  const [currentStep, setCurrentStep] = useState(initialStep);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Step 1 Form: Firm Identity
  const [firmName, setFirmName] = useState(user?.firm?.name || user?.firmName || '');
  const [practiceType, setPracticeType] = useState('PCS');

  // Step 2 Form: BYOS Storage
  const [storageConfig, setStorageConfig] = useState(null);

  // Step 3 Form: Employee Invitations
  const [invites, setInvites] = useState([
    { email: '', name: '', role: 'MANAGER' },
    { email: '', name: '', role: 'USER' },
  ]);
  const [workbaskets, setWorkbaskets] = useState([]);
  const [inviteStatus, setInviteStatus] = useState('');

  // Sync initial user details when profile resolves
  useEffect(() => {
    if (user?.firm?.name && !firmName) {
      setFirmName(user.firm.name);
    }
  }, [user?.firm?.name, firmName]);

  // Load storage state and workbaskets
  useEffect(() => {
    let mounted = true;
    async function loadInitialData() {
      try {
        const [storageRes, wbRes] = await Promise.allSettled([
          getStorageConfiguration(),
          adminApi.listWorkbaskets(),
        ]);
        if (mounted && storageRes.status === 'fulfilled') {
          setStorageConfig(storageRes.value?.data || storageRes.value);
        }
        if (mounted && wbRes.status === 'fulfilled') {
          const wbList = wbRes.value?.data || wbRes.value || [];
          setWorkbaskets(Array.isArray(wbList) ? wbList : []);
        }
      } catch (_err) {
        // Safe fallback
      }
    }
    loadInitialData();
    return () => { mounted = false; };
  }, [firmSlug]);

  const workspaceUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://docketra.in';
    return `${origin}/${firmSlug || 'workspace'}`;
  }, [firmSlug]);

  const handleCopyUrl = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(workspaceUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showSuccess('Workspace URL copied to clipboard');
    }
  };

  // Step 1 Submit: Save Firm Name & Identity
  const handleStep1Submit = async (e) => {
    e.preventDefault();
    if (!firmName.trim()) {
      showError('Please enter your firm name');
      return;
    }
    setLoading(true);
    try {
      await adminApi.updateFirmSettings({
        firm: {
          name: firmName.trim(),
          practiceType,
        },
      });
      showSuccess('Firm details saved');
      setCurrentStep(2);
    } catch (_err) {
      // Non-blocking: proceed to next step
      setCurrentStep(2);
    } finally {
      setLoading(false);
    }
  };

  // Step 2 Action: Connect Google Drive
  const handleConnectGoogleDrive = () => {
    connectGoogleDrive();
  };

  // Step 3 Actions: Employee Invitations
  const handleAddInviteRow = () => {
    setInvites((prev) => [...prev, { email: '', name: '', role: 'USER' }]);
  };

  const handleRemoveInviteRow = (index) => {
    setInvites((prev) => prev.filter((_, i) => i !== index));
  };

  const handleInviteChange = (index, field, value) => {
    setInvites((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSendInvitesAndContinue = async () => {
    const validInvites = invites.filter((inv) => inv.email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inv.email.trim()));
    if (validInvites.length === 0) {
      setCurrentStep(4);
      return;
    }

    setLoading(true);
    setInviteStatus(`Sending ${validInvites.length} invitation(s)...`);
    let sentCount = 0;
    const defaultTeamId = workbaskets[0]?._id || workbaskets[0]?.id || null;

    for (const invite of validInvites) {
      try {
        await adminApi.createUser({
          email: invite.email.trim().toLowerCase(),
          name: invite.name.trim() || invite.email.split('@')[0],
          role: invite.role,
          teamIds: defaultTeamId ? [defaultTeamId] : [],
        });
        sentCount += 1;
      } catch (_err) {
        // Non-blocking
      }
    }

    setLoading(false);
    showSuccess(`Sent ${sentCount} invitation(s)`);
    setCurrentStep(4);
  };

  // Step 4 Finish: Complete Setup and Enter WebApp
  const handleEnterWorkspace = async () => {
    setLoading(true);
    try {
      await adminApi.completeFirmSetup({
        name: firmName.trim(),
        practiceType,
      });
      const refreshed = await fetchProfile();
      if (refreshed?.data) {
        updateUser({
          ...refreshed.data,
          isSetupComplete: true,
          firm: {
            ...(refreshed.data.firm || {}),
            isSetupComplete: true,
          },
        });
      }
    } catch (_err) {
      // Non-blocking
    } finally {
      setLoading(false);
      navigate(`/${firmSlug}/dashboard?tour=start`, { replace: true });
    }
  };

  const isDriveConnected = Boolean(
    storageConfig?.isConfigured ||
    storageConfig?.status === 'connected' ||
    storageConfig?.connectionStatus === 'ACTIVE_BYOS' ||
    storageConfig?.mode === 'firm_connected'
  );

  return (
    <div className="min-h-screen bg-[#070A11] text-slate-100 flex flex-col selection:bg-amber-500/20 selection:text-amber-200">
      {/* Top Header Bar */}
      <header className="h-14 border-b border-[#1E293B] px-6 flex items-center justify-between bg-[#0B0F19]/80 backdrop-blur sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-black text-xs">
            D
          </div>
          <span className="font-bold tracking-tight text-white text-sm">Docketra</span>
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
            Workspace Setup
          </span>
        </div>

        {/* Step Indicator Pills */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {[
            { step: 1, label: 'Firm Identity' },
            { step: 2, label: 'Storage' },
            { step: 3, label: 'Team' },
            { step: 4, label: 'Welcome' },
          ].map((item) => {
            const isActive = currentStep === item.step;
            const isDone = currentStep > item.step;
            return (
              <div
                key={item.step}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all font-mono ${
                  isActive
                    ? 'bg-amber-500/15 border border-amber-500/40 text-amber-300 font-semibold'
                    : isDone
                    ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-400'
                    : 'bg-slate-900 border border-slate-800 text-slate-500'
                }`}
              >
                {isDone ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <span className="text-[10px] font-mono">{item.step}</span>
                )}
                <span className="hidden md:inline">{item.label}</span>
              </div>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
        {/* STEP 1: FIRM NAME & IDENTITY */}
        {currentStep === 1 && (
          <div className="bg-[#0B0F19] border border-[#1E293B] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono font-semibold uppercase">
                <Building2 className="h-3.5 w-3.5" />
                Step 1: Firm Workspace Identity
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Set up your firm&apos;s master profile
              </h1>
              <p className="text-sm text-slate-400">
                Establish the legal identity, practice specialization, and firm URL for your practice.
              </p>
            </div>

            <form onSubmit={handleStep1Submit} className="space-y-6">
              {/* Firm Name */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Legal Firm / Practice Name <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  value={firmName}
                  onChange={(e) => setFirmName(e.target.value)}
                  placeholder="e.g. M/s. Gupte & Associates"
                  required
                  className="w-full bg-[#070A11] border border-[#1E293B] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* Workspace URL Preview */}
              <div className="p-3.5 rounded-xl bg-[#070A11] border border-[#1E293B] space-y-1">
                <span className="text-[11px] font-mono uppercase text-slate-400">Dedicated Workspace URL</span>
                <div className="flex items-center justify-between text-xs font-mono text-amber-300">
                  <span>{workspaceUrl}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    Active Tenant Slug
                  </span>
                </div>
              </div>

              {/* Practice Category Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Practice Specialization
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PRACTICE_TYPES.map((type) => {
                    const isSelected = practiceType === type.id;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setPracticeType(type.id)}
                        className={`text-left p-3.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500/50 text-white shadow-[0_0_15px_-3px_rgba(245,158,11,0.2)]'
                            : 'bg-[#070A11] border-[#1E293B] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-white">{type.label}</span>
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0" />}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">{type.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Continue to Storage (BYOS)'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 2: CONNECT BYOS */}
        {currentStep === 2 && (
          <div className="bg-[#0B0F19] border border-[#1E293B] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono font-semibold uppercase">
                <HardDrive className="h-3.5 w-3.5" />
                Step 2: Connect Document Storage (BYOS)
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Zero-Custody Cloud Storage
              </h1>
              <p className="text-sm text-slate-400">
                Connect your firm&apos;s own cloud drive. All secretarial filings, ROC challans, and dockets remain in your custody.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option 1: Google Drive */}
              <div
                className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
                  isDriveConnected
                    ? 'bg-emerald-950/20 border-emerald-500/40 shadow-[0_0_20px_-5px_rgba(16,185,129,0.2)]'
                    : 'bg-[#070A11] border-[#1E293B]'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg">
                        <HardDrive className="h-5 w-5 text-amber-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Google Drive BYOS</h3>
                        <p className="text-[11px] text-slate-400">Recommended for CS / CA Practices</p>
                      </div>
                    </div>
                    {isDriveConnected ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                        <Check className="h-3 w-3" /> Connected
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                        Ready to Connect
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    Automatically organizes dockets under:
                    <span className="block font-mono text-[11px] text-amber-300/90 mt-1 bg-black/40 p-1.5 rounded border border-white/5">
                      Google Drive &gt; Docketra &gt; {firmName || 'Firm'} &gt; Cases
                    </span>
                  </p>
                </div>

                <div className="pt-4 mt-2 border-t border-white/5">
                  {isDriveConnected ? (
                    <div className="text-xs text-emerald-400 font-mono flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4" />
                      Active: {storageConfig?.connectedEmail || 'Firm Google Drive'}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConnectGoogleDrive}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Connect Firm Google Drive
                    </button>
                  )}
                </div>
              </div>

              {/* Option 2: Docketra Managed Cloud */}
              <div className="p-5 rounded-2xl bg-[#070A11] border border-[#1E293B] flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <Cloud className="h-5 w-5 text-sky-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Docketra Encrypted Cloud</h3>
                        <p className="text-[11px] text-slate-400">Default Secure Storage</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-sky-500/10 border border-sky-500/30 text-sky-400">
                      AES-256
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    Zero-configuration fallback. Your files are isolated by tenant key with client-side hash verification. You can migrate to BYOS at any time.
                  </p>
                </div>

                <div className="pt-4 mt-2 border-t border-white/5">
                  <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                    <Lock className="h-3 w-3 text-emerald-400" /> Available as instant default
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-[#1E293B]">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Identity
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Skip for now
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                >
                  Continue to Team Invites
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: INVITE EMPLOYEES & ASSIGN ROLES */}
        {currentStep === 3 && (
          <div className="bg-[#0B0F19] border border-[#1E293B] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-mono font-semibold uppercase">
                <Users className="h-3.5 w-3.5" />
                Step 3: Team Roster & Role Assignment
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Invite your firm&apos;s team
              </h1>
              <p className="text-sm text-slate-400">
                Add administrators, workbasket managers, and filing executives. Each user receives their secure xID credentials.
              </p>
            </div>

            {/* Role Reference Guide */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 rounded-xl bg-[#070A11] border border-[#1E293B]">
              {ROLES.map((r) => (
                <div key={r.id} className="text-xs space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-white">
                    <span>{r.label}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-amber-300 font-mono">
                      {r.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">{r.desc}</p>
                </div>
              ))}
            </div>

            {/* Invites Form Table */}
            <div className="space-y-3">
              <div className="hidden sm:grid grid-cols-12 gap-3 text-xs font-mono uppercase text-slate-400 px-2">
                <div className="col-span-5">Email Address</div>
                <div className="col-span-4">Full Name</div>
                <div className="col-span-3">Assigned Role</div>
              </div>

              {invites.map((invite, index) => (
                <div key={index} className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2 rounded-xl bg-[#070A11] border border-[#1E293B] items-center">
                  <div className="sm:col-span-5">
                    <input
                      type="email"
                      value={invite.email}
                      onChange={(e) => handleInviteChange(index, 'email', e.target.value)}
                      placeholder="colleague@firm.com"
                      className="w-full bg-black/40 border border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      value={invite.name}
                      onChange={(e) => handleInviteChange(index, 'name', e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full bg-black/40 border border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="sm:col-span-3 flex items-center gap-1.5">
                    <select
                      value={invite.role}
                      onChange={(e) => handleInviteChange(index, 'role', e.target.value)}
                      className="flex-1 bg-black/40 border border-[#1E293B] rounded-lg px-2 py-1.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="MANAGER">Manager</option>
                      <option value="USER">Employee</option>
                    </select>

                    {invites.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveInviteRow(index)}
                        className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                        title="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddInviteRow}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors pt-1 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Add another teammate
              </button>
            </div>

            {inviteStatus && (
              <p className="text-xs font-mono text-amber-300 text-center animate-pulse">{inviteStatus}</p>
            )}

            <div className="pt-4 flex items-center justify-between border-t border-[#1E293B]">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Storage
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Skip for now
                </button>
                <button
                  type="button"
                  onClick={handleSendInvitesAndContinue}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Sending Invites...' : 'Send Invites & Welcome'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: WELCOME TO DOCKETRA WEBAPP */}
        {currentStep === 4 && (
          <div className="bg-[#0B0F19] border border-amber-500/30 rounded-2xl p-6 sm:p-10 shadow-[0_0_50px_-10px_rgba(245,158,11,0.15)] space-y-8 text-center">
            <div className="max-w-md mx-auto space-y-3">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Sparkles className="h-8 w-8" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                Welcome to Docketra
              </h1>
              <p className="text-sm text-slate-400">
                Workspace <span className="text-white font-bold">{firmName || 'Your Firm'}</span> is fully configured and ready for daily operations.
              </p>
            </div>

            {/* URL Card */}
            <div className="max-w-lg mx-auto p-4 rounded-xl bg-[#070A11] border border-[#1E293B] flex items-center justify-between gap-3 text-left">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-500 block">Firm Workspace Link</span>
                <span className="text-xs font-mono font-bold text-amber-300 break-all">{workspaceUrl}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="px-3 py-1.5 rounded-lg bg-[#0B0F19] hover:bg-slate-800 border border-slate-700 text-xs text-white font-mono inline-flex items-center gap-1.5 shrink-0 transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            {/* Milestone Badges */}
            <div className="max-w-md mx-auto grid grid-cols-3 gap-2 text-center text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-[#070A11] border border-emerald-500/20 text-emerald-400 space-y-1">
                <CheckCircle2 className="h-4 w-4 mx-auto" />
                <span className="block text-[11px]">Firm Ready</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#070A11] border border-emerald-500/20 text-emerald-400 space-y-1">
                <ShieldCheck className="h-4 w-4 mx-auto" />
                <span className="block text-[11px]">Storage Active</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#070A11] border border-emerald-500/20 text-emerald-400 space-y-1">
                <Users className="h-4 w-4 mx-auto" />
                <span className="block text-[11px]">Team Configured</span>
              </div>
            </div>

            {/* Launch CTA */}
            <div className="pt-2 max-w-sm mx-auto">
              <button
                type="button"
                onClick={handleEnterWorkspace}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm tracking-wide shadow-xl shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Entering Command Center...' : 'Enter Workspace & Start Tour'}
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="text-[11px] text-slate-500 mt-2 font-mono">
                Step 5 (Interactive Product Walkthrough) starts on your dashboard.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default WorkspaceSetupPage;
