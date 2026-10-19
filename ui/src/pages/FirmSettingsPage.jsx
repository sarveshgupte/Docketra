import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PlatformShell } from '../components/platform/PlatformShell';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { EmptyState } from '../components/ui/EmptyState';
import { adminApi } from '../api/admin.api';
import { slaApi } from '../api/sla.api';
import { categoryService } from '../services/categoryService';
import { getFirmConfig, setFirmConfig } from '../utils/firmConfig';
import { buildCsv } from '../utils/csv';
import { formatDateTime } from '../utils/formatDateTime';
import { ROUTES } from '../constants/routes';
import { BulkUploadModal } from '../components/bulk/BulkUploadModal';
import { DocketBulkUploadModal } from '../components/bulk/DocketBulkUploadModal';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { UpiCheckoutModal } from '../components/billing/UpiCheckoutModal';
import { SubscriptionInvoiceModal } from '../components/billing/SubscriptionInvoiceModal';
import { subscriptionService } from '../services/subscriptionService';

const enabledDisabledOptions = [
  { value: 'true', label: 'Enabled' },
  { value: 'false', label: 'Disabled' },
];

const weekdayOptions = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

const defaultSlaForm = {
  id: '',
  category: '',
  subcategory: '',
  workbasketId: '',
  slaHours: '',
  isActive: true,
};

const AUDIT_PAGE_SIZE = 25;
const AUDIT_EXPORT_PAGE_SIZE = 100;

const tabs = [
  { id: 'general', label: 'Defaults' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'sla', label: 'SLA Rules' },
  { id: 'import', label: 'Data Import' },
  { id: 'features', label: 'Views' },
  { id: 'plan', label: 'Subscription & Pilot' },
  { id: 'audit', label: 'Audit' },
];

const tabMeta = {
  general: {
    title: 'Operational defaults',
    description: 'Base due dates, reminder lead time, escalation threshold, and workload guidance used across the workspace.',
  },
  calendar: {
    title: 'Work calendar',
    description: 'Working days, holidays, and exceptions used by SLA due dates, reminders, and docket un-pending.',
  },
  sla: {
    title: 'SLA overrides',
    description: 'Rules that override the default SLA for specific categories, subcategories, or workbaskets.',
  },
  import: {
    title: 'Historical Data Import',
    description: 'Import client records and multi-year historical docket work from CSV files for firm onboarding.',
  },
  features: {
    title: 'Workspace views',
    description: 'Turn advanced operational views on or off without changing the underlying workflow data.',
  },
  plan: {
    title: 'Subscription & Pilot',
    description: 'View your firm capacity, check Google Drive security, and upgrade in 1 click.',
  },
  audit: {
    title: 'Audit history',
    description: 'Recent administrative activity for this workspace, paged at 25 records with CSV export.',
  },
};

const featureRows = [
  {
    name: 'enablePerformanceView',
    label: 'Performance analytics',
    helpText: 'Throughput, pace, and workload summary views.',
  },
  {
    name: 'enableEscalationView',
    label: 'Escalation monitoring',
    helpText: 'Overdue, due-soon, and attention-needed views.',
  },
  {
    name: 'enableBulkActions',
    label: 'Bulk actions',
    helpText: 'Batch reassignment and worklist actions for supervisors.',
  },
  {
    name: 'restrictTraineeDownloads',
    label: 'Trainee Laptop Shield',
    helpText: 'Stops article assistants from downloading client files to personal laptops or pendrives. In-app document preview stays active.',
  },
];

const formatAuditValue = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) return value.map((item) => formatAuditValue(item)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const summarizeAuditChanges = (changes = []) => {
  if (!Array.isArray(changes) || changes.length === 0) return 'No field changes recorded.';
  return changes.map((change) => {
    const field = change?.field || 'field';
    return `${field}: ${formatAuditValue(change?.from)} -> ${formatAuditValue(change?.to)}`;
  }).join('; ');
};

const normalizeActivityEntry = (entry = {}) => ({
  id: String(entry?.id || `${entry?.source || 'audit'}-${entry?.timestamp || ''}-${entry?.action || ''}-${entry?.xID || ''}`),
  timestamp: entry?.timestamp || null,
  actor: String(entry?.xID || 'SYSTEM'),
  role: String(entry?.metadata?.actorRole || entry?.metadata?.performedByRole || 'ADMIN'),
  category: String(entry?.source || 'Admin activity'),
  action: String(entry?.action || 'UPDATED'),
  description: String(entry?.description || entry?.action || 'Admin activity recorded'),
  source: String(entry?.source || 'Admin activity'),
  metadata: entry?.metadata ?? null,
  changes: Array.isArray(entry?.changes) ? entry.changes : [],
});

const buildAuditCsv = (entries = []) => buildCsv([
  ['Timestamp', 'Actor', 'Role', 'Category', 'Action', 'Description', 'Metadata'],
  ...entries.map((entry) => ([
    formatDateTime(entry.timestamp),
    entry.actor || 'SYSTEM',
    entry.role || 'ADMIN',
    entry.category || 'Admin activity',
    entry.action || 'UPDATED',
    entry.description || summarizeAuditChanges(entry.changes),
    formatAuditValue(entry.metadata),
  ])),
]);

const getRuleScopeLabel = (rule) => {
  const scopes = [];
  if (rule.category) scopes.push(rule.category);
  if (rule.subcategory) scopes.push(rule.subcategory);
  if (rule.workbasketName || rule.workbasketId) scopes.push(rule.workbasketName || rule.workbasketId);
  if (scopes.length === 0) return 'Default workspace rule';
  return scopes.join(' / ');
};

const isForbidden = (error) => Number(error?.status || error?.response?.status) === 403;

const coerceFirmNumber = (value, fallback, min = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  return normalized >= min ? normalized : fallback;
};

const BackIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M12.5 4.5L7 10l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M15.2 7.2A6 6 0 106 15.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15.5 4.5v3.2h-3.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DownloadIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M10 3.5v8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6.8 8.7L10 11.9l3.2-3.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4.5 15.5h11" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Notice = ({ tone = 'neutral', text }) => {
  if (!text) return null;
  const classes = tone === 'error'
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-slate-200 bg-slate-50 text-slate-700';
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${classes}`}>
      {text}
    </div>
  );
};

const SectionHeading = ({ title, description, aside = null }) => (
  <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-start md:justify-between">
    <div className="space-y-1.5">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <p className="max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
    </div>
    {aside}
  </div>
);

const DateChip = ({ value, onRemove, tone = 'neutral' }) => {
  const toneClasses = tone === 'danger'
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : 'border-sky-200 bg-sky-50 text-sky-700';
  return (
    <span className={`inline-flex items-center gap-2 rounded-xs border px-2.5 py-0.5 text-xs font-medium ${toneClasses}`}>
      <span>{value}</span>
      <button
        type="button"
        onClick={() => onRemove(value)}
        className="text-current/70 transition hover:text-current"
      >
        x
      </button>
    </span>
  );
};

const FeatureToggle = ({ label, helpText, checked, onChange, name }) => (
  <div className="flex items-start justify-between gap-4 border-b border-slate-200 py-4 last:border-b-0 last:pb-0 first:pt-0">
    <div className="space-y-1">
      <p className="text-sm font-medium text-slate-900">{label}</p>
      <p className="text-sm text-slate-500">{helpText}</p>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange({ target: { name, value: checked ? 'false' : 'true' } })}
      className={`relative inline-flex h-7 w-12 shrink-0 rounded-sm border transition ${
        checked ? 'border-slate-900 bg-slate-900' : 'border-slate-300 bg-slate-200'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5.5 w-5.5 rounded-xs bg-white transition ${
          checked ? 'left-6' : 'left-0.5'
        }`}
      />
    </button>
  </div>
);

const MetricTile = ({ label, value, hint }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
    <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">{label}</p>
    <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    <p className="mt-1 text-xs text-slate-500">{hint}</p>
  </div>
);

export const FirmSettingsPage = () => {
  const navigate = useNavigate();
  const { firmSlug } = useParams();

  const [config, setConfig] = useState(getFirmConfig());
  const [activity, setActivity] = useState([]);
  const [activityPagination, setActivityPagination] = useState({
    page: 1,
    limit: AUDIT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
  });
  const [saveMessage, setSaveMessage] = useState({ type: '', text: '' });
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [exportingActivity, setExportingActivity] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [categories, setCategories] = useState([]);
  const [workbaskets, setWorkbaskets] = useState([]);
  const [slaRules, setSlaRules] = useState([]);
  const [loadingSlaData, setLoadingSlaData] = useState(true);
  const [savingSlaRule, setSavingSlaRule] = useState(false);
  const [deletingRuleId, setDeletingRuleId] = useState('');
  const [slaMessage, setSlaMessage] = useState({ type: '', text: '' });
  const [slaForm, setSlaForm] = useState(defaultSlaForm);
  const [holidayDateDraft, setHolidayDateDraft] = useState('');
  const { user } = useAuth();
  const { showToast } = useToast();
  const [showClientBulkModal, setShowClientBulkModal] = useState(false);
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const validTabs = ['general', 'calendar', 'sla', 'import', 'features', 'plan', 'audit'];
  const [currentTab, setCurrentTab] = useState(validTabs.includes(requestedTab) ? requestedTab : 'general');
  const [planData, setPlanData] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [upgradingPlan, setUpgradingPlan] = useState(false);
  const [checkoutOrder, setCheckoutOrder] = useState(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [subscriptionOrders, setSubscriptionOrders] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [loadingInvoiceId, setLoadingInvoiceId] = useState(null);

  useEffect(() => {
    if (requestedTab && validTabs.includes(requestedTab) && requestedTab !== currentTab) {
      setCurrentTab(requestedTab);
    }
  }, [requestedTab, currentTab]);

  const categoryOptions = useMemo(() => ([
    { value: '', label: 'All categories' },
    ...categories.map((category) => ({
      value: category.name,
      label: category.name,
    })),
  ]), [categories]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.name === slaForm.category),
    [categories, slaForm.category],
  );

  const subcategoryOptions = useMemo(() => ([
    { value: '', label: 'All subcategories' },
    ...((selectedCategory?.subcategories || [])
      .filter((subcategory) => subcategory?.isActive !== false)
      .map((subcategory) => ({ value: subcategory.name, label: subcategory.name }))),
  ]), [selectedCategory]);

  const workbasketOptions = useMemo(() => ([
    { value: '', label: 'All workbaskets' },
    ...workbaskets.map((workbasket) => ({
      value: String(workbasket._id),
      label: workbasket.name,
    })),
  ]), [workbaskets]);

  const loadFirmSettings = async () => {
    setLoadingConfig(true);
    try {
      const response = await adminApi.getFirmSettings();
      const serverConfig = response?.data?.firm;
      if (serverConfig) {
        const merged = setFirmConfig(serverConfig);
        setConfig(merged);
      }
    } catch {
      setConfig(getFirmConfig());
    } finally {
      setLoadingConfig(false);
      setHasUnsavedChanges(false);
    }
  };

  const loadActivity = useCallback(async (nextPage = 1) => {
    setLoadingActivity(true);
    setActivityError('');
    try {
      const response = await adminApi.getFirmSettingsActivity({ page: nextPage, limit: AUDIT_PAGE_SIZE });
      const records = Array.isArray(response?.data) ? response.data : [];
      const pagination = response?.pagination || {};
      const normalizedActivity = records
        .map(normalizeActivityEntry)
        .filter((entry) => entry.id && entry.timestamp);

      const total = Number(pagination.total) || normalizedActivity.length;
      const limit = Number(pagination.limit) || AUDIT_PAGE_SIZE;
      const totalPages = Math.max(1, Math.ceil(total / limit));

      setActivity(normalizedActivity);
      setActivityPagination({
        page: Number(pagination.page) || nextPage,
        limit,
        total,
        totalPages,
        hasNextPage: Boolean(pagination.hasNextPage),
      });
    } catch (error) {
      setActivity([]);
      setActivityPagination({
        page: nextPage,
        limit: AUDIT_PAGE_SIZE,
        total: 0,
        totalPages: 1,
        hasNextPage: false,
      });
      setActivityError(
        isForbidden(error)
          ? 'You do not have permission to view admin activity.'
          : 'Could not load audit history right now.',
      );
    } finally {
      setLoadingActivity(false);
    }
  }, []);

  const exportAuditCsv = useCallback(async () => {
    setExportingActivity(true);
    try {
      const collected = [];
      const firstResponse = await adminApi.getFirmSettingsActivity({ page: 1, limit: AUDIT_EXPORT_PAGE_SIZE });
      const firstRows = Array.isArray(firstResponse?.data) ? firstResponse.data : [];
      const firstPagination = firstResponse?.pagination || {};
      const total = Number(firstPagination.total) || firstRows.length;
      const pageSize = Number(firstPagination.limit) || AUDIT_EXPORT_PAGE_SIZE;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      collected.push(...firstRows.map(normalizeActivityEntry));

      for (let page = 2; page <= totalPages; page += 1) {
        const response = await adminApi.getFirmSettingsActivity({ page, limit: AUDIT_EXPORT_PAGE_SIZE });
        const rows = Array.isArray(response?.data) ? response.data : [];
        collected.push(...rows.map(normalizeActivityEntry));
      }

      const csv = buildAuditCsv(collected);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      link.href = url;
      link.download = `firm-settings-audit-${stamp}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setSaveMessage({
        type: 'error',
        text: error?.message || 'Could not export audit history.',
      });
    } finally {
      setExportingActivity(false);
    }
  }, []);

  const [downloadingWeeklyCsv, setDownloadingWeeklyCsv] = useState(false);
  const [triggeringWeeklyDigest, setTriggeringWeeklyDigest] = useState(false);
  const [weeklyDigestNotice, setWeeklyDigestNotice] = useState(null);

  const downloadWeeklyAuditCsv = async () => {
    setDownloadingWeeklyCsv(true);
    setWeeklyDigestNotice(null);
    try {
      const response = await adminApi.exportWeeklyAuditCsv();
      const blob = new Blob([response?.data || response], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `docketra-weekly-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setWeeklyDigestNotice({ type: 'success', text: 'Weekly audit log CSV downloaded.' });
    } catch (err) {
      setWeeklyDigestNotice({ type: 'error', text: err?.response?.data?.message || err?.message || 'Failed to download weekly audit CSV.' });
    } finally {
      setDownloadingWeeklyCsv(false);
    }
  };

  const triggerWeeklyAuditDigestNow = async () => {
    setTriggeringWeeklyDigest(true);
    setWeeklyDigestNotice(null);
    try {
      const res = await adminApi.triggerWeeklyAuditDigest();
      setWeeklyDigestNotice({ type: 'success', text: res?.message || 'Weekly audit summary CSV sent to Primary Admin email.' });
    } catch (err) {
      setWeeklyDigestNotice({ type: 'error', text: err?.response?.data?.message || err?.message || 'Failed to send weekly audit digest email.' });
    } finally {
      setTriggeringWeeklyDigest(false);
    }
  };

  const loadSlaData = async () => {
    setLoadingSlaData(true);
    setSlaMessage({ type: '', text: '' });
    try {
      const [categoryResult, workbasketResult, slaResult] = await Promise.allSettled([
        categoryService.getAdminCategories(false),
        adminApi.listWorkbaskets({ includeInactive: true }),
        slaApi.getRules({ includeInactive: true }),
      ]);

      setCategories(categoryResult.status === 'fulfilled' && Array.isArray(categoryResult.value?.data) ? categoryResult.value.data : []);
      setWorkbaskets(workbasketResult.status === 'fulfilled' && Array.isArray(workbasketResult.value?.data) ? workbasketResult.value.data : []);

      if (slaResult.status === 'fulfilled') {
        setSlaRules(Array.isArray(slaResult.value?.data) ? slaResult.value.data : []);
      } else {
        setSlaRules([]);
        setSlaMessage({
          type: 'error',
          text: isForbidden(slaResult.reason)
            ? 'You do not have permission to view SLA settings.'
            : 'Could not load SLA configuration.',
        });
      }
    } catch (error) {
      setCategories([]);
      setWorkbaskets([]);
      setSlaRules([]);
      setSlaMessage({
        type: 'error',
        text: isForbidden(error)
          ? 'You do not have permission to view SLA settings.'
          : 'Could not load SLA configuration.',
      });
    } finally {
      setLoadingSlaData(false);
    }
  };

  const loadPlanData = useCallback(async () => {
    setLoadingPlan(true);
    try {
      const [planRes, subRes] = await Promise.allSettled([
        adminApi.getFirmPlan(),
        subscriptionService.getSubscriptionOverview(),
      ]);
      if (planRes.status === 'fulfilled' && planRes.value?.data) {
        setPlanData(planRes.value.data);
      }
      if (subRes.status === 'fulfilled' && subRes.value?.data?.recentOrders) {
        setSubscriptionOrders(subRes.value.data.recentOrders);
      }
    } catch {
      // ignore
    } finally {
      setLoadingPlan(false);
    }
  }, []);

  const handleViewInvoice = async (orderId) => {
    setLoadingInvoiceId(orderId);
    try {
      const res = await subscriptionService.getInvoice(orderId);
      if (res?.success && res?.data) {
        setSelectedInvoice(res.data);
        setShowInvoiceModal(true);
      } else {
        throw new Error(res?.message || 'Invoice not found');
      }
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || 'Failed to load invoice.', 'error');
    } finally {
      setLoadingInvoiceId(null);
    }
  };

  const handleResumePayment = (order) => {
    setCheckoutOrder(order);
    setShowCheckoutModal(true);
  };

  const handleUpgradePlan = async (targetPlan) => {
    setUpgradingPlan(true);
    try {
      const res = await subscriptionService.createSubscriptionOrder({
        plan: targetPlan,
        billingCycle: 'annual',
      });
      if (res?.success && res?.data) {
        setCheckoutOrder(res.data);
        setShowCheckoutModal(true);
      } else {
        throw new Error(res?.message || 'Could not initiate payment session');
      }
    } catch (error) {
      showToast(error?.response?.data?.message || error?.message || 'Failed to initiate checkout.', 'error');
    } finally {
      setUpgradingPlan(false);
    }
  };

  useEffect(() => {
    void loadActivity(1);
    void loadFirmSettings();
    void loadSlaData();
    void loadPlanData();
  }, [loadActivity, loadPlanData]);

  useEffect(() => {
    if (currentTab === 'plan' && !planData && !loadingPlan) {
      void loadPlanData();
    }
  }, [currentTab, planData, loadingPlan, loadPlanData]);

  const handleNumberChange = (event) => {
    const { name, value } = event.target;
    setSaveMessage({ type: '', text: '' });
    setConfig((prev) => ({ ...prev, [name]: value }));
    setHasUnsavedChanges(true);
  };

  const handleToggleChange = (event) => {
    const { name, value } = event.target;
    setSaveMessage({ type: '', text: '' });
    setConfig((prev) => ({ ...prev, [name]: value === 'true' }));
    setHasUnsavedChanges(true);
  };

  const handleTextChange = (event) => {
    const { name, value } = event.target;
    setSaveMessage({ type: '', text: '' });
    setConfig((prev) => ({ ...prev, [name]: value }));
    setHasUnsavedChanges(true);
  };

  const toggleWorkingDay = (day) => {
    setSaveMessage({ type: '', text: '' });
    setConfig((prev) => {
      const current = Array.isArray(prev.slaWorkingDays) ? prev.slaWorkingDays : [1, 2, 3, 4, 5];
      const next = current.includes(day)
        ? current.filter((entry) => entry !== day)
        : [...current, day].sort((a, b) => a - b);
      return { ...prev, slaWorkingDays: next.length ? next : current };
    });
    setHasUnsavedChanges(true);
  };

  const addCalendarDate = (fieldName, value, reset) => {
    const normalized = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return;
    setConfig((prev) => ({
      ...prev,
      [fieldName]: [...new Set([...(Array.isArray(prev[fieldName]) ? prev[fieldName] : []), normalized])].sort(),
    }));
    reset('');
    setHasUnsavedChanges(true);
    setSaveMessage({ type: '', text: '' });
  };

  const removeCalendarDate = (fieldName, value) => {
    setConfig((prev) => ({
      ...prev,
      [fieldName]: (Array.isArray(prev[fieldName]) ? prev[fieldName] : []).filter((entry) => entry !== value),
    }));
    setHasUnsavedChanges(true);
    setSaveMessage({ type: '', text: '' });
  };

  const handleSave = async () => {
    if (loadingConfig || savingConfig) return;

    setSavingConfig(true);
    setSaveMessage({ type: '', text: '' });
    const firmDefaults = getFirmConfig();

    const firmPayload = {
      slaDefaultDays: coerceFirmNumber(config.slaDefaultDays, firmDefaults.slaDefaultDays, 1),
      slaWorkingDays: Array.isArray(config.slaWorkingDays) && config.slaWorkingDays.length ? config.slaWorkingDays : [1, 2, 3, 4, 5],
      slaHolidayDates: Array.isArray(config.slaHolidayDates) ? config.slaHolidayDates : [],
      slaWorkingDateOverrides: Array.isArray(config.slaWorkingDateOverrides) ? config.slaWorkingDateOverrides : [],
      calendarReminderLeadDays: coerceFirmNumber(config.calendarReminderLeadDays, firmDefaults.calendarReminderLeadDays, 0),
      escalationInactivityThresholdHours: coerceFirmNumber(
        config.escalationInactivityThresholdHours,
        firmDefaults.escalationInactivityThresholdHours,
        1,
      ),
      workloadThreshold: coerceFirmNumber(config.workloadThreshold, firmDefaults.workloadThreshold, 1),
      enablePerformanceView: Boolean(config.enablePerformanceView),
      enableEscalationView: Boolean(config.enableEscalationView),
      enableBulkActions: Boolean(config.enableBulkActions),
      brandLogoUrl: typeof config.brandLogoUrl === 'string' ? config.brandLogoUrl.trim() : '',
      strictFirmOwnedStorage: Boolean(config.strictFirmOwnedStorage),
      restrictTraineeDownloads: Boolean(config.restrictTraineeDownloads),
    };

    try {
      const response = await adminApi.updateFirmSettings({ firm: firmPayload });
      const saved = setFirmConfig(response?.data?.firm || firmPayload);
      setConfig(saved);
      setHasUnsavedChanges(false);
      setSaveMessage({ type: 'success', text: 'Settings saved.' });
      void loadActivity(1);
    } catch (error) {
      const errorText = error?.data?.error || error?.message || 'Could not save settings.';
      setSaveMessage({ type: 'error', text: errorText });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSlaFormChange = (event) => {
    const { name, value } = event.target;
    setSlaMessage({ type: '', text: '' });
    setSlaForm((prev) => ({
      ...prev,
      [name]: name === 'isActive' ? value === 'true' : value,
      ...(name === 'category' ? { subcategory: '' } : {}),
    }));
  };

  const resetSlaForm = () => {
    setSlaForm(defaultSlaForm);
    setSlaMessage({ type: '', text: '' });
  };

  const handleEditRule = (rule) => {
    setSlaForm({
      id: rule._id || rule.id || '',
      category: rule.category || '',
      subcategory: rule.subcategory || '',
      workbasketId: rule.workbasketId || '',
      slaHours: String(rule.slaWorkingDays || (rule.slaHours ? Number(rule.slaHours) / 8 : '') || ''),
      isActive: rule.isActive !== false,
    });
    setCurrentTab('sla');
    setSlaMessage({ type: '', text: '' });
  };

  const handleSaveRule = async () => {
    if (!slaForm.slaHours || Number(slaForm.slaHours) <= 0) {
      setSlaMessage({ type: 'error', text: 'Enter a valid SLA working-day value.' });
      return;
    }

    setSavingSlaRule(true);
    try {
      await slaApi.saveRule({
        ...(slaForm.id ? { id: slaForm.id } : {}),
        category: slaForm.category || null,
        subcategory: slaForm.subcategory || null,
        workbasketId: slaForm.workbasketId || null,
        slaWorkingDays: Number(slaForm.slaHours),
        isActive: Boolean(slaForm.isActive),
      });
      await loadSlaData();
      resetSlaForm();
      setSlaMessage({ type: 'success', text: 'SLA rule saved.' });
    } catch (error) {
      setSlaMessage({ type: 'error', text: error?.message || 'Could not save the SLA rule.' });
    } finally {
      setSavingSlaRule(false);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!ruleId) return;
    setDeletingRuleId(ruleId);
    setSlaMessage({ type: '', text: '' });
    try {
      await slaApi.deleteRule(ruleId);
      await loadSlaData();
      if (slaForm.id === ruleId) {
        resetSlaForm();
      }
      setSlaMessage({ type: 'success', text: 'SLA rule deleted.' });
    } catch (error) {
      setSlaMessage({ type: 'error', text: error?.message || 'Could not delete the SLA rule.' });
    } finally {
      setDeletingRuleId('');
    }
  };

  const activeTabMeta = tabMeta[currentTab] || tabMeta.general;

  const generalMetrics = [
    {
      label: 'Default SLA',
      value: `${coerceFirmNumber(config.slaDefaultDays, 3, 1)}d`,
      hint: 'Used when no rule override exists.',
    },
    {
      label: 'Reminder lead',
      value: `${coerceFirmNumber(config.calendarReminderLeadDays, 3, 0)}d`,
      hint: 'Shown ahead of important deadlines.',
    },
    {
      label: 'Escalation',
      value: `${coerceFirmNumber(config.escalationInactivityThresholdHours, 24, 1)}h`,
      hint: 'Inactivity threshold before attention is raised.',
    },
    {
      label: 'Workload cap',
      value: String(coerceFirmNumber(config.workloadThreshold, 15, 1)),
      hint: 'Reference ceiling for user allocation.',
    },
  ];

  return (
    <PlatformShell
      moduleLabel="Settings"
      title="Firm Settings"
      subtitle="Keep workspace defaults, calendars, SLA rules, and views in one place."
    >
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <button
          type="button"
          onClick={() => navigate(ROUTES.SETTINGS(firmSlug))}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <BackIcon />
          <span>Back to settings</span>
        </button>

        <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="space-y-6 p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Workspace control</p>
                <h1 className="text-2xl font-semibold text-slate-950">Firm settings</h1>
                <p className="max-w-3xl text-sm leading-6 text-slate-500">
                  Keep the surface simple: set the defaults once, define the working calendar, add only the SLA exceptions you need, and review the audit trail when something changes.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {generalMetrics.map((metric) => (
                  <MetricTile
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                    hint={metric.hint}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-100/80 p-1.5 backdrop-blur-sm">
              <div className="flex flex-wrap gap-1.5">
                {tabs.map((tab) => {
                  const active = currentTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setCurrentTab(tab.id);
                        setSaveMessage((prev) => (prev.type === 'success' ? { type: '', text: '' } : prev));
                      }}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 ${
                        active
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                          : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-950">
                {hasUnsavedChanges ? 'Unsaved changes' : 'Settings state'}
              </p>
              <p className="text-sm text-slate-500">
                {hasUnsavedChanges
                  ? 'Review the current tab and save when you are ready.'
                  : 'Changes apply across reminders, SLA handling, and the shared calendar.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={loadFirmSettings}
                disabled={loadingConfig || savingConfig || !hasUnsavedChanges}
              >
                Discard
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSave}
                disabled={loadingConfig || savingConfig || !hasUnsavedChanges}
                loading={savingConfig}
              >
                {savingConfig ? 'Saving...' : 'Save settings'}
              </Button>
            </div>
          </div>
        </Card>

        <Notice tone={saveMessage.type || 'neutral'} text={saveMessage.text} />

        <Card className="border border-slate-200 bg-white shadow-sm">
          <div className="space-y-6 p-5 sm:p-6">
            <SectionHeading title={activeTabMeta.title} description={activeTabMeta.description} />

            {currentTab === 'general' && (
              <div className="grid gap-6 lg:grid-cols-[1.05fr_1.65fr]">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-900">What these defaults control</p>
                  <div className="space-y-3 text-sm leading-6 text-slate-500">
                    <p>Default SLA days are used when no category rule overrides them.</p>
                    <p>Reminder lead time feeds calendar warnings for upcoming deadlines.</p>
                    <p>Escalation and workload values drive management views and attention states.</p>
                  </div>
                </div>

                <div className="grid gap-6">
                  <Card className="border border-slate-200 bg-white p-5 shadow-none">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Input
                        label="Default SLA deadline (days)"
                        name="slaDefaultDays"
                        type="number"
                        min="1"
                        value={config.slaDefaultDays}
                        onChange={handleNumberChange}
                        helpText="Used if no SLA rule override exists."
                      />
                      <Input
                        label="Reminder lead time (days)"
                        name="calendarReminderLeadDays"
                        type="number"
                        min="0"
                        max="30"
                        value={config.calendarReminderLeadDays}
                        onChange={handleNumberChange}
                        helpText="How early reminders appear before the due date."
                      />
                      <Input
                        label="Escalation inactivity limit (hours)"
                        name="escalationInactivityThresholdHours"
                        type="number"
                        min="1"
                        value={config.escalationInactivityThresholdHours}
                        onChange={handleNumberChange}
                        helpText="Hours without movement before attention is raised."
                      />
                      <Input
                        label="Maximum workload cap"
                        name="workloadThreshold"
                        type="number"
                        min="1"
                        value={config.workloadThreshold}
                        onChange={handleNumberChange}
                        helpText="Reference cap used in capacity views."
                      />
                    </div>
                  </Card>

                  <Card className="border border-slate-200 bg-white p-5 shadow-none">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-slate-900">Workspace branding</p>
                        <p className="mt-1 text-sm text-slate-500">Optional. Keeps the page lightweight while still letting you replace the default initials with a logo.</p>
                      </div>
                      <Input
                        label="Brand logo URL"
                        name="brandLogoUrl"
                        type="url"
                        placeholder="https://example.com/logo.png"
                        value={config.brandLogoUrl || ''}
                        onChange={handleTextChange}
                        helpText="A publicly reachable logo URL."
                      />
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {currentTab === 'calendar' && (
              <div className="grid gap-6 lg:grid-cols-[1.05fr_1.65fr]">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-900">Shared operational calendar</p>
                  <div className="space-y-3 text-sm leading-6 text-slate-500">
                    <p>These dates are used by reminder generation, working-day SLA math, and how a docket resumes after pending.</p>
                    <p>Keep this list short and deliberate. Add only firm-wide exceptions.</p>
                  </div>
                </div>

                <div className="grid gap-6">
                  <Card className="border border-slate-200 bg-white p-5 shadow-none">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-slate-900">Working week</p>
                        <p className="mt-1 text-sm text-slate-500">Choose the days treated as working days for due date calculation.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {weekdayOptions.map((day) => {
                          const isWorking = (config.slaWorkingDays || []).includes(day.value);
                          return (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => toggleWorkingDay(day.value)}
                              className={`min-w-[64px] rounded-xl border px-4 py-2 text-sm font-medium transition ${
                                isWorking
                                  ? 'border-slate-900 bg-slate-900 text-white'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                              }`}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </Card>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <Card className="border border-slate-200 bg-white p-5 shadow-none">
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-medium text-slate-900">Holidays and off days</p>
                          <p className="mt-1 text-sm text-slate-500">Deadlines skip these dates automatically.</p>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={holidayDateDraft}
                            onChange={(event) => setHolidayDateDraft(event.target.value)}
                            className="min-h-11 flex-1 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                          />
                          <Button
                            type="button"
                            variant="primary"
                            onClick={() => addCalendarDate('slaHolidayDates', holidayDateDraft, setHolidayDateDraft)}
                          >
                            Add
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(config.slaHolidayDates || []).length ? (
                            (config.slaHolidayDates || []).map((date) => (
                              <DateChip
                                key={date}
                                value={date}
                                tone="danger"
                                onRemove={(selected) => removeCalendarDate('slaHolidayDates', selected)}
                              />
                            ))
                          ) : (
                            <p className="text-sm text-slate-400">No holidays configured.</p>
                          )}
                        </div>
                      </div>
                    </Card>

                    <Card className="border border-slate-200 bg-white p-5 shadow-none">
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-medium text-slate-900">Working-day overrides</p>
                          <p className="mt-1 text-sm text-slate-500">Use this when a non-working day should still count as active.</p>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={workingDateDraft}
                            onChange={(event) => setWorkingDateDraft(event.target.value)}
                            className="min-h-11 flex-1 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                          />
                          <Button
                            type="button"
                            variant="primary"
                            onClick={() => addCalendarDate('slaWorkingDateOverrides', workingDateDraft, setWorkingDateDraft)}
                          >
                            Add
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(config.slaWorkingDateOverrides || []).length ? (
                            (config.slaWorkingDateOverrides || []).map((date) => (
                              <DateChip
                                key={date}
                                value={date}
                                onRemove={(selected) => removeCalendarDate('slaWorkingDateOverrides', selected)}
                              />
                            ))
                          ) : (
                            <p className="text-sm text-slate-400">No overrides configured.</p>
                          )}
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              </div>
            )}

            {currentTab === 'sla' && (
              <div className="grid gap-6 lg:grid-cols-[1.05fr_1.65fr]">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-900">Override only where needed</p>
                  <div className="space-y-3 text-sm leading-6 text-slate-500">
                    <p>Use a workspace default for most work. Add rules only for the categories or teams that genuinely need a different SLA.</p>
                    <p>These rules sit on top of the calendar settings above, so weekends and holidays are still respected.</p>
                  </div>
                </div>

                <div className="grid gap-6">
                  <Card className="border border-slate-200 bg-white p-5 shadow-none">
                    <div className="space-y-5">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{slaForm.id ? 'Edit SLA rule' : 'Create SLA rule'}</p>
                        <p className="mt-1 text-sm text-slate-500">Scope the rule as narrowly as needed. Leaving a field blank keeps it broader.</p>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <Select
                          label="Category"
                          name="category"
                          value={slaForm.category}
                          onChange={handleSlaFormChange}
                          options={categoryOptions}
                        />
                        <Select
                          label="Subcategory"
                          name="subcategory"
                          value={slaForm.subcategory}
                          onChange={handleSlaFormChange}
                          options={subcategoryOptions}
                        />
                        <Select
                          label="Workbasket"
                          name="workbasketId"
                          value={slaForm.workbasketId}
                          onChange={handleSlaFormChange}
                          options={workbasketOptions}
                        />
                        <Input
                          label="Working days"
                          name="slaHours"
                          type="number"
                          min="1"
                          value={slaForm.slaHours}
                          onChange={handleSlaFormChange}
                        />
                        <Select
                          label="Status"
                          name="isActive"
                          value={String(Boolean(slaForm.isActive))}
                          onChange={handleSlaFormChange}
                          options={enabledDisabledOptions}
                        />
                      </div>

                      <Notice tone={slaMessage.type || 'neutral'} text={slaMessage.text} />

                      <div className="flex flex-wrap justify-end gap-2">
                        {slaForm.id ? (
                          <Button type="button" variant="outline" onClick={resetSlaForm}>
                            Cancel
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="primary"
                          onClick={handleSaveRule}
                          disabled={savingSlaRule || loadingSlaData}
                          loading={savingSlaRule}
                        >
                          {slaForm.id ? 'Update rule' : 'Save rule'}
                        </Button>
                      </div>
                    </div>
                  </Card>

                  <Card className="border border-slate-200 bg-white p-5 shadow-none">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-slate-900">Current rules</p>
                        <p className="mt-1 text-sm text-slate-500">The most specific rule wins over the workspace default.</p>
                      </div>

                      {loadingSlaData ? (
                        <p className="text-sm text-slate-400">Loading SLA rules...</p>
                      ) : slaRules.length ? (
                        <div className="space-y-3">
                          {slaRules.map((rule) => {
                            const ruleId = rule._id || rule.id;
                            return (
                              <div key={ruleId} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="space-y-1">
                                    <p className="text-sm font-medium text-slate-900">{getRuleScopeLabel(rule)}</p>
                                    <p className="text-sm text-slate-500">
                                      {(rule.slaWorkingDays || (rule.slaHours ? Number(rule.slaHours) / 8 : '-'))} working days
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`rounded-xs px-2.5 py-0.5 text-xs font-medium ${
                                      rule.isActive === false ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'
                                    }`}>
                                      {rule.isActive === false ? 'Inactive' : 'Active'}
                                    </span>
                                    <Button type="button" variant="outline" size="sm" onClick={() => handleEditRule(rule)}>
                                      Edit
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeleteRule(ruleId)}
                                      disabled={deletingRuleId === ruleId}
                                    >
                                      {deletingRuleId === ruleId ? 'Deleting...' : 'Delete'}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <EmptyState
                          title="No SLA overrides yet"
                          description="The workspace default SLA is active until you add a rule."
                        />
                      )}
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {currentTab === 'import' && (
              <div className="grid gap-6 lg:grid-cols-[1.05fr_1.65fr]">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-900">Onboard Firm Data in Bulk</p>
                  <div className="space-y-3 text-sm leading-6 text-slate-500">
                    <p>Import client master records and multi-year historical docket work from CSV files.</p>
                    <p>Download pre-filled templates, fill in past records, and upload to import into Docketra.</p>
                  </div>
                </div>

                <div className="grid gap-6">
                  <Card className="border border-slate-200 bg-white p-5 shadow-none">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-slate-900">1. Client Bulk Import</p>
                        <p className="mt-1 text-sm text-slate-500">Import client master records (Business Name, Email, Phone, PAN, GST, etc.) from CSV.</p>
                      </div>
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => setShowClientBulkModal(true)}
                        disabled={!(user?.role === 'PRIMARY_ADMIN' || Boolean(user?.isPrimaryAdmin))}
                      >
                        Import Clients
                      </Button>
                    </div>
                  </Card>

                  <Card className="border border-slate-200 bg-white p-5 shadow-none">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-slate-900">2. Historical Docket Bulk Import</p>
                        <p className="mt-1 text-sm text-slate-500">Download a template pre-filled with your firm's clients and upload past resolved/active dockets.</p>
                      </div>
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => setShowDocketBulkModal(true)}
                        disabled={!(user?.role === 'PRIMARY_ADMIN' || Boolean(user?.isPrimaryAdmin))}
                      >
                        Import Dockets
                      </Button>
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {currentTab === 'features' && (
              <div className="grid gap-6 lg:grid-cols-[1.05fr_1.65fr]">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-900">Keep only the views the team needs</p>
                  <div className="space-y-3 text-sm leading-6 text-slate-500">
                    <p>These toggles simplify the workspace without changing underlying data or workflows.</p>
                    <p>Turn a view back on at any time if the team needs it again.</p>
                  </div>
                </div>

                <Card className="border border-slate-200 bg-white p-5 shadow-none">
                  {featureRows.map((row) => (
                    <FeatureToggle
                      key={row.name}
                      label={row.label}
                      helpText={row.helpText}
                      checked={Boolean(config[row.name])}
                      onChange={handleToggleChange}
                      name={row.name}
                    />
                  ))}
                </Card>
              </div>
            )}

            {currentTab === 'plan' && (
              <div className="space-y-6">
                {/* Sovereign Foundation Banner */}
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-indigo-600 p-2 text-white shrink-0">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                      </svg>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                      <strong>Client files stay in your firm’s Google Drive.</strong> Article assistants cannot download files to personal laptops, and every sign-off is logged for ICAI/ICSI peer review.
                    </p>
                  </div>
                </div>

                {/* Current Active Tier & Boundary Verification */}
                <Card className="border border-slate-200 bg-white p-5 sm:p-6 shadow-none">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-xs bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                          <span className="h-2 w-2 rounded-xs bg-emerald-500 animate-pulse" />
                          {planData?.tierName || (planData?.isPilot ? 'Free Pilot' : 'Active Plan')}
                        </span>
                        {planData?.isPilot && (
                          <span className="rounded-xs bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 border border-slate-200/60">
                            ₹0 forever
                          </span>
                        )}
                      </div>
                      <h2 className="mt-2 text-xl font-bold text-slate-900">
                        {planData?.isPilot
                          ? 'Free Pilot (Proof of Sovereign Isolation)'
                          : `${planData?.tierName || 'Current Plan'}`}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {planData?.isPilot
                          ? 'Test with up to 5 clients and 2 seats. Verify Google Drive safety and trainee laptop download blocks before upgrading.'
                          : 'Active plan with Google Drive storage and unlimited dockets.'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void loadPlanData()}
                      loading={loadingPlan}
                    >
                      <RefreshIcon />
                      <span className="ml-1.5">Refresh Status</span>
                    </Button>
                  </div>

                  {/* Capacity Usage Meters */}
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 shadow-xs">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Staff Seats</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums font-mono">
                        {planData?.currentUsage?.usersCount ?? 1} / {planData?.limits?.maxSeats ?? 2}
                      </p>
                      <div className="mt-2 h-1.5 w-full rounded-xs bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-xs transition-all duration-300"
                          style={{
                            width: `${Math.min(100, (((planData?.currentUsage?.usersCount ?? 1) / (planData?.limits?.maxSeats ?? 2)) * 100))}%`,
                          }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">Article assistants, clerks & partners</p>
                    </div>

                    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 shadow-xs">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Active Clients</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums font-mono">
                        {planData?.currentUsage?.clientsCount ?? 0} / {planData?.limits?.maxClients ?? 5}
                      </p>
                      <div className="mt-2 h-1.5 w-full rounded-xs bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-xs transition-all duration-300"
                          style={{
                            width: `${Math.min(100, (((planData?.currentUsage?.clientsCount ?? 0) / (planData?.limits?.maxClients ?? 5)) * 100))}%`,
                          }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">Active client master records</p>
                    </div>

                    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 shadow-xs">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Monthly Dockets</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums font-mono">
                        {planData?.currentUsage?.monthlyDocketsCount ?? 0} / {planData?.limits?.maxDocketsMonthly ? `${planData.limits.maxDocketsMonthly}` : 'Unlimited'}
                      </p>
                      <div className="mt-2 h-1.5 w-full rounded-xs bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-sky-600 rounded-xs transition-all duration-300"
                          style={{
                            width: planData?.limits?.maxDocketsMonthly
                              ? `${Math.min(100, (((planData?.currentUsage?.monthlyDocketsCount ?? 0) / planData.limits.maxDocketsMonthly) * 100))}%`
                              : '100%',
                          }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">Active compliance workflows</p>
                    </div>
                  </div>

                  {/* Live Security Verification Checks */}
                  <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Security & Compliance Checks</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">✓</span>
                        <div>
                          <p className="text-xs font-semibold text-slate-900">Google Drive Connected</p>
                          <p className="text-[11px] text-slate-500">Files saved to your Drive. Pre-existing files cannot be read.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">0</span>
                        <div>
                          <p className="text-xs font-semibold text-slate-900">Zero Outside Access</p>
                          <p className="text-[11px] text-slate-500">0 outside files readable. Tested and verified.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">✓</span>
                        <div>
                          <p className="text-xs font-semibold text-slate-900">Trainee Laptop Shield</p>
                          <p className="text-[11px] text-slate-500">Raw downloads blocked on junior laptops. In-app preview only.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* 1-Click Friction-Free Upgrade Cards */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">Upgrade your plan</h3>
                      <p className="text-sm text-slate-500">
                        Zero file transfer needed. All your client folders and dockets stay in your Drive.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Pioneer 30 Card */}
                    <div className={`relative flex flex-col justify-between rounded-2xl border p-6 transition ${
                      planData?.plan === 'starter'
                        ? 'border-indigo-600 bg-indigo-50/20 ring-2 ring-indigo-600'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                            Pioneer 30 Cohort
                          </span>
                          <span className="text-xs font-medium text-slate-500">Locked Rate for Life</span>
                        </div>
                        <div>
                          <h4 className="text-xl font-bold text-slate-900">Pioneer 30 Annual Pass</h4>
                          <p className="mt-1 text-sm text-slate-500">For boutique CA and CS firms with up to 5 team members.</p>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-extrabold text-slate-900">₹12,990</span>
                          <span className="text-sm text-slate-500">/ year</span>
                          <span className="ml-2 text-xs text-slate-400 line-through">₹17,990</span>
                        </div>
                        <ul className="space-y-2.5 text-sm text-slate-600 border-t border-slate-100 pt-4">
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span><strong>Up to 5 staff seats</strong></span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span><strong>50 active clients</strong></span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span><strong>Unlimited dockets</strong> (MCA, ROC, GST, ITR)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span>Client files in your own Google Drive</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span>Trainee Laptop Shield enabled</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span>WhatsApp Forwarding Bridge for quick drops</span>
                          </li>
                        </ul>
                      </div>
                      <div className="mt-6 pt-4 border-t border-slate-100">
                        <Button
                          type="button"
                          variant={planData?.plan === 'starter' ? 'outline' : 'primary'}
                          className="w-full"
                          disabled={planData?.plan === 'starter' || planData?.plan === 'growth' || planData?.plan === 'professional' || upgradingPlan}
                          loading={upgradingPlan}
                          onClick={() => void handleUpgradePlan('starter')}
                        >
                          {planData?.plan === 'starter'
                            ? 'Current Active Plan'
                            : (planData?.plan === 'growth' || planData?.plan === 'professional' ? 'Included in Higher Plan' : 'Upgrade to Pioneer 30')}
                        </Button>
                      </div>
                    </div>

                    {/* Growth Tier Card */}
                    <div className={`relative flex flex-col justify-between rounded-2xl border p-6 transition ${
                      planData?.plan === 'growth'
                        ? 'border-indigo-600 bg-indigo-50/20 ring-2 ring-indigo-600'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800">
                            Top Choice for 6 to 12 Staff • 25% Practice Selection
                          </span>
                          <span className="text-xs font-medium text-slate-500">6 to 12 staff</span>
                        </div>
                        <div>
                          <h4 className="text-xl font-bold text-slate-900">Growth Tier</h4>
                          <p className="mt-1 text-sm text-slate-500">For mid-sized firms requiring department queues, trainee shields & multi-partner review.</p>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-extrabold text-slate-900">₹21,990</span>
                          <span className="text-sm text-slate-500">/ year</span>
                          <span className="ml-2 text-xs text-slate-500">(₹1,832 / month)</span>
                        </div>
                        <ul className="space-y-2.5 text-sm text-slate-600 border-t border-slate-100 pt-4">
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span><strong>Up to 12 staff seats</strong> (+₹1,200/seat/yr add-on)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span><strong>150 active clients</strong></span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span><strong>Pre-loaded blueprints:</strong> Form 3CD, MCA, and GST checklists</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span><strong>Trainee Laptop Shield:</strong> Blocks raw downloads to personal laptops</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span><strong>Drive Tamper Guard:</strong> Auto-detects moved/deleted folders with 1-click restore</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span><strong>Department queues:</strong> ROC, Tax, Corporate & Audit workbaskets</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span><strong>SQC-1 maker-checker review:</strong> Peer-review ready partner sign-offs</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span>Priority phone & WhatsApp onboarding support</span>
                          </li>
                        </ul>
                      </div>
                      <div className="mt-6 pt-4 border-t border-slate-100">
                        <Button
                          type="button"
                          variant={planData?.plan === 'growth' ? 'outline' : 'primary'}
                          className="w-full"
                          disabled={planData?.plan === 'growth' || planData?.plan === 'pro' || planData?.plan === 'professional' || upgradingPlan}
                          loading={upgradingPlan}
                          onClick={() => void handleUpgradePlan('growth')}
                        >
                          {planData?.plan === 'growth'
                            ? 'Current Active Plan'
                            : (planData?.plan === 'pro' || planData?.plan === 'professional' ? 'Included in Higher Plan' : 'Upgrade to Growth Tier')}
                        </Button>
                      </div>
                    </div>

                    {/* Pro Tier Card */}
                    <div className={`relative flex flex-col justify-between rounded-2xl border p-6 transition ${
                      planData?.plan === 'pro' || planData?.plan === 'professional'
                        ? 'border-indigo-600 bg-indigo-50/20 ring-2 ring-indigo-600'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800">
                            Corporate & Multi-Branch
                          </span>
                          <span className="text-xs font-medium text-slate-500">15+ staff</span>
                        </div>
                        <div>
                          <h4 className="text-xl font-bold text-slate-900">Pro Tier</h4>
                          <p className="mt-1 text-sm text-slate-500">For multi-partner firms requiring DSC routing, custom roles, and priority support.</p>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-extrabold text-slate-900">₹59,990</span>
                          <span className="text-sm text-slate-500">/ year</span>
                          <span className="ml-2 text-xs text-slate-500">(₹4,999 / month)</span>
                        </div>
                        <ul className="space-y-2.5 text-sm text-slate-600 border-t border-slate-100 pt-4">
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span><strong>Up to 25 staff seats</strong></span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span><strong>Unlimited active clients & dockets</strong></span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span>Multi-department queues (ROC, Tax, GST, Legal)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span>Multi-partner DSC sign-off routing workflows</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span>Dedicated onboarding & migration engineer</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span>Custom practice roles & granular permissions</span>
                          </li>
                        </ul>
                      </div>
                      <div className="mt-6 pt-4 border-t border-slate-100">
                        <Button
                          type="button"
                          variant={planData?.plan === 'pro' || planData?.plan === 'professional' ? 'outline' : 'primary'}
                          className="w-full"
                          disabled={planData?.plan === 'pro' || planData?.plan === 'professional' || upgradingPlan}
                          loading={upgradingPlan}
                          onClick={() => void handleUpgradePlan('pro')}
                        >
                          {planData?.plan === 'pro' || planData?.plan === 'professional'
                            ? 'Current Active Plan'
                            : 'Upgrade to Pro Tier'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Anti-Jamku Stance Callout */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-3">
                  <h4 className="text-base font-semibold text-slate-900">
                    Why Docketra does not offer ₹6,500 generic task tracker rates
                  </h4>
                  <p className="text-sm leading-6 text-slate-600">
                    Generic office tools store client data on shared servers without download controls or maker-checker audit logs. Docketra gives you full custody and compliance:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-1">
                      <p className="text-xs font-semibold text-slate-900">1. Your Drive, your custody</p>
                      <p className="text-xs leading-5 text-slate-500">
                        Files stay in your firm’s Google Drive. Even if you leave Docketra, your documents remain with you.
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-1">
                      <p className="text-xs font-semibold text-slate-900">2. Peer-review ready</p>
                      <p className="text-xs leading-5 text-slate-500">
                        ICAI/ICSI SQC-1 maker-checker audit trail. Every note, checklist, and partner approval is logged with timestamps.
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-1">
                      <p className="text-xs font-semibold text-slate-900">3. Trainee Laptop Shield</p>
                      <p className="text-xs leading-5 text-slate-500">
                        Article assistants view files inside Docketra without saving client returns to personal pendrives or laptops.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Payment & Invoice History */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="text-base font-semibold text-slate-900">Payment & Invoice History</h4>
                      <p className="text-xs text-slate-500">
                        Official tax invoices and payment receipts for your firm’s Docketra subscriptions.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void loadPlanData()}
                      className="text-xs"
                    >
                      Refresh History
                    </Button>
                  </div>

                  {subscriptionOrders.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center">
                      <p className="text-xs font-medium text-slate-600">No payment history yet</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        When you upgrade your plan, payment records and downloadable invoices will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-100">
                      <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            <th scope="col" className="px-3.5 py-2.5 font-semibold text-slate-600">Date & Order ID</th>
                            <th scope="col" className="px-3.5 py-2.5 font-semibold text-slate-600">Plan & Cycle</th>
                            <th scope="col" className="px-3.5 py-2.5 font-semibold text-slate-600">Amount</th>
                            <th scope="col" className="px-3.5 py-2.5 font-semibold text-slate-600">Bank UTR</th>
                            <th scope="col" className="px-3.5 py-2.5 font-semibold text-slate-600">Status</th>
                            <th scope="col" className="px-3.5 py-2.5 text-right font-semibold text-slate-600">Invoice</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {subscriptionOrders.map((ord) => {
                            const isPaid = ord.status === 'COMPLETED';
                            const isPending = ord.status === 'PENDING';
                            const createdDate = ord.createdAt
                              ? new Date(ord.createdAt).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '—';
                            return (
                              <tr key={ord.orderId} className="hover:bg-slate-50/50">
                                <td className="px-3.5 py-3">
                                  <p className="font-mono font-medium text-slate-900">{ord.orderId}</p>
                                  <p className="text-[11px] text-slate-400">{createdDate}</p>
                                </td>
                                <td className="px-3.5 py-3 capitalize text-slate-700">
                                  <span className="font-medium">{ord.plan}</span> ({ord.billingCycle || 'annual'})
                                </td>
                                <td className="px-3.5 py-3 font-semibold text-slate-900">
                                  ₹{Number(ord.amount || 0).toLocaleString('en-IN')}
                                </td>
                                <td className="px-3.5 py-3">
                                  {ord.utr ? (
                                    <span className="font-mono text-xs text-slate-800">{ord.utr}</span>
                                  ) : (
                                    <span className="text-slate-400 text-[11px]">Awaiting UTR</span>
                                  )}
                                </td>
                                <td className="px-3.5 py-3">
                                  {isPaid ? (
                                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                                      PAID
                                    </span>
                                  ) : isPending ? (
                                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                                      PENDING
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                      {ord.status}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3.5 py-3 text-right">
                                  {isPaid ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      loading={loadingInvoiceId === ord.orderId}
                                      onClick={() => void handleViewInvoice(ord.orderId)}
                                      className="text-xs py-1 px-2.5 h-auto"
                                    >
                                      View Invoice
                                    </Button>
                                  ) : isPending ? (
                                    <Button
                                      type="button"
                                      variant="primary"
                                      size="sm"
                                      onClick={() => handleResumePayment(ord)}
                                      className="text-xs py-1 px-2.5 h-auto"
                                    >
                                      Complete Pay
                                    </Button>
                                  ) : (
                                    <span className="text-slate-400 text-xs">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentTab === 'audit' && (
              <div className="grid gap-6 lg:grid-cols-[1.05fr_1.65fr]">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-900">Latest workspace activity</p>
                    <div className="space-y-2 text-sm leading-6 text-slate-500">
                      <p>The latest entries load here. CSV export pulls the full available history from the same paged feed.</p>
                      <p>Use this to verify settings changes, user actions, client updates, and general firm administration events.</p>
                    </div>
                  </div>

                  {/* Weekly Practice Audit Summary Box */}
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">Weekly Audit Digest</p>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                        Active by Default
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600">
                      Every week, a complete CSV summary of all firm settings changed, clients added or disabled, and team members added or deactivated is automatically emailed to the Primary Admin.
                    </p>

                    {weeklyDigestNotice && (
                      <div className={`text-xs p-2 rounded border ${weeklyDigestNotice.type === 'error' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
                        {weeklyDigestNotice.text}
                      </div>
                    )}

                    <div className="flex flex-col gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={downloadWeeklyAuditCsv}
                        loading={downloadingWeeklyCsv}
                        className="w-full justify-center bg-white text-xs font-medium"
                      >
                        <span className="mr-2 inline-flex"><DownloadIcon /></span>
                        Download Past 7 Days CSV
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={triggerWeeklyAuditDigestNow}
                        loading={triggeringWeeklyDigest}
                        className="w-full justify-center text-xs text-indigo-700 hover:text-indigo-800 hover:bg-indigo-100/50"
                      >
                        Email Weekly Summary to Partner Now
                      </Button>
                    </div>
                  </div>
                </div>

                <Card className="border border-slate-200 bg-white p-5 shadow-none">
                  <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Administrator activity</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Page {activityPagination.page} of {activityPagination.totalPages} · {activityPagination.total} entries
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void exportAuditCsv()}
                        loading={exportingActivity}
                        disabled={loadingActivity || activity.length === 0}
                      >
                        <span className="mr-2 inline-flex"><DownloadIcon /></span>
                        Export CSV
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void loadActivity(activityPagination.page)}
                        loading={loadingActivity}
                      >
                        <span className="mr-2 inline-flex"><RefreshIcon /></span>
                        Refresh
                      </Button>
                    </div>
                  </div>

                  {loadingActivity ? (
                    <p className="text-sm text-slate-400">Loading audit history...</p>
                  ) : activityError ? (
                    <Notice tone="error" text={activityError} />
                  ) : activity.length ? (
                    <div className="space-y-3">
                      {activity.map((entry) => (
                        <div key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-slate-900">{entry.action}</span>
                                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600">{entry.actor}</span>
                                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-500">{entry.role}</span>
                              </div>
                              <p className="text-sm leading-6 text-slate-600">{entry.description || summarizeAuditChanges(entry.changes)}</p>
                            </div>
                            <div className="text-xs text-slate-500">
                              <p>{formatDateTime(entry.timestamp)}</p>
                              <p className="mt-1">{entry.category || 'Admin activity'}</p>
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                        <p className="text-sm text-slate-500">
                          Showing page {activityPagination.page} of {activityPagination.totalPages}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={loadingActivity || activityPagination.page <= 1}
                            onClick={() => void loadActivity(activityPagination.page - 1)}
                          >
                            Previous
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={loadingActivity || !activityPagination.hasNextPage}
                            onClick={() => void loadActivity(activityPagination.page + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      title="No activity recorded"
                      description="Workspace changes will appear here after settings or administration activity happens."
                    />
                  )}
                </Card>
              </div>
            )}
          </div>
        </Card>
      </div>
      <BulkUploadModal
        isOpen={showClientBulkModal}
        onClose={() => setShowClientBulkModal(false)}
        type="clients"
        title="Bulk Upload Clients"
        showToast={showToast}
      />
      <DocketBulkUploadModal
        isOpen={showDocketBulkModal}
        onClose={() => setShowDocketBulkModal(false)}
        showToast={showToast}
      />
      <UpiCheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        order={checkoutOrder}
        onSuccess={async () => {
          showToast('Plan upgraded successfully!', 'success');
          await loadPlanData();
        }}
      />
      {showInvoiceModal && selectedInvoice && (
        <SubscriptionInvoiceModal
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          invoice={selectedInvoice}
        />
      )}
    </PlatformShell>
  );
};
