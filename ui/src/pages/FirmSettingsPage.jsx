import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { StatusMessageStack } from './platform/PlatformShared';
import { ROUTES } from '../constants/routes';

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

const formatAuditValue = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.map((item) => formatAuditValue(item)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const summarizeAuditChanges = (changes = []) => {
  if (!Array.isArray(changes) || changes.length === 0) return 'No field changes';
  return changes.map((change) => {
    const field = change?.field || 'field';
    return `${field}: ${formatAuditValue(change?.from)} -> ${formatAuditValue(change?.to)}`;
  }).join('; ');
};

const normalizeAuditEntry = (entry = {}) => ({
  id: String(entry?._id || entry?.id || ''),
  timestamp: entry?.timestamp || null,
  actor: String(entry?.performedBy || 'SYSTEM'),
  role: String(entry?.performedByRole || 'ADMIN'),
  category: String(entry?.category || 'configs'),
  action: String(entry?.action || 'UPDATED'),
  settingsKey: String(entry?.settingsKey || entry?.category || ''),
  entityType: String(entry?.entityType || ''),
  entityId: String(entry?.entityId || ''),
  changes: Array.isArray(entry?.changes) ? entry.changes : [],
  metadata: entry?.metadata ?? null,
});

const buildAuditCsv = (entries = []) => buildCsv([
  ['Timestamp', 'Actor', 'Role', 'Category', 'Action', 'Settings Key', 'Entity Type', 'Entity ID', 'Changes', 'Metadata'],
  ...entries.map((entry) => ([
    formatDateTime(entry.timestamp),
    entry.actor || 'SYSTEM',
    entry.role || 'ADMIN',
    entry.category || 'configs',
    entry.action || 'UPDATED',
    entry.settingsKey || '—',
    entry.entityType || '—',
    entry.entityId || '—',
    summarizeAuditChanges(entry.changes),
    formatAuditValue(entry.metadata),
  ])),
]);

const getRuleScopeLabel = (rule) => {
  const scopes = [];
  if (rule.category) scopes.push(rule.category);
  if (rule.subcategory) scopes.push(rule.subcategory);
  if (rule.workbasketName || rule.workbasketId) scopes.push(rule.workbasketName || rule.workbasketId);
  if (scopes.length === 0) return 'Default';
  return scopes.join(' • ');
};

const getScopeBadge = (rule) => {
  if (rule.category && rule.subcategory) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10">
          {rule.category}
        </span>
        <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700 ring-1 ring-inset ring-sky-700/10">
          {rule.subcategory}
        </span>
      </div>
    );
  }
  if (rule.category) {
    return (
      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10">
        {rule.category}
      </span>
    );
  }
  if (rule.workbasketName || rule.workbasketId) {
    return (
      <span className="inline-flex items-center rounded-md bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700 ring-1 ring-inset ring-violet-700/10">
        {rule.workbasketName || rule.workbasketId}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-700/10">
      Default
    </span>
  );
};

const isForbidden = (error) => Number(error?.response?.status) === 403;

// Premium custom Toggle Switch component
const ToggleSwitch = ({ label, name, checked, onChange, helpText }) => {
  return (
    <div className="flex items-start justify-between py-4 border-b border-slate-100 last:border-0">
      <div className="flex flex-col mr-4">
        <span className="text-sm font-semibold text-slate-800">{label}</span>
        {helpText && <span className="text-xs text-slate-500 mt-0.5">{helpText}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange({ target: { name, value: checked ? 'false' : 'true' } })}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
          checked ? 'bg-indigo-600' : 'bg-slate-200'
        }`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};

// Premium calendar exception date chip badge
const CalendarChip = ({ date, onRemove, variant }) => {
  const isHoliday = variant === 'holiday';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold shadow-sm transition-all hover:shadow-md ${
      isHoliday 
        ? 'bg-rose-50 border border-rose-200 text-rose-700' 
        : 'bg-indigo-50 border border-indigo-200 text-indigo-700'
    }`}>
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span>{date}</span>
      <button
        type="button"
        onClick={() => onRemove(date)}
        className={`ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-xs transition-colors font-bold ${
          isHoliday ? 'text-rose-400 hover:bg-rose-100 hover:text-rose-700' : 'text-indigo-400 hover:bg-indigo-100 hover:text-indigo-700'
        }`}
      >
        ×
      </button>
    </span>
  );
};

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
  const [categories, setCategories] = useState([]);
  const [workbaskets, setWorkbaskets] = useState([]);
  const [slaRules, setSlaRules] = useState([]);
  const [loadingSlaData, setLoadingSlaData] = useState(true);
  const [savingSlaRule, setSavingSlaRule] = useState(false);
  const [deletingRuleId, setDeletingRuleId] = useState('');
  const [slaMessage, setSlaMessage] = useState({ type: '', text: '' });
  const [slaForm, setSlaForm] = useState(defaultSlaForm);
  const [holidayDateDraft, setHolidayDateDraft] = useState('');
  const [workingDateDraft, setWorkingDateDraft] = useState('');
  
  // Tab states: general, calendar, sla, features, changelog
  const [currentTab, setCurrentTab] = useState('general');

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
      const response = await adminApi.getSettingsAudit({ page: nextPage, limit: AUDIT_PAGE_SIZE });
      const records = Array.isArray(response?.data) ? response.data : [];
      const pagination = response?.pagination || {};
      const normalizedActivity = records
        .map(normalizeAuditEntry)
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
          ? 'You do not have permission to view settings audit history. Ask a workspace admin to update your access.'
          : 'Could not load settings audit history. You can retry without losing settings changes.',
      );
    } finally {
      setLoadingActivity(false);
    }
  }, []);

  const exportAuditCsv = useCallback(async () => {
    setExportingActivity(true);
    try {
      const collected = [];
      const firstResponse = await adminApi.getSettingsAudit({ page: 1, limit: AUDIT_EXPORT_PAGE_SIZE });
      const firstRows = Array.isArray(firstResponse?.data) ? firstResponse.data : [];
      const firstPagination = firstResponse?.pagination || {};
      const total = Number(firstPagination.total) || firstRows.length;
      const pageSize = Number(firstPagination.limit) || AUDIT_EXPORT_PAGE_SIZE;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      collected.push(...firstRows.map(normalizeAuditEntry));

      for (let page = 2; page <= totalPages; page += 1) {
        const response = await adminApi.getSettingsAudit({ page, limit: AUDIT_EXPORT_PAGE_SIZE });
        const rows = Array.isArray(response?.data) ? response.data : [];
        collected.push(...rows.map(normalizeAuditEntry));
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

  const loadSlaData = async () => {
    setLoadingSlaData(true);
    setSlaMessage({ type: '', text: '' });
    try {
      const [categoryResult, workbasketResult, slaResult] = await Promise.allSettled([
        categoryService.getAdminCategories(false),
        adminApi.listWorkbaskets({ includeInactive: true }),
        slaApi.getRules({ includeInactive: true }),
      ]);

      const categoriesData = categoryResult.status === 'fulfilled' && Array.isArray(categoryResult.value?.data)
        ? categoryResult.value.data
        : [];
      const workbasketsData = workbasketResult.status === 'fulfilled' && Array.isArray(workbasketResult.value?.data)
        ? workbasketResult.value.data
        : [];

      setCategories(categoriesData);
      setWorkbaskets(workbasketsData);

      if (slaResult.status === 'fulfilled') {
        setSlaRules(Array.isArray(slaResult.value?.data) ? slaResult.value.data : []);
      } else {
        setSlaRules([]);
        const slaError = slaResult.reason;
        setSlaMessage({
          type: 'error',
          text: isForbidden(slaError)
            ? 'You do not have permission to view SLA settings. Ask a workspace admin to update your access.'
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
          ? 'You do not have permission to view SLA settings. Ask a workspace admin to update your access.'
          : 'Could not load SLA configuration.',
      });
    } finally {
      setLoadingSlaData(false);
    }
  };

  useEffect(() => {
    void loadActivity(1);
    loadFirmSettings();
    loadSlaData();
  }, [loadActivity]);

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
  };

  const removeCalendarDate = (fieldName, value) => {
    setConfig((prev) => ({
      ...prev,
      [fieldName]: (Array.isArray(prev[fieldName]) ? prev[fieldName] : []).filter((entry) => entry !== value),
    }));
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    const firmPayload = {
      slaDefaultDays: Number(config.slaDefaultDays) || 0,
      slaWorkingDays: Array.isArray(config.slaWorkingDays) && config.slaWorkingDays.length ? config.slaWorkingDays : [1, 2, 3, 4, 5],
      slaHolidayDates: Array.isArray(config.slaHolidayDates) ? config.slaHolidayDates : [],
      slaWorkingDateOverrides: Array.isArray(config.slaWorkingDateOverrides) ? config.slaWorkingDateOverrides : [],
      calendarReminderLeadDays: Number(config.calendarReminderLeadDays) || 0,
      escalationInactivityThresholdHours: Number(config.escalationInactivityThresholdHours) || 0,
      workloadThreshold: Number(config.workloadThreshold) || 15,
      enablePerformanceView: Boolean(config.enablePerformanceView),
      enableEscalationView: Boolean(config.enableEscalationView),
      enableBulkActions: Boolean(config.enableBulkActions),
      brandLogoUrl: typeof config.brandLogoUrl === 'string' ? config.brandLogoUrl.trim() : '',
    };
    try {
      const response = await adminApi.updateFirmSettings({ firm: firmPayload });
      const saved = setFirmConfig(response?.data?.firm || firmPayload);
      setConfig(saved);
      setHasUnsavedChanges(false);
      setSaveMessage({ type: 'success', text: 'Firm settings saved successfully.' });
      void loadActivity(1);
    } catch {
      setSaveMessage({ type: 'error', text: 'Could not save settings. Please retry.' });
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
    } catch {
      setSlaMessage({ type: 'error', text: 'Could not save the SLA rule.' });
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
    } catch {
      setSlaMessage({ type: 'error', text: 'Could not delete the SLA rule.' });
    } finally {
      setDeletingRuleId('');
    }
  };

  const primaryStatusMessages = [
    saveMessage.text
      ? { tone: saveMessage.type === 'success' ? 'success' : 'error', message: saveMessage.text }
      : null,
  ].filter(Boolean);

  const slaStatusMessages = [
    slaMessage.text
      ? { tone: slaMessage.type === 'success' ? 'success' : 'error', message: slaMessage.text }
      : null,
  ].filter(Boolean);

  // Tab configurations
  const tabs = [
    {
      id: 'general',
      label: 'General Defaults',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <circle cx={12} cy={12} r={3} />
        </svg>
      ),
    },
    {
      id: 'calendar',
      label: 'Work Calendar',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'sla',
      label: 'SLA Rules',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      id: 'features',
      label: 'Feature Controls',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      ),
    },
    {
      id: 'changelog',
      label: 'Audit History',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <PlatformShell 
      moduleLabel="Settings" 
      title="Firm Settings" 
      subtitle="Configure operational defaults, SLA policy, and feature visibility for this workspace."
    >
      <div className="min-h-screen w-full flex-1 bg-slate-50/50 pb-24">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
          
          {/* Go Back Link */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => navigate(ROUTES.SETTINGS(firmSlug))}
              className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-indigo-600 transition"
            >
              ← Go back to settings
            </button>
          </div>

          {/* Premium Tabbed Navigation Header */}
          <div className="mb-8 border-b border-slate-200 bg-white rounded-xl p-1.5 shadow-sm flex flex-wrap gap-1">
            {tabs.map((tab) => {
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setCurrentTab(tab.id);
                    setSaveMessage({ type: '', text: '' });
                  }}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Primary Status Notifications */}
          {primaryStatusMessages.length > 0 && (
            <div className="mb-6">
              <StatusMessageStack messages={primaryStatusMessages} />
            </div>
          )}

          {/* Viewport for active tab */}
          <div className="transition-all duration-300">
            
            {/* Tab: General Defaults */}
            {currentTab === 'general' && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-1 space-y-2">
                  <h3 className="text-base font-bold text-slate-800">Operational Slates</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Set core default parameters that govern auto-assignment, queue thresholds, and background reminders.
                  </p>
                </div>
                <div className="lg:col-span-2">
                  <Card className="p-6 bg-white shadow-sm border border-slate-200/60 rounded-xl space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Default SLA Deadline (Days)"
                        name="slaDefaultDays"
                        type="number"
                        min="1"
                        value={config.slaDefaultDays}
                        onChange={handleNumberChange}
                        helpText="Deadline offset used if no category-level SLA is set."
                      />
                      <Input
                        label="Reminder Notification Lead Time (Days)"
                        name="calendarReminderLeadDays"
                        type="number"
                        min="0"
                        max="30"
                        value={config.calendarReminderLeadDays}
                        onChange={handleNumberChange}
                        helpText="Schedules automated dashboard warnings ahead of critical dates."
                      />
                      <Input
                        label="Escalation Inactivity Limit (Hours)"
                        name="escalationInactivityThresholdHours"
                        type="number"
                        min="1"
                        value={config.escalationInactivityThresholdHours}
                        onChange={handleNumberChange}
                        helpText="Hours before unassigned items flag as escalated."
                      />
                      <Input
                        label="Maximum Workload Cap"
                        name="workloadThreshold"
                        type="number"
                        min="1"
                        value={config.workloadThreshold}
                        onChange={handleNumberChange}
                        helpText="Target capacity load suggestion per user."
                      />
                    </div>
                    <div className="pt-4 border-t border-slate-100">
                      <Input
                        label="Workspace Brand Logo URL"
                        name="brandLogoUrl"
                        type="url"
                        placeholder="https://example.com/logo.png"
                        value={config.brandLogoUrl || ''}
                        onChange={handleTextChange}
                        helpText="Optional logo to replace default initials in navigation."
                      />
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* Tab: Work Calendar */}
            {currentTab === 'calendar' && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-1 space-y-2">
                  <h3 className="text-base font-bold text-slate-800">Operational Schedules</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Define active business days and add custom vacation lists. Deadlines skip weekends and holidays automatically.
                  </p>
                </div>
                <div className="lg:col-span-2 space-y-6">
                  <Card className="p-6 bg-white shadow-sm border border-slate-200/60 rounded-xl">
                    <span className="text-sm font-bold text-slate-800 block mb-3">Weekly Schedule</span>
                    <div className="flex flex-wrap gap-2">
                      {weekdayOptions.map((day) => {
                        const isWorking = (config.slaWorkingDays || []).includes(day.value);
                        return (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => toggleWorkingDay(day.value)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${
                              isWorking
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm'
                                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </Card>

                  <Card className="p-6 bg-white shadow-sm border border-slate-200/60 rounded-xl space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Holidays Section */}
                      <div className="space-y-4">
                        <span className="text-sm font-bold text-slate-800 block">Holidays & Off Days</span>
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={holidayDateDraft}
                            onChange={(e) => setHolidayDateDraft(e.target.value)}
                            className="block w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => addCalendarDate('slaHolidayDates', holidayDateDraft, setHolidayDateDraft)}
                            className="bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold px-3.5 py-1.5 rounded-lg whitespace-nowrap"
                          >
                            Add Off
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2">
                          {(config.slaHolidayDates || []).length > 0 ? (
                            (config.slaHolidayDates || []).map((date) => (
                              <CalendarChip
                                key={date}
                                date={date}
                                variant="holiday"
                                onRemove={(d) => removeCalendarDate('slaHolidayDates', d)}
                              />
                            ))
                          ) : (
                            <span className="text-xs text-slate-400 italic">No specific holidays configured.</span>
                          )}
                        </div>
                      </div>

                      {/* Working Exceptions Section */}
                      <div className="space-y-4">
                        <span className="text-sm font-bold text-slate-800 block">Working Day Overrides</span>
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={workingDateDraft}
                            onChange={(e) => setWorkingDateDraft(e.target.value)}
                            className="block w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => addCalendarDate('slaWorkingDateOverrides', workingDateDraft, setWorkingDateDraft)}
                            className="bg-indigo-600 text-white hover:bg-indigo-500 text-xs font-bold px-3.5 py-1.5 rounded-lg whitespace-nowrap"
                          >
                            Add Work
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2">
                          {(config.slaWorkingDateOverrides || []).length > 0 ? (
                            (config.slaWorkingDateOverrides || []).map((date) => (
                              <CalendarChip
                                key={date}
                                date={date}
                                variant="working"
                                onRemove={(d) => removeCalendarDate('slaWorkingDateOverrides', d)}
                              />
                            ))
                          ) : (
                            <span className="text-xs text-slate-400 italic">No working-day overrides.</span>
                          )}
                        </div>
                      </div>

                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* Tab: SLA Rules */}
            {currentTab === 'sla' && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-1 space-y-2">
                  <h3 className="text-base font-bold text-slate-800">SLA Priority Engine</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Set targeted SLA overrides based on categories, subcategories, or team workbaskets. Granular targets override global defaults automatically.
                  </p>
                </div>
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* SLA Rule Form Card */}
                  <Card className="p-6 bg-white shadow-sm border border-slate-200/60 rounded-xl space-y-6">
                    <span className="text-sm font-bold text-slate-800 block border-b border-slate-100 pb-2">
                      {slaForm.id ? 'Modify SLA Override' : 'Create SLA Rule Override'}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Select
                        label="Target Category"
                        name="category"
                        value={slaForm.category}
                        onChange={handleSlaFormChange}
                        options={categoryOptions}
                      />
                      <Select
                        label="Target Subcategory"
                        name="subcategory"
                        value={slaForm.subcategory}
                        onChange={handleSlaFormChange}
                        options={subcategoryOptions}
                      />
                      <Select
                        label="Target Workbasket"
                        name="workbasketId"
                        value={slaForm.workbasketId}
                        onChange={handleSlaFormChange}
                        options={workbasketOptions}
                      />
                      <Input
                        label="SLA Target Duration (Working Days)"
                        name="slaHours"
                        type="number"
                        min="1"
                        value={slaForm.slaHours}
                        onChange={handleSlaFormChange}
                      />
                      <Select
                        label="Status State"
                        name="isActive"
                        value={String(Boolean(slaForm.isActive))}
                        onChange={handleSlaFormChange}
                        options={enabledDisabledOptions}
                      />
                    </div>

                    {slaStatusMessages.length > 0 && (
                      <StatusMessageStack messages={slaStatusMessages} />
                    )}

                    <div className="flex gap-2.5 justify-end">
                      {slaForm.id && (
                        <button
                          type="button"
                          onClick={resetSlaForm}
                          className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-600 transition"
                        >
                          Cancel Edit
                        </button>
                      )}
                      <Button 
                        type="button" 
                        variant="primary" 
                        onClick={handleSaveRule} 
                        disabled={savingSlaRule || loadingSlaData}
                      >
                        {savingSlaRule ? 'Saving…' : (slaForm.id ? 'Update Rule' : 'Save Rule')}
                      </Button>
                    </div>
                  </Card>

                  {/* Existing Rules Table */}
                  <Card className="p-6 bg-white shadow-sm border border-slate-200/60 rounded-xl space-y-4">
                    <span className="text-sm font-bold text-slate-800 block">Configured Priority Overrides</span>
                    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
                      {loadingSlaData ? (
                        <div className="px-4 py-8 text-center text-xs text-slate-400">Loading SLA configurations…</div>
                      ) : slaRules.length ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-slate-100 text-xs">
                            <thead className="bg-slate-50 text-left font-bold text-slate-600">
                              <tr>
                                <th className="px-4 py-3">Scoped Target</th>
                                <th className="px-4 py-3">Days Allowed</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-600 bg-white">
                              {slaRules.map((rule) => (
                                <tr key={rule._id || rule.id} className="hover:bg-slate-50/50">
                                  <td className="px-4 py-3 font-semibold text-slate-800">
                                    {getScopeBadge(rule)}
                                  </td>
                                  <td className="px-4 py-3 font-medium">
                                    {rule.slaWorkingDays || (rule.slaHours ? Number(rule.slaHours) / 8 : '—')} days
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                      rule.isActive === false
                                        ? 'bg-slate-100 text-slate-600'
                                        : 'bg-emerald-50 text-emerald-700'
                                    }`}>
                                      {rule.isActive === false ? 'Inactive' : 'Active'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleEditRule(rule)}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 text-slate-500 bg-white hover:bg-indigo-50/20 transition-all"
                                        title="Edit override"
                                      >
                                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteRule(rule._id || rule.id)}
                                        disabled={deletingRuleId === (rule._id || rule.id)}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:border-rose-300 hover:text-rose-600 text-slate-500 bg-white hover:bg-rose-50/20 transition-all"
                                        title="Delete override"
                                      >
                                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="px-4 py-8">
                          <EmptyState
                            title="No SLA rules configured"
                            description="Add custom priority rules above to override default SLA calculations for selected categories."
                          />
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* Tab: Feature Controls */}
            {currentTab === 'features' && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-1 space-y-2">
                  <h3 className="text-base font-bold text-slate-800">Operational Views</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Toggle advanced dashboards and management views. Turning off hidden options simplifies workspace complexity for standard staff.
                  </p>
                </div>
                <div className="lg:col-span-2">
                  <Card className="p-6 bg-white shadow-sm border border-slate-200/60 rounded-xl">
                    <ToggleSwitch
                      label="Operational Performance Analytics"
                      name="enablePerformanceView"
                      checked={Boolean(config.enablePerformanceView)}
                      onChange={handleToggleChange}
                      helpText="Provides users with throughput stats, team speed metrics, and volume counts."
                    />
                    <ToggleSwitch
                      label="SLA Escalation Monitoring"
                      name="enableEscalationView"
                      checked={Boolean(config.enableEscalationView)}
                      onChange={handleToggleChange}
                      helpText="Displays critical escalation flags, breaching alerts, and priority actions."
                    />
                    <ToggleSwitch
                      label="Bulk Assignment & Worklist Actions"
                      name="enableBulkActions"
                      checked={Boolean(config.enableBulkActions)}
                      onChange={handleToggleChange}
                      helpText="Allows managers to reassign, clear, and modify multiple active items simultaneously."
                    />
                  </Card>
                </div>
              </div>
            )}

            {/* Tab: Audit History */}
            {currentTab === 'changelog' && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-1 space-y-2">
                  <h3 className="text-base font-bold text-slate-800">Audit & Change Trace</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    View recent workspace settings changes. The latest 25 entries load per page, with CSV export for the full audit trail.
                  </p>
                </div>
                <div className="lg:col-span-2">
                  <Card className="p-6 bg-white shadow-sm border border-slate-200/60 rounded-xl">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-6">
                      <span className="text-sm font-bold text-slate-800">Administrator Activity Log</span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void exportAuditCsv()}
                          loading={exportingActivity}
                          disabled={loadingActivity || activity.length === 0}
                        >
                          Export CSV
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void loadActivity(activityPagination.page)}
                          loading={loadingActivity}
                        >
                          Refresh Log
                        </Button>
                      </div>
                    </div>

                    {loadingActivity ? (
                      <div className="px-4 py-8 text-center text-xs text-slate-400">Loading activity history…</div>
                    ) : activityError ? (
                      <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4 text-xs text-rose-700">
                        <p className="font-semibold">{activityError}</p>
                      </div>
                    ) : activity.length ? (
                      <>
                        <div className="overflow-x-auto rounded-xl border border-slate-100">
                          <table className="min-w-full divide-y divide-slate-100 text-xs">
                            <thead className="bg-slate-50 text-left font-bold text-slate-600">
                              <tr>
                                <th className="px-4 py-3">Timestamp</th>
                                <th className="px-4 py-3">Actor</th>
                                <th className="px-4 py-3">Role</th>
                                <th className="px-4 py-3">Category</th>
                                <th className="px-4 py-3">Action</th>
                                <th className="px-4 py-3">Changes</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white text-slate-600">
                              {activity.map((entry) => (
                                <tr key={entry.id} className="hover:bg-slate-50/60">
                                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatDateTime(entry.timestamp)}</td>
                                  <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{entry.actor}</td>
                                  <td className="px-4 py-3 whitespace-nowrap">{entry.role || 'ADMIN'}</td>
                                  <td className="px-4 py-3 whitespace-nowrap">{entry.category || 'configs'}</td>
                                  <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-800">{entry.action}</td>
                                  <td className="px-4 py-3 text-slate-500">{summarizeAuditChanges(entry.changes)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500">
                          <span>
                            Page {activityPagination.page} of {activityPagination.totalPages} · {activityPagination.total} total entries
                          </span>
                          <div className="flex items-center gap-2">
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
                      </>
                    ) : (
                      <div className="px-4 py-8">
                        <EmptyState
                          title="No activity recorded"
                          description="Workspace changes will log here once configuration updates are made."
                        />
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            )}

          </div>

          {/* Sticky Unsaved Changes Floating Banner */}
          {hasUnsavedChanges && (
            <div className="fixed bottom-6 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-4">
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800/80 bg-slate-950/95 backdrop-blur-md px-5 py-3.5 shadow-2xl shadow-slate-950/50 transition-all duration-300">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-100">Unsaved configuration changes</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Please save or discard updates</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadFirmSettings}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-200"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={loadingConfig}
                    className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {loadingConfig ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </PlatformShell>
  );
};
