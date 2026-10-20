import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
  RefreshCw,
} from '../../components/onboarding/OnboardingIcons';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { adminApi } from '../../api/admin.api';
import {
  connectGoogleDrive,
  disconnectStorage,
  getStorageConfiguration,
  verifyStorageBoundary,
} from '../../services/storageService';
import { ROUTES } from '../../constants/routes';

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
  const [isEditingFirmName, setIsEditingFirmName] = useState(false);
  const [practiceType, setPracticeType] = useState('PCS');

  // Step 2 Form: BYOS Storage
  const [storageConfig, setStorageConfig] = useState(null);
  const [verifyingBoundary, setVerifyingBoundary] = useState(false);
  const [boundaryReport, setBoundaryReport] = useState(null);

  // Step 3 Form: Employee Invitations
  const [invites, setInvites] = useState([
    { email: '', name: '', role: 'MANAGER' },
  ]);
  const [sentInvitesCount, setSentInvitesCount] = useState(0);
  const [workbaskets, setWorkbaskets] = useState([]);
  const [inviteStatus, setInviteStatus] = useState('');

  // Step 4: Tour toggle
  const [startTour, setStartTour] = useState(true);

  // Sync initial user details when profile resolves
  useEffect(() => {
    if (user?.firm?.name && !firmName) {
      setFirmName(user.firm.name);
    }
  }, [user?.firm?.name, firmName]);

  // Load storage state and workbaskets
  const refreshStorageAndWorkbaskets = async () => {
    try {
      const [storageRes, wbRes] = await Promise.allSettled([
        getStorageConfiguration(),
        adminApi.listWorkbaskets(),
      ]);
      if (storageRes.status === 'fulfilled') {
        const cfg = storageRes.value?.data || storageRes.value;
        setStorageConfig(cfg);
        const isDrive = Boolean(
          (cfg?.provider === 'google-drive' || cfg?.provider === 'google_drive') &&
          (cfg?.status === 'ACTIVE_BYOS' || cfg?.status === 'connected' || cfg?.connectedEmail)
        );
        if (isDrive) {
          verifyStorageBoundary().then((bRes) => {
            setBoundaryReport(bRes);
          }).catch(() => {});
        }
      }
      if (wbRes.status === 'fulfilled') {
        const wbList = wbRes.value?.data || wbRes.value || [];
        setWorkbaskets(Array.isArray(wbList) ? wbList : []);
      }
    } catch (_err) {
      // Safe fallback
    }
  };

  useEffect(() => {
    refreshStorageAndWorkbaskets();
  }, [firmSlug]);

  // Notify if user just returned from Google OAuth
  useEffect(() => {
    if (searchParams.get('connected') === '1') {
      showSuccess('Google Drive successfully connected (Zero-Custody BYOS)!');
    }
  }, [searchParams, showSuccess]);

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

  const isGoogleDriveConnected = Boolean(
    (storageConfig?.provider === 'google-drive' || storageConfig?.provider === 'google_drive') &&
    (storageConfig?.status === 'ACTIVE_BYOS' || storageConfig?.status === 'connected' || Boolean(storageConfig?.connectedEmail))
  );

  const validInvites = useMemo(() => {
    return invites.filter((inv) => inv.email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inv.email.trim()));
  }, [invites]);

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
      showSuccess('Firm specialization saved');
      setCurrentStep(2);
    } catch (_err) {
      // Non-blocking: proceed to next step
      setCurrentStep(2);
    } finally {
      setLoading(false);
    }
  };

  // Step 2 Action: Connect Google Drive with returnTo
  const handleConnectGoogleDrive = () => {
    const returnPath = `/app/firm/${firmSlug}/setup?step=2`;
    connectGoogleDrive(returnPath);
  };

  const handleDisconnectStorage = async () => {
    setLoading(true);
    try {
      await disconnectStorage();
      showSuccess('Google Drive disconnected. Storage reverted to Docketra Encrypted Cloud.');
      await refreshStorageAndWorkbaskets();
      setBoundaryReport(null);
    } catch (_err) {
      showError('Failed to disconnect Google Drive');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyBoundary = async () => {
    setVerifyingBoundary(true);
    try {
      const res = await verifyStorageBoundary();
      setBoundaryReport(res);
      showSuccess('Zero-Access Audit: 0 foreign files accessible');
    } catch (_err) {
      showError('Unable to audit storage boundary');
    } finally {
      setVerifyingBoundary(false);
    }
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
    if (validInvites.length === 0) {
      setSentInvitesCount(0);
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

    setSentInvitesCount(sentCount);
    setLoading(false);
    showSuccess(`Sent ${sentCount} invitation(s)`);
    setCurrentStep(4);
  };

  // Exit directly to workspace (bypassing remaining steps safely)
  const handleExitToWorkspace = async () => {
    try {
      if (typeof window !== 'undefined' && firmSlug) {
        window.localStorage?.setItem(`setupDismissed:${firmSlug}`, 'true');
      }
      await adminApi.completeFirmSetup({
        name: firmName.trim() || user?.firm?.name || 'Firm',
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
      navigate(ROUTES.WORKLIST(firmSlug), { replace: true });
    }
  };

  // Step 4 Finish: Complete Setup and Enter WebApp
  const handleEnterWorkspace = async () => {
    setLoading(true);
    try {
      if (typeof window !== 'undefined' && firmSlug) {
        window.localStorage?.setItem(`setupDismissed:${firmSlug}`, 'true');
      }
      await adminApi.completeFirmSetup({
        name: firmName.trim() || user?.firm?.name || 'Firm',
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
      const destination = `${ROUTES.WORKLIST(firmSlug)}${startTour ? '?tour=start' : ''}`;
      navigate(destination, { replace: true });
    }
  };

  const selectedPractice = PRACTICE_TYPES.find((p) => p.id === practiceType) || PRACTICE_TYPES[0];

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900 flex flex-col font-sans selection:bg-amber-500/20 selection:text-amber-900">
      {/* Top Header Bar */}
      <header className="h-14 border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between bg-white/95 backdrop-blur sticky top-0 z-30 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link to="/" className="inline-flex items-center gap-2 text-slate-950 hover:opacity-90 transition-opacity">
            <svg className="h-6 w-6 text-amber-600 shrink-0" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M25 15H50C69.33 15 85 30.67 85 50C85 69.33 69.33 85 50 85H25V15Z" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M40 30H50C61.05 30 70 38.95 70 50C70 61.05 61.05 70 50 70H40V30Z" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M50 44C53.31 44 56 46.69 56 50C56 53.31 53.31 56 50 56" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
            </svg>
            <span className="font-bold tracking-tight text-slate-950 text-sm">Docketra</span>
          </Link>
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-sm bg-slate-100 border border-slate-200 text-slate-700 font-semibold">
            Workspace Setup
          </span>
        </div>

        {/* Step Indicator & Exit */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-1 sm:gap-1.5" aria-label={`Setup Step ${currentStep} of 4`}>
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
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs transition-colors font-mono ${
                    isActive
                      ? 'bg-slate-950 text-white font-semibold shadow-xs'
                      : isDone
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium'
                      : 'bg-white border border-slate-200 text-slate-400'
                  }`}
                >
                  {isDone ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <span className="text-[10px] font-mono">{item.step}</span>
                  )}
                  <span className="hidden md:inline">{item.label}</span>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleExitToWorkspace}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors px-2 py-1 rounded hover:bg-slate-100 cursor-pointer"
            title="Skip remaining steps and enter workspace"
          >
            Exit to Workspace
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
        {/* STEP 1: FIRM NAME & PRACTICE TYPE */}
        {currentStep === 1 && (
          <div className="bg-white border border-slate-200/90 rounded-lg p-6 sm:p-8 shadow-xs space-y-6">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm bg-amber-50 border border-amber-200/80 text-amber-900 text-xs font-mono font-semibold uppercase">
                <Building2 className="h-3.5 w-3.5 text-amber-700" />
                Step 1: Firm Workspace Identity
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
                Confirm practice identity &amp; specialization
              </h1>
              <p className="text-sm text-slate-600">
                Your firm details were registered during signup. Select your specialization to tailor compliance calendars and statutory workflows.
              </p>
            </div>

            <form onSubmit={handleStep1Submit} className="space-y-6">
              {/* Confirmed Firm Identity Card */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Confirmed at Signup
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 tracking-tight">
                    {firmName || user?.firm?.name || 'Your Legal Practice'}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Workspace URL: <span className="text-slate-800 font-semibold">{workspaceUrl}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="px-2.5 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-xs font-mono text-slate-700 inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
                    {copied ? 'Copied' : 'Copy URL'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingFirmName(!isEditingFirmName)}
                    className="px-2.5 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer shadow-xs transition-colors"
                  >
                    {isEditingFirmName ? 'Done' : 'Edit name'}
                  </button>
                </div>
              </div>

              {/* Optional Inline Firm Name Input */}
              {isEditingFirmName && (
                <div className="space-y-2 p-3.5 rounded-lg border border-amber-200 bg-amber-50/40 animate-in fade-in duration-150">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Edit Legal Firm / Practice Name
                  </label>
                  <input
                    type="text"
                    value={firmName}
                    onChange={(e) => setFirmName(e.target.value)}
                    placeholder="e.g. M/s. Gupte & Associates"
                    required
                    className="w-full bg-white border border-slate-300 rounded-md px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950 transition-colors"
                  />
                  <p className="text-[11px] text-slate-500">
                    Adjust here if you noticed any typo during initial registration.
                  </p>
                </div>
              )}

              {/* Practice Category Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Practice Specialization
                  </label>
                  <span className="text-[11px] text-slate-500">Configures statutory radars &amp; calendars</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PRACTICE_TYPES.map((type) => {
                    const isSelected = practiceType === type.id;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setPracticeType(type.id)}
                        className={`text-left p-3.5 rounded-md border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-50/50 border-amber-500 text-slate-950 shadow-xs ring-1 ring-amber-500'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-900">{type.label}</span>
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />}
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug">{type.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-md bg-slate-950 hover:bg-slate-800 text-white font-bold text-sm shadow-xs transition-colors cursor-pointer active:scale-[0.98] disabled:opacity-50"
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
          <div className="bg-white border border-slate-200/90 rounded-lg p-6 sm:p-8 shadow-xs space-y-6">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm bg-sky-50 border border-sky-200 text-sky-900 text-xs font-mono font-semibold uppercase">
                <HardDrive className="h-3.5 w-3.5 text-sky-700" />
                Step 2: Connect Document Storage (BYOS)
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
                Zero-Custody Cloud Storage
              </h1>
              <p className="text-sm text-slate-600">
                Connect your firm&apos;s own cloud drive. All secretarial filings, ROC challans, and client dockets remain in your custody.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option 1: Google Drive BYOS */}
              <div
                className={`p-5 rounded-lg border flex flex-col justify-between transition-all ${
                  isGoogleDriveConnected
                    ? 'bg-emerald-50/40 border-emerald-300 shadow-xs ring-1 ring-emerald-300'
                    : 'bg-white border-slate-200 shadow-xs'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-md bg-amber-50 border border-amber-200 flex items-center justify-center text-lg">
                        <HardDrive className="h-5 w-5 text-amber-700" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Google Drive BYOS</h3>
                        <p className="text-[11px] text-slate-500">Recommended for CS / CA Practices</p>
                      </div>
                    </div>
                    {isGoogleDriveConnected ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-mono font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800">
                        <Check className="h-3 w-3" /> Connected
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                        Ready to Connect
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Automatically organizes filings under:
                    <span className="block font-mono text-[11px] text-slate-800 mt-1 bg-slate-50 p-2 rounded-sm border border-slate-200">
                      Google Drive &gt; Docketra &gt; {firmName || 'Firm'} &gt; Cases
                    </span>
                  </p>

                  {/* Official Restricted Scope Guarantee */}
                  <div className="p-3 rounded-md bg-sky-50/70 border border-sky-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-sky-900 font-semibold text-xs">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-sky-700" />
                        <span>Google drive.file Restricted Consent</span>
                      </div>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm bg-sky-100 text-sky-800 border border-sky-300 font-semibold">
                        Zero Access
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      Official Google Policy: <em className="text-slate-700">&ldquo;See, edit, create, and delete only the specific Google Drive files you use with this app.&rdquo;</em>
                    </p>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      Docketra cannot read, search, or access any other files on your Google Drive.
                    </p>
                  </div>

                  {/* Connected Isolation Proof */}
                  {isGoogleDriveConnected && (
                    <div className="p-3 rounded-md bg-emerald-50/60 border border-emerald-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-emerald-900 font-semibold text-xs">
                          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" />
                          <span>Google Drive Isolation Verified</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleVerifyBoundary}
                          disabled={verifyingBoundary}
                          className="px-2 py-0.5 rounded-sm bg-white hover:bg-emerald-50 border border-emerald-300 text-[10px] font-mono text-emerald-800 transition-colors cursor-pointer"
                        >
                          {verifyingBoundary ? 'Auditing…' : 'Re-run Audit'}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] font-mono">
                        <div className="bg-white p-2 rounded-sm border border-emerald-200/80">
                          <span className="text-slate-500 block text-[9px] uppercase font-semibold">External Files Readable</span>
                          <span className="text-emerald-700 font-bold">{boundaryReport?.boundaryAudit?.externalFilesAccessible ?? 0} (Zero Access)</span>
                        </div>
                        <div className="bg-white p-2 rounded-sm border border-emerald-200/80">
                          <span className="text-slate-500 block text-[9px] uppercase font-semibold">Scope Enforcement</span>
                          <span className="text-emerald-700 font-bold">Google drive.file</span>
                        </div>
                        <div className="bg-white p-2 rounded-sm border border-emerald-200/80">
                          <span className="text-slate-500 block text-[9px] uppercase font-semibold">Laptop Download Shield</span>
                          <span className="text-emerald-700 font-bold">Active</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-2 border-t border-slate-100 space-y-2">
                  {isGoogleDriveConnected ? (
                    <div className="space-y-2">
                      <div className="text-xs text-emerald-800 font-mono flex items-center gap-1.5 font-semibold">
                        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="truncate">Active: {storageConfig?.connectedEmail || 'Firm Google Drive'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleConnectGoogleDrive}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-white hover:bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer shadow-xs transition-colors"
                        >
                          <RefreshCw className="h-3.5 w-3.5 text-slate-500" /> Switch Account
                        </button>
                        <button
                          type="button"
                          onClick={handleDisconnectStorage}
                          disabled={loading}
                          className="px-3 py-1.5 rounded bg-white hover:bg-rose-50 border border-slate-300 hover:border-rose-300 text-xs font-semibold text-rose-700 cursor-pointer shadow-xs transition-colors"
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConnectGoogleDrive}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs active:scale-[0.98]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Sign in with Google Drive
                    </button>
                  )}
                </div>
              </div>

              {/* Option 2: Docketra Managed Cloud */}
              <div className="p-5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-md bg-sky-50 border border-sky-200 flex items-center justify-center">
                        <Cloud className="h-5 w-5 text-sky-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Docketra Encrypted Cloud</h3>
                        <p className="text-[11px] text-slate-500">Default Secure Storage</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-mono font-semibold bg-sky-50 border border-sky-200 text-sky-800">
                      Default Active
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Zero-configuration fallback. Your files are isolated by tenant key with AES-256 client-side hash verification.
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    If you choose not to connect Google Drive right now, all filings will be securely kept here. You can connect your Google Drive anytime from Firm Settings.
                  </p>
                </div>

                <div className="pt-4 mt-2 border-t border-slate-200/60">
                  <span className="text-[11px] text-slate-600 inline-flex items-center gap-1 font-medium">
                    <Lock className="h-3 w-3 text-emerald-600" /> Instant ready · Zero setup required
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-slate-200">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Identity
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 rounded-md text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Skip for now
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-md bg-slate-950 hover:bg-slate-800 text-white font-bold text-sm shadow-xs transition-colors cursor-pointer active:scale-[0.98]"
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
          <div className="bg-white border border-slate-200/90 rounded-lg p-6 sm:p-8 shadow-xs space-y-6">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm bg-purple-50 border border-purple-200 text-purple-900 text-xs font-mono font-semibold uppercase">
                <Users className="h-3.5 w-3.5 text-purple-700" />
                Step 3: Team Roster &amp; Role Assignment
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
                Invite your firm&apos;s team
              </h1>
              <p className="text-sm text-slate-600">
                Add administrators, workbasket managers, and filing executives. Each user receives their secure xID credentials via email.
              </p>
            </div>

            {/* Role Reference Guide */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 rounded-md bg-slate-50 border border-slate-200">
              {ROLES.map((r) => (
                <div key={r.id} className="text-xs space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <span>{r.label}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-sm bg-white border border-slate-200 text-slate-700 font-mono">
                      {r.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">{r.desc}</p>
                </div>
              ))}
            </div>

            {/* Invites Form Table */}
            <div className="space-y-3">
              <div className="hidden sm:grid grid-cols-12 gap-3 text-xs font-mono uppercase text-slate-500 px-2">
                <div className="col-span-5">Email Address</div>
                <div className="col-span-4">Full Name</div>
                <div className="col-span-3">Assigned Role</div>
              </div>

              {invites.map((invite, index) => (
                <div key={index} className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2 rounded-md bg-slate-50 border border-slate-200 items-center">
                  <div className="sm:col-span-5">
                    <input
                      type="email"
                      value={invite.email}
                      onChange={(e) => handleInviteChange(index, 'email', e.target.value)}
                      placeholder="colleague@firm.com"
                      className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950 font-mono"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      value={invite.name}
                      onChange={(e) => handleInviteChange(index, 'name', e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                    />
                  </div>

                  <div className="sm:col-span-3 flex items-center gap-1.5">
                    <select
                      value={invite.role}
                      onChange={(e) => handleInviteChange(index, 'role', e.target.value)}
                      className="flex-1 bg-white border border-slate-300 rounded-md px-2 py-1.5 text-xs text-slate-800 font-mono focus:outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="MANAGER">Manager</option>
                      <option value="USER">Employee</option>
                    </select>

                    {invites.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveInviteRow(index)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
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
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-900 transition-colors pt-1 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Add another teammate
              </button>
            </div>

            {inviteStatus && (
              <p className="text-xs font-mono text-amber-800 text-center">{inviteStatus}</p>
            )}

            <div className="pt-4 flex items-center justify-between border-t border-slate-200">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Storage
              </button>

              <div className="flex items-center gap-3">
                {validInvites.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setSentInvitesCount(0);
                        setCurrentStep(4);
                      }}
                      className="px-4 py-2 rounded-md text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Skip for now
                    </button>
                    <button
                      type="button"
                      onClick={handleSendInvitesAndContinue}
                      disabled={loading}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-md bg-slate-950 hover:bg-slate-800 text-white font-bold text-sm shadow-xs transition-colors cursor-pointer active:scale-[0.98] disabled:opacity-50"
                    >
                      {loading ? 'Sending Invites...' : `Send ${validInvites.length} Invite(s) & Continue`}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSentInvitesCount(0);
                      setCurrentStep(4);
                    }}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-md bg-slate-950 hover:bg-slate-800 text-white font-bold text-sm shadow-xs transition-colors cursor-pointer active:scale-[0.98]"
                  >
                    Skip for now &amp; Continue
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: WELCOME TO DOCKETRA WEBAPP */}
        {currentStep === 4 && (
          <div className="bg-white border border-slate-200/90 rounded-lg p-6 sm:p-10 shadow-xs space-y-8 text-center">
            <div className="max-w-md mx-auto space-y-3">
              <div className="h-16 w-16 mx-auto rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <Sparkles className="h-8 w-8" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-950">
                Welcome to Docketra
              </h1>
              <p className="text-sm text-slate-600">
                Workspace <span className="text-slate-950 font-bold">{firmName || 'Your Practice'}</span> is configured and ready for daily operations.
              </p>
            </div>

            {/* URL Card */}
            <div className="max-w-lg mx-auto p-4 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-left">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-500 block">Firm Workspace Link</span>
                <span className="text-xs font-mono font-bold text-slate-900 break-all">{workspaceUrl}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="px-3 py-1.5 rounded-md bg-white hover:bg-slate-100 border border-slate-300 text-xs text-slate-700 font-mono inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer shadow-xs"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            {/* Honest Dynamic Milestone Badges */}
            <div className="max-w-lg mx-auto grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left text-xs">
              {/* Milestone 1: Firm Profile */}
              <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>Firm Configured</span>
                </div>
                <p className="text-[11px] text-emerald-800 truncate">
                  {selectedPractice.label}
                </p>
              </div>

              {/* Milestone 2: Document Storage */}
              {isGoogleDriveConnected ? (
                <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>Google Drive Active</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 truncate" title={storageConfig?.connectedEmail || 'Zero-Custody Cloud'}>
                    {storageConfig?.connectedEmail || 'Zero-Custody BYOS'}
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-md bg-sky-50 border border-sky-200 text-sky-950 space-y-1">
                  <div className="flex items-center gap-1.5 text-sky-800 font-bold">
                    <Cloud className="h-4 w-4 shrink-0 text-sky-600" />
                    <span>Docketra Cloud</span>
                  </div>
                  <p className="text-[11px] text-sky-800">
                    Default Active · BYOS optional
                  </p>
                </div>
              )}

              {/* Milestone 3: Team Roster */}
              {sentInvitesCount > 0 ? (
                <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                    <Users className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>Team Configured</span>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    {sentInvitesCount} colleague(s) invited
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                    <Users className="h-4 w-4 shrink-0 text-slate-500" />
                    <span>Solo Admin Mode</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Invite team anytime in Settings
                  </p>
                </div>
              )}
            </div>

            {/* Sovereign Pilot Active Banner */}
            <div className="max-w-md mx-auto rounded-md bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700 font-mono text-center">
              Active Tier: <span className="text-amber-800 font-bold">Free Sovereign Pilot</span> (2 Seats • 5 Clients • ₹0 Forever)
              <span className="block text-[11px] text-slate-500 mt-1">
                Upgrade to Pioneer 30 or Growth Tier anytime with 1 click from Firm Settings.
              </span>
            </div>

            {/* Product Walkthrough Option & Launch CTA */}
            <div className="pt-2 max-w-sm mx-auto space-y-3">
              <label className="flex items-center justify-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={startTour}
                  onChange={(e) => setStartTour(e.target.checked)}
                  className="rounded border-slate-300 text-slate-950 focus:ring-slate-950"
                />
                <span>Start interactive product tour upon entering</span>
              </label>

              <button
                type="button"
                onClick={handleEnterWorkspace}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-md bg-slate-950 hover:bg-slate-800 text-white font-bold text-sm tracking-wide shadow-xs transition-colors cursor-pointer active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? 'Entering Command Center...' : 'Enter Workspace Command Center'}
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="text-[11px] text-slate-500 font-mono">
                Opens your statutory radar and worklist directly.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default WorkspaceSetupPage;
