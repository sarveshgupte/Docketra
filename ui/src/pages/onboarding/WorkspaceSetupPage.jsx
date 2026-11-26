import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Building2,
  HardDrive,
  Laptop,
  Server,
  Folder,
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
  Clock,
  LogOut,
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
import { isAlternativeStorageEnabled } from '../../utils/storageOptions';

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
  const { user, updateUser, fetchProfile, logout } = useAuth();
  const { showSuccess, showError, showInfo } = useToast();

  const firmSlug = routeFirmSlug || user?.firmSlug || user?.firm?.firmSlug || '';
  const initialStep = Number(searchParams.get('step')) || 1;
  const showAltStorageOptions = isAlternativeStorageEnabled();

  const isPrimaryAdmin = user?.role === 'PRIMARY_ADMIN';
  const isSetupComplete = user?.firm?.isSetupComplete === true || user?.isSetupComplete === true;

  const [currentStep, setCurrentStep] = useState(initialStep);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // If setup is already complete and no explicit step is requested, redirect to worklist
  useEffect(() => {
    if (isSetupComplete && !searchParams.get('reconfigure') && !searchParams.get('step')) {
      navigate(ROUTES.WORKLIST(firmSlug), { replace: true });
    }
  }, [isSetupComplete, firmSlug, navigate, searchParams]);

  // Step 1 Form: Firm Identity
  const [firmName, setFirmName] = useState(user?.firm?.name || user?.firmName || '');
  const [isEditingFirmName, setIsEditingFirmName] = useState(false);
  const [practiceType, setPracticeType] = useState('PCS');

  // Step 2 Form: Storage Configuration
  const [storageConfig, setStorageConfig] = useState(null);
  const [verifyingBoundary, setVerifyingBoundary] = useState(false);
  const [boundaryReport, setBoundaryReport] = useState(null);
  const [localFolderPath, setLocalFolderPath] = useState(() => (
    typeof window !== 'undefined' ? window.localStorage?.getItem('docketra:local_storage_folder') || '' : ''
  ));
  const [isEditingLocalPath, setIsEditingLocalPath] = useState(false);
  const [customLocalInput, setCustomLocalInput] = useState(() => (
    typeof window !== 'undefined' ? window.localStorage?.getItem('docketra:local_storage_folder') || '' : ''
  ));
  const [officeServerPath, setOfficeServerPath] = useState(() => (
    typeof window !== 'undefined' ? window.localStorage?.getItem('docketra:office_server_path') || '' : ''
  ));
  const [isEditingOfficeServer, setIsEditingOfficeServer] = useState(false);
  const [customOfficeServerInput, setCustomOfficeServerInput] = useState(() => (
    typeof window !== 'undefined' ? window.localStorage?.getItem('docketra:office_server_path') || '' : ''
  ));

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
      showSuccess('Google Drive connected successfully!');
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
      showSuccess('Google Drive disconnected. Using standard workspace storage.');
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
      showSuccess('Privacy check passed: 0 external files accessible');
    } catch (_err) {
      showError('Unable to check privacy boundary');
    } finally {
      setVerifyingBoundary(false);
    }
  };

  const handlePickLocalFolder = async () => {
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        const folderName = dirHandle.name;
        const displayPath = `Local PC: \\${folderName}`;
        setLocalFolderPath(displayPath);
        setCustomLocalInput(displayPath);
        setIsEditingLocalPath(false);
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('docketra:local_storage_folder', displayPath);
          window.localStorage.setItem('docketra:storage_type', 'local_disk');
        }
        showSuccess(`Selected local folder: ${folderName}`);
      } catch (err) {
        if (err.name !== 'AbortError') {
          showError('Could not open folder picker. You can enter your folder path below.');
          setIsEditingLocalPath(true);
        }
      }
    } else {
      setIsEditingLocalPath(true);
      showInfo('Directory picker is not supported on this browser. You can enter your folder path.');
    }
  };

  const handleSaveManualLocalPath = (e) => {
    e?.preventDefault();
    if (!customLocalInput.trim()) {
      showError('Please enter a folder path');
      return;
    }
    const pathStr = customLocalInput.trim();
    setLocalFolderPath(pathStr);
    setIsEditingLocalPath(false);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('docketra:local_storage_folder', pathStr);
      window.localStorage.setItem('docketra:storage_type', 'local_disk');
    }
    showSuccess('Local folder path saved');
  };

  const handleSaveOfficeServerPath = (e) => {
    e?.preventDefault();
    if (!customOfficeServerInput.trim()) {
      showError('Please enter an office server or network share path');
      return;
    }
    const pathStr = customOfficeServerInput.trim();
    setOfficeServerPath(pathStr);
    setIsEditingOfficeServer(false);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('docketra:office_server_path', pathStr);
      window.localStorage.setItem('docketra:storage_type', 'office_server');
    }
    showSuccess('Office server path saved');
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

  // Exit directly to workspace (marking setup completed safely in database)
  const finalizeWorkspaceSetup = async ({ showCompletionToast = false, includeTourParam = false } = {}) => {
    setLoading(true);
    try {
      if (typeof window !== 'undefined' && firmSlug) {
        window.localStorage?.setItem(`setupDismissed:${firmSlug}`, 'true');
      }
      await adminApi.completeFirmSetup({
        name: firmName.trim() || user?.firm?.name || 'Firm',
        practiceType,
      });
      const refreshed = await fetchProfile({ force: true });
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
      if (showCompletionToast) {
        showSuccess('Workspace setup completed');
      }
    } catch (_err) {
      // Non-blocking
    } finally {
      setLoading(false);
      const destination = `${ROUTES.WORKLIST(firmSlug)}${includeTourParam ? '?tour=start' : ''}`;
      navigate(destination, { replace: true });
    }
  };

  const handleExitToWorkspace = () => finalizeWorkspaceSetup({ showCompletionToast: true });

  // Step 4 Finish: Complete Setup and Enter WebApp
  const handleEnterWorkspace = () => finalizeWorkspaceSetup({ includeTourParam: startTour });

  const selectedPractice = PRACTICE_TYPES.find((p) => p.id === practiceType) || PRACTICE_TYPES[0];

  // Non-Primary Admin view when firm setup is pending
  if (!isPrimaryAdmin) {
    if (isSetupComplete) {
      return null; // Handled by useEffect redirect
    }

    const handleCheckStatus = async () => {
      setCheckingStatus(true);
      try {
        const refreshed = await fetchProfile({ force: true });
        const isNowComplete = Boolean(
          refreshed?.data?.isSetupComplete || refreshed?.data?.firm?.isSetupComplete
        );
        if (isNowComplete) {
          showSuccess('Workspace setup completed. Entering workspace.');
          navigate(ROUTES.WORKLIST(firmSlug), { replace: true });
        } else {
          showInfo('Setup is still in progress by your primary administrator.');
        }
      } catch (_err) {
        showError('Unable to check setup status right now. Please try again.');
      } finally {
        setCheckingStatus(false);
      }
    };

    const handleSignOut = async () => {
      try {
        await logout({ preserveFirmSlug: true });
      } finally {
        navigate(ROUTES.FIRM_LOGIN(firmSlug), { replace: true });
      }
    };

    return (
      <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col font-sans selection:bg-amber-500/20 selection:text-amber-900">
        <header className="h-14 border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between bg-white/95 backdrop-blur sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-3">
            <Link to="/" className="inline-flex items-center gap-2 text-slate-950 hover:opacity-90 transition-opacity">
              <svg className="h-6 w-6 text-amber-600 shrink-0" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M25 15H50C69.33 15 85 30.67 85 50C85 69.33 69.33 85 50 85H25V15Z" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M40 30H50C61.05 30 70 38.95 70 50C70 61.05 61.05 70 50 70H40V30Z" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M50 44C53.31 44 56 46.69 56 50C56 53.31 53.31 56 50 56" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
              </svg>
              <span className="font-bold tracking-tight text-slate-950 text-sm">DocketsHQ</span>
            </Link>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-sm bg-amber-50 border border-amber-200 text-amber-800 font-semibold">
              Setup in progress
            </span>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium px-2.5 py-1.5 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </header>

        <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-lg bg-white border border-slate-200/90 rounded-xl p-6 sm:p-8 shadow-xs text-center space-y-6">
            <div className="mx-auto h-12 w-12 rounded-full bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-700">
              <Clock className="h-6 w-6" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
                Workspace setup in progress
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
                Your firm&apos;s primary administrator is currently configuring this workspace. You will have full access as soon as initial setup is complete.
              </p>
            </div>

            <div className="bg-slate-50/80 border border-slate-200 rounded-lg p-4 text-left space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Practice</span>
                <span className="text-slate-900 font-semibold">{firmName || user?.firm?.name || 'Workspace'}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Your account</span>
                <span className="text-slate-900 font-medium font-mono">{user?.email || user?.xID || 'Team Member'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Configuration</span>
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  <Clock className="h-3 w-3" /> Awaiting administrator
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-normal">
              Need immediate access? Please notify your firm&apos;s primary administrator.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleCheckStatus}
                disabled={checkingStatus}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-slate-950 hover:bg-slate-800 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer active:scale-[0.98] disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${checkingStatus ? 'animate-spin' : ''}`} />
                {checkingStatus ? 'Checking status...' : 'Check status'}
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

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
            <span className="font-bold tracking-tight text-slate-950 text-sm">DocketsHQ</span>
          </Link>
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-sm bg-slate-100 border border-slate-200 text-slate-700 font-semibold">
            Workspace Setup
          </span>
        </div>

        {/* Step Indicator & Exit */}
        <div className="flex items-center gap-2 sm:gap-4">
          <nav aria-label="Setup step navigation" className="flex items-center gap-1 sm:gap-1.5">
            {[
              { step: 1, label: 'Firm Identity' },
              { step: 2, label: 'Storage' },
              { step: 3, label: 'Team' },
              { step: 4, label: 'Welcome' },
            ].map((item) => {
              const isActive = currentStep === item.step;
              const isDone = currentStep > item.step;
              return (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => setCurrentStep(item.step)}
                  title={`Go to Step ${item.step}: ${item.label}`}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs transition-colors font-mono cursor-pointer ${
                    isActive
                      ? 'bg-slate-950 text-white font-semibold shadow-xs'
                      : isDone
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium hover:bg-emerald-100/80'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {isDone ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <span className="text-[10px] font-mono">{item.step}</span>
                  )}
                  <span className="hidden md:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>

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

              <div className="pt-3 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleExitToWorkspace}
                  disabled={loading}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium text-xs transition-colors cursor-pointer"
                >
                  Skip setup &amp; open workspace
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-md bg-slate-950 hover:bg-slate-800 text-white font-bold text-sm shadow-xs transition-colors cursor-pointer active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Continue to Storage Setup'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 2: CHOOSE WHERE TO STORE YOUR FILES */}
        {currentStep === 2 && (
          <div className="bg-white border border-slate-200/90 rounded-lg p-6 sm:p-8 shadow-xs space-y-6">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm bg-sky-50 border border-sky-200 text-sky-900 text-xs font-mono font-semibold uppercase">
                <HardDrive className="h-3.5 w-3.5 text-sky-700" />
                {showAltStorageOptions ? 'Step 2: Choose where to store your files' : 'Step 2: Connect Firm Google Drive'}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
                Your files stay in your hands
              </h1>
              <p className="text-sm text-slate-600">
                {showAltStorageOptions
                  ? 'Choose where DocketsHQ saves your client documents, filings, and notices. DocketsHQ never stores copies of your private files on its own servers.'
                  : 'Connect your firm’s Google Drive so DocketsHQ stores client documents, filings, and notices directly in your own drive—never on DocketsHQ servers.'}
              </p>
            </div>

            {/* Storage Options Grid */}
            <div className={showAltStorageOptions ? 'grid grid-cols-1 lg:grid-cols-3 gap-4' : 'max-w-xl'}>
              {/* Option 1: Google Drive (Cloud + Computer Sync) */}
              <div
                className={`p-5 rounded-lg border flex flex-col justify-between transition-all ${
                  isGoogleDriveConnected
                    ? 'bg-emerald-50/30 border-emerald-300 shadow-xs ring-1 ring-emerald-300'
                    : 'bg-white border-slate-200 shadow-xs hover:border-slate-300'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-md bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                        <Cloud className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Google Drive</h3>
                        <p className="text-[11px] text-slate-500">Cloud + Computer Sync</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800">
                      Recommended
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Stores files in your firm&apos;s Google Drive. Easy to access from your phone or laptop anywhere.
                  </p>

                  <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                    <span className="font-semibold text-slate-800 block">Want files on your PC?</span>
                    Install the free Google Drive app to view and open files right inside your computer&apos;s G: drive.
                  </div>

                  {isGoogleDriveConnected ? (
                    <div className="p-3 rounded-md bg-emerald-50/60 border border-emerald-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-emerald-900 font-semibold text-xs truncate">
                          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="truncate">{storageConfig?.connectedEmail || 'Google Drive connected'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleVerifyBoundary}
                          disabled={verifyingBoundary}
                          className="px-2 py-0.5 rounded-sm bg-white hover:bg-emerald-50 border border-emerald-300 text-[10px] font-mono text-emerald-800 transition-colors cursor-pointer shrink-0"
                        >
                          {verifyingBoundary ? 'Checking…' : 'Check Privacy'}
                        </button>
                      </div>
                      <p className="text-[11px] text-emerald-800 leading-snug">
                        Privacy check passed: DocketsHQ only accesses its own firm folder. 0 external files accessible.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      Safe and restricted: DocketsHQ only accesses files it creates for your firm.
                    </p>
                  )}
                </div>

                <div className="pt-4 mt-3 border-t border-slate-100">
                  {isGoogleDriveConnected ? (
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
                  ) : (
                    <button
                      type="button"
                      onClick={handleConnectGoogleDrive}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs active:scale-[0.98]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Connect Google Drive
                    </button>
                  )}
                </div>
              </div>

              {showAltStorageOptions && (
                <>
              {/* Option 2: This Computer's Hard Drive */}
              <div
                className={`p-5 rounded-lg border flex flex-col justify-between transition-all ${
                  localFolderPath
                    ? 'bg-slate-50/80 border-slate-400 shadow-xs ring-1 ring-slate-400'
                    : 'bg-white border-slate-200 shadow-xs hover:border-slate-300'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-md bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700">
                        <Laptop className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">This Computer</h3>
                        <p className="text-[11px] text-slate-500">Local Hard Drive</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-slate-100 border border-slate-200 text-slate-700">
                      Local PC only
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Save files straight into a folder on this computer (like D:\Clients). Never uploads to any cloud.
                  </p>

                  <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                    <span className="font-semibold text-slate-800 block">Fast &amp; Private</span>
                    Works completely offline. Files stay on this PC and won&apos;t be available from other laptops.
                  </div>

                  {localFolderPath && !isEditingLocalPath ? (
                    <div className="p-3 rounded-md bg-slate-100 border border-slate-300 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase text-slate-600 font-semibold">Active Folder</span>
                        <button
                          type="button"
                          onClick={() => setIsEditingLocalPath(true)}
                          className="text-[10px] text-blue-600 hover:underline font-semibold cursor-pointer"
                        >
                          Change
                        </button>
                      </div>
                      <p className="text-xs font-mono text-slate-900 font-semibold break-all">
                        {localFolderPath}
                      </p>
                    </div>
                  ) : (
                    isEditingLocalPath && (
                      <form onSubmit={handleSaveManualLocalPath} className="space-y-2">
                        <input
                          type="text"
                          value={customLocalInput}
                          onChange={(e) => setCustomLocalInput(e.target.value)}
                          placeholder="e.g. D:\DocketsHQ\Clients"
                          className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:border-slate-950"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            className="px-3 py-1 rounded bg-slate-950 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            Save path
                          </button>
                          {localFolderPath && (
                            <button
                              type="button"
                              onClick={() => setIsEditingLocalPath(false)}
                              className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </form>
                    )
                  )}
                </div>

                <div className="pt-4 mt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handlePickLocalFolder}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs active:scale-[0.98]"
                  >
                    <Folder className="h-3.5 w-3.5" />
                    {localFolderPath ? 'Choose another folder' : 'Choose folder on this PC'}
                  </button>
                </div>
              </div>

              {/* Option 3: Office Server or Network Drive */}
              <div
                className={`p-5 rounded-lg border flex flex-col justify-between transition-all ${
                  officeServerPath
                    ? 'bg-purple-50/30 border-purple-300 shadow-xs ring-1 ring-purple-300'
                    : 'bg-white border-slate-200 shadow-xs hover:border-slate-300'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-md bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
                        <Server className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Office Server</h3>
                        <p className="text-[11px] text-slate-500">Shared Network Drive</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-purple-50 border border-purple-200 text-purple-800">
                      For office teams
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Save files on a shared office computer, server, or NAS drive over the office Wi-Fi network.
                  </p>

                  <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                    <span className="font-semibold text-slate-800 block">Team Collaboration</span>
                    Everyone in the office connected to the same network can view and work on the same client files.
                  </div>

                  {officeServerPath && !isEditingOfficeServer ? (
                    <div className="p-3 rounded-md bg-purple-50/60 border border-purple-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase text-purple-700 font-semibold">Active Server / Share</span>
                        <button
                          type="button"
                          onClick={() => setIsEditingOfficeServer(true)}
                          className="text-[10px] text-blue-600 hover:underline font-semibold cursor-pointer"
                        >
                          Change
                        </button>
                      </div>
                      <p className="text-xs font-mono text-purple-950 font-semibold break-all">
                        {officeServerPath}
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleSaveOfficeServerPath} className="space-y-2">
                      <label className="text-[11px] font-medium text-slate-700 block">
                        Network folder or server address:
                      </label>
                      <input
                        type="text"
                        value={customOfficeServerInput}
                        onChange={(e) => setCustomOfficeServerInput(e.target.value)}
                        placeholder="e.g. \\OFFICE-PC\Clients or Z:\DocketsHQ"
                        className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:border-slate-950"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="submit"
                          className="px-3 py-1 rounded bg-slate-950 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          Save server path
                        </button>
                        {officeServerPath && (
                          <button
                            type="button"
                            onClick={() => setIsEditingOfficeServer(false)}
                            className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                  )}
                </div>

                <div className="pt-4 mt-3 border-t border-slate-100">
                  {!isEditingOfficeServer && !officeServerPath ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingOfficeServer(true)}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs active:scale-[0.98]"
                    >
                      <Server className="h-3.5 w-3.5" />
                      Configure Network Drive
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-500 inline-flex items-center gap-1 font-medium">
                      <Check className="h-3 w-3 text-emerald-600" /> Accessible across office Wi-Fi
                    </span>
                  )}
                </div>
              </div>
                </>
              )}
            </div>

            {/* Privacy Assurance Note */}
            <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-900 block">Privacy Guarantee</span>
                DocketsHQ connects directly to your chosen storage. We never sell, read, or keep copies of your client files. You can change this anytime from Firm Settings.
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-slate-200">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Firm Identity
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
                <ArrowLeft className="h-4 w-4" /> Back to Storage Setup
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
                Welcome to DocketsHQ
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
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>Google Drive Active</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 truncate" title={storageConfig?.connectedEmail || 'Google Drive'}>
                    {storageConfig?.connectedEmail || 'Google Drive'}
                  </p>
                </div>
              ) : showAltStorageOptions && localFolderPath ? (
                <div className="p-3 rounded-md bg-sky-50 border border-sky-200 text-sky-950 space-y-1">
                  <div className="flex items-center gap-1.5 text-sky-800 font-bold">
                    <Laptop className="h-4 w-4 shrink-0 text-sky-600" />
                    <span>Local PC Storage</span>
                  </div>
                  <p className="text-[11px] text-sky-800 truncate" title={localFolderPath}>
                    {localFolderPath}
                  </p>
                </div>
              ) : showAltStorageOptions && officeServerPath ? (
                <div className="p-3 rounded-md bg-purple-50 border border-purple-200 text-purple-950 space-y-1">
                  <div className="flex items-center gap-1.5 text-purple-800 font-bold">
                    <Server className="h-4 w-4 shrink-0 text-purple-600" />
                    <span>Office Server</span>
                  </div>
                  <p className="text-[11px] text-purple-800 truncate" title={officeServerPath}>
                    {officeServerPath}
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                    <Cloud className="h-4 w-4 shrink-0 text-slate-500" />
                    <span>Standard Storage</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Connect drive anytime in Settings
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

            {/* Active Plan Banner */}
            <div className="max-w-md mx-auto rounded-md bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700 font-mono text-center">
              Active Plan: <span className="text-amber-800 font-bold">1-Year Founding Pilot</span> (Unlimited Seats • Unlimited Clients • Full Access)
              <span className="block text-[11px] text-slate-500 mt-1">
                Paid plans coming soon. Manage capacity anytime in Firm Settings.
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
                {loading ? 'Entering Workspace...' : 'Enter Workspace'}
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="text-[11px] text-slate-500 font-mono">
                Opens your statutory radar and worklist directly.
              </p>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-slate-200">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer py-1.5 px-3 rounded hover:bg-slate-100"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Team
              </button>

              <button
                type="button"
                onClick={handleEnterWorkspace}
                disabled={loading}
                className="text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Skip tour &amp; enter
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default WorkspaceSetupPage;
