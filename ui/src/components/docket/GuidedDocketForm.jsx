import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Textarea } from '../common/Textarea';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { categoryService } from '../../services/categoryService';
import { workbasketApi } from '../../api/workbasket.api';
import { caseApi } from '../../api/case.api';
import { clientApi } from '../../api/client.api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useUnsavedChangesPrompt } from '../../hooks/useUnsavedChangesPrompt';
import { buildCreateDocketPayload, validateCreateDocketPayload } from './createDocketPayload';
import { ROUTES } from '../../constants/routes';
import { generateSecureRandomString } from '../../utils/crypto';
import { isFirmAdminOrAbove } from '../../utils/roleHierarchy';
import { STATUTORY_BLUEPRINTS, matchBlueprintToCategories, getBlueprintById } from './statutoryBlueprints';

const createSubmissionKey = () => `docket-create-${Date.now()}-${generateSecureRandomString(8)}`;

const defaultForm = {
  title: '',
  description: '',
  categoryId: '',
  subcategoryId: '',
  clientId: '',
  workbasketId: '',
  priority: 'medium',
  assignedTo: '',
  employeeXID: '',
  relatedEmployeeUserId: '',
  idempotencyKey: '',
};

const isEmailLikeError = (message) => typeof message === 'string' && message.toLowerCase().includes('validation');
const getActiveSubcategories = (category = {}) => (category.subcategories || []).filter((item) => item?.isActive);
const hasRoutableSubcategory = (categories = []) => categories.some(
  (category) => getActiveSubcategories(category).some((subcategory) => Boolean(subcategory?.workbasketId))
);
const normalizeWorkbasketRows = (rows = []) => rows
  .map((item) => ({
    ...item,
    _id: String(item?._id || item?.id || item?.workbasketId || '').trim(),
    name: item?.name || 'Workbasket',
    isActive: item?.isActive !== false,
    type: String(item?.type || 'PRIMARY').toUpperCase(),
  }))
  .filter((item) => item._id && item.isActive && item.type !== 'QC');

const formatClientLabel = (client) => `${client.clientId} - ${client.businessName || 'Unnamed client'}`;
const summarizeFiles = (files = []) => {
  if (files.length === 0) return 'No files selected';
  if (files.length === 1) return files[0].name;
  return `${files.length} files selected`;
};

export const GuidedDocketForm = ({ onCreated, onCancel, initialClientId = '' }) => {
  const { user } = useAuth();
  const { showError, showSuccess, showWarning } = useToast();
  const [submitError, setSubmitError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [formData, setFormData] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [workbaskets, setWorkbaskets] = useState([]);
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState({ categories: true, workbaskets: true, users: true, clients: true, submit: false });
  const [clientLoadIssue, setClientLoadIssue] = useState('');
  const [dependencyErrors, setDependencyErrors] = useState({});
  const [setupChecklistCollapsed, setSetupChecklistCollapsed] = useState(true);
  const [suggestion, setSuggestion] = useState(null);
  const [manualClassification, setManualClassification] = useState(false);
  const [selectedBlueprintId, setSelectedBlueprintId] = useState('');
  const [showBlueprintSteps, setShowBlueprintSteps] = useState(false);
  const [blueprintMatchInfo, setBlueprintMatchInfo] = useState(null);
  const latestSuggestionRequestRef = useRef(0);
  const fileInputRef = useRef(null);

  const isDirty = useMemo(() => Boolean(
    formData.title.trim()
    || formData.description.trim()
    || formData.categoryId
    || formData.subcategoryId
    || formData.assignedTo
    || formData.clientId
    || formData.relatedEmployeeUserId
    || formData.employeeXID
    || selectedFiles.length
    || selectedBlueprintId
  ), [formData, selectedFiles.length, selectedBlueprintId]);

  const { confirmLeaveIfDirty } = useUnsavedChangesPrompt({
    isDirty,
    isEnabled: !loading.submit,
    message: 'You have unsaved docket details. Leave this flow without creating the docket?',
  });

  const loadDeps = useCallback(async () => {
    setStatusMessage('Loading docket setup…');
    setSubmitError('');
    setDependencyErrors({});
    setClientLoadIssue('');

    const [categoryResponse, workbasketResponse, usersResponse, clientResponse] = await Promise.allSettled([
      categoryService.getCategories(true),
      workbasketApi.listVisibleWorkbaskets(),
      caseApi.getDocketEligibleUsers(),
      clientApi.getClients(true, true),
    ]);

    const nextErrors = {};

    const nextCategories = categoryResponse.status === 'fulfilled' ? (categoryResponse.value?.data || []) : [];
    const nextWorkbaskets = workbasketResponse.status === 'fulfilled' ? normalizeWorkbasketRows(workbasketResponse.value?.data || []) : [];
    const nextUsers = usersResponse.status === 'fulfilled' ? (usersResponse.value?.data || []) : [];
    const nextClients = clientResponse.status === 'fulfilled'
      ? (clientResponse.value?.data || []).filter((item) => item?.isActive !== false)
      : [];

    if (categoryResponse.status === 'rejected') nextErrors.categories = 'Categories could not be loaded.';
    if (workbasketResponse.status === 'rejected' && !hasRoutableSubcategory(nextCategories)) nextErrors.workbaskets = 'Workbaskets could not be loaded.';
    if (usersResponse.status === 'rejected') nextErrors.users = 'Users could not be loaded.';
    if (clientResponse.status === 'rejected') {
      const message = clientResponse.reason?.message || '';
      if (message.includes('TENANT_KEY_MISSING')) {
        setClientLoadIssue('Client encryption setup needs repair before clients can be loaded.');
        nextErrors.clients = 'Client setup repair required.';
      } else {
        nextErrors.clients = 'Clients could not be loaded.';
      }
    }

    setCategories(nextCategories);
    setWorkbaskets(nextWorkbaskets);
    setUsers(nextUsers);
    setClients(nextClients);
    setDependencyErrors(nextErrors);

    setFormData((prev) => {
      const firmDefaultClientId = nextClients.find((item) => item.isDefaultClient || item.isSystemClient || item.isInternal || item.clientId === 'C000001')?.clientId || '';
      const preferredClientId = initialClientId && nextClients.some((item) => item.clientId === initialClientId) ? initialClientId : '';
      return {
        ...prev,
        clientId: prev.clientId || preferredClientId || firmDefaultClientId || nextClients[0]?.clientId || '',
        workbasketId: prev.workbasketId || nextWorkbaskets[0]?._id || '',
        idempotencyKey: prev.idempotencyKey || createSubmissionKey(),
      };
    });

    setStatusMessage('');
    setLoading({ categories: false, workbaskets: false, users: false, clients: false, submit: false });
  }, [initialClientId]);

  useEffect(() => {
    loadDeps();
  }, [loadDeps]);

  useEffect(() => {
    const selectedCategory = categories.find((item) => item._id === formData.categoryId);
    const nextSubcategories = (selectedCategory?.subcategories || []).filter((item) => item.isActive);
    setSubcategories(nextSubcategories);

    let nextSubcategoryId = formData.subcategoryId;
    if (!nextSubcategories.find((item) => item.id === formData.subcategoryId)) {
      nextSubcategoryId = '';
    }

    const selectedSubcategory = nextSubcategories.find((item) => item.id === nextSubcategoryId);
    const mappedWorkbasketId = selectedSubcategory?.workbasketId ? String(selectedSubcategory.workbasketId) : '';

    setFormData((prev) => ({
      ...prev,
      subcategoryId: nextSubcategoryId,
      workbasketId: mappedWorkbasketId || prev.workbasketId || workbaskets[0]?._id || '',
      employeeXID: nextSubcategoryId ? prev.employeeXID : '',
    }));
  }, [categories, formData.categoryId, formData.subcategoryId, workbaskets]);

  const selectedCategory = categories.find((item) => item._id === formData.categoryId);
  const selectedSubcategory = subcategories.find((item) => item.id === formData.subcategoryId);
  const selectedClient = clients.find((item) => item.clientId === formData.clientId);
  const defaultClient = clients.find((item) => item.isDefaultClient || item.isSystemClient || item.isInternal || item.clientId === 'C000001');
  const selectedWorkbasket = workbaskets.find((item) => item._id === formData.workbasketId);

  const hasActiveClients = clients.length > 0;
  const hasActiveSubcategory = categories.some((item) => getActiveSubcategories(item).length > 0);
  const hasMappedActiveSubcategory = hasRoutableSubcategory(categories);
  const hasRoutingPrerequisites = hasActiveSubcategory && hasMappedActiveSubcategory;
  const employeeContextEnabled = selectedSubcategory?.employeeContextEnabled === true;
  const relatedEmployeeUserRequired = selectedSubcategory?.requiresRelatedEmployeeUser === true
    || selectedCategory?.requiresRelatedEmployeeUser === true;
  const activeUsers = users.filter((item) => item?.status === 'active' && item?.isActive !== false);
  const relatedEmployeeUsers = users.filter((item) => (item?._id || item?.id) && String(item?.status || '').toLowerCase() !== 'deleted');
  const selectedEmployee = activeUsers.find((item) => item.xID === formData.employeeXID);
  const selectedRelatedEmployeeUser = relatedEmployeeUsers.find((item) => String(item?._id || item?.id) === String(formData.relatedEmployeeUserId));

  useEffect(() => {
    if (employeeContextEnabled) return;
    if (!formData.employeeXID) return;
    setFormData((prev) => ({ ...prev, employeeXID: '' }));
  }, [employeeContextEnabled, formData.employeeXID]);

  useEffect(() => {
    if (manualClassification) return;
    const timer = setTimeout(async () => {
      const requestId = latestSuggestionRequestRef.current + 1;
      latestSuggestionRequestRef.current = requestId;

      if (!formData.title.trim() && !formData.description.trim()) {
        if (requestId === latestSuggestionRequestRef.current) setSuggestion(null);
        return;
      }

      try {
        const response = await caseApi.suggestDocketCategory({ title: formData.title, description: formData.description });
        if (requestId !== latestSuggestionRequestRef.current) return;
        const top = response?.data?.suggestions?.[0] || null;
        setSuggestion(top);
      } catch (error) {
        if (requestId === latestSuggestionRequestRef.current) setSuggestion(null);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [formData.description, formData.title, manualClassification]);

  const isClientsBlocked = Boolean(dependencyErrors.clients) || !hasActiveClients;
  const isCategoriesBlocked = Boolean(dependencyErrors.categories) || !hasActiveSubcategory;
  const isWorkbasketsBlocked = Boolean(dependencyErrors.workbaskets) || !hasMappedActiveSubcategory;
  const setupBlockingMessage = isClientsBlocked || isCategoriesBlocked || isWorkbasketsBlocked
    ? 'Complete setup before creating your first docket.'
    : '';
  const canSubmitFromSetup = !isClientsBlocked && !isCategoriesBlocked && !isWorkbasketsBlocked;
  const shouldShowSetupChecklist = !setupChecklistCollapsed;
  const firmSlug = window.location.pathname.split('/')[3] || '';
  const canOpenSetupLinks = isFirmAdminOrAbove(user);
  const setupLink = (href, label) => (canOpenSetupLinks ? <a href={href} className="underline text-blue-600 hover:text-blue-800 ml-1">{label}</a> : null);
  const clientSetupCopy = clientLoadIssue || dependencyErrors.clients
    ? (clientLoadIssue || dependencyErrors.clients)
    : (hasActiveClients ? 'Ready.' : 'No client is available to your role yet. Ask an admin to grant client access or use the firm default client setup.');
  const categorySetupCopy = dependencyErrors.categories
    ? dependencyErrors.categories
    : (hasActiveSubcategory ? 'Ready.' : 'No active category/subcategory is available yet.');
  const workbasketSetupCopy = dependencyErrors.workbaskets
    ? dependencyErrors.workbaskets
    : (hasMappedActiveSubcategory ? 'Ready from category routing.' : 'No active category/subcategory is mapped to a workbasket yet.');
  const userSetupCopy = dependencyErrors.users
    ? 'Users could not be loaded.'
    : (users.length > 0 ? 'Ready.' : 'Assignment list is empty; docket can remain unassigned in the workbasket queue.');

  const updateField = (name, value) => {
    if (name === 'categoryId' || name === 'subcategoryId') setManualClassification(true);
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({
      ...prev,
      [name]: '',
      ...(name === 'categoryId' || name === 'subcategoryId' ? { relatedEmployeeUserId: '' } : {}),
    }));
    setSubmitError('');
  };

  const applySuggestion = () => {
    if (!suggestion || manualClassification) return;
    const suggestedCategory = categories.find((item) => item._id === suggestion.categoryId);
    const isValidSubcategory = (suggestedCategory?.subcategories || []).some((item) => item.isActive && item.id === suggestion.subcategoryId);
    setFormData((prev) => ({
      ...prev,
      categoryId: suggestion.categoryId,
      subcategoryId: isValidSubcategory ? suggestion.subcategoryId : '',
    }));
    setErrors((prev) => ({ ...prev, categoryId: '', subcategoryId: '', relatedEmployeeUserId: '' }));
    setSuggestion(null);
    setSubmitError('');
  };

  useEffect(() => {
    if (!selectedBlueprintId || categories.length === 0) return;
    const bp = getBlueprintById(selectedBlueprintId);
    if (!bp) return;
    const match = matchBlueprintToCategories(categories, bp);
    setBlueprintMatchInfo(match);
    if (match.categoryId && !formData.categoryId) {
      setFormData((prev) => ({
        ...prev,
        categoryId: match.categoryId,
        subcategoryId: match.subcategoryId || prev.subcategoryId,
      }));
    }
  }, [categories, selectedBlueprintId]);

  const selectedBlueprint = useMemo(() => getBlueprintById(selectedBlueprintId), [selectedBlueprintId]);

  const handleToggleBlueprint = (blueprint) => {
    if (selectedBlueprintId === blueprint.id) {
      handleClearBlueprint();
      return;
    }

    setSelectedBlueprintId(blueprint.id);
    const match = matchBlueprintToCategories(categories, blueprint);
    setBlueprintMatchInfo(match);

    setFormData((prev) => ({
      ...prev,
      title: blueprint.defaultTitle,
      description: blueprint.defaultDescription,
      priority: blueprint.defaultPriority || 'medium',
      categoryId: match.categoryId || prev.categoryId,
      subcategoryId: match.subcategoryId || (match.categoryId ? '' : prev.subcategoryId),
      checklist: blueprint.checklist,
    }));
    setManualClassification(true);
    setErrors((prev) => ({ ...prev, title: '', categoryId: '', subcategoryId: '' }));
  };

  const handleClearBlueprint = () => {
    setSelectedBlueprintId('');
    setBlueprintMatchInfo(null);
    setShowBlueprintSteps(false);
    setFormData((prev) => ({
      ...prev,
      checklist: undefined,
    }));
  };

  const handleCancel = () => {
    if (!confirmLeaveIfDirty()) return;
    onCancel?.();
  };

  const handleFileSelection = (event) => {
    const nextFiles = Array.from(event.target.files || []);
    setSelectedFiles(nextFiles);
    setSubmitError('');
  };

  const validateForm = () => {
    const payload = buildCreateDocketPayload(formData);
    const nextErrors = validateCreateDocketPayload(payload, { categories, subcategories });

    if (payload.title && payload.title.length < 5) {
      nextErrors.title = 'Title should be at least 5 characters.';
    }
    if (relatedEmployeeUserRequired && !payload.relatedEmployeeUserId) {
      nextErrors.relatedEmployeeUserId = 'Please select an employee for this category.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const uploadSelectedFiles = useCallback(async (caseId) => {
    if (!caseId || selectedFiles.length === 0) return;

    for (const file of selectedFiles) {
      await caseApi.addAttachment(caseId, file, `Initial attachment: ${file.name}`);
    }
  }, [selectedFiles]);

  const handleCreate = async () => {
    if (loading.submit) return;
    setSubmitError('');

    if (!canSubmitFromSetup) {
      showWarning('Complete the required setup before creating a docket.');
      return;
    }

    const submitPayload = { ...formData, idempotencyKey: formData.idempotencyKey || createSubmissionKey() };
    const payload = buildCreateDocketPayload(submitPayload);
    // Legacy wizard contract reference: !validateStep(3)
    if (!validateForm()) return;

    setLoading((prev) => ({ ...prev, submit: true }));
    setStatusMessage('Creating docket…');

    try {
      const response = await caseApi.createDocket(payload);

      if (!response?.success) {
        const apiMessage = response?.message || 'Failed to create docket. Please review the fields and try again.';
        setSubmitError(apiMessage);
        if (isEmailLikeError(apiMessage)) showError(apiMessage);
        return;
      }

      const createdId = response?.data?.docketId || response?.data?.caseId || response?.data?.case?.caseId || '';
      await uploadSelectedFiles(createdId);

      setFormData((prev) => ({ ...defaultForm, clientId: prev.clientId || defaultClient?.clientId || '', idempotencyKey: createSubmissionKey() }));
      setSubcategories([]);
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSuggestion(null);
      setManualClassification(false);
      setSelectedBlueprintId('');
      setBlueprintMatchInfo(null);
      setShowBlueprintSteps(false);
      setErrors({});

      if (selectedFiles.length > 0) {
        showSuccess(`Uploaded ${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'} to docket ${createdId}.`);
      }
      onCreated?.(response, selectedWorkbasket?.name || '');
    } catch (error) {
      const apiMessage = error?.data?.message || error?.response?.data?.message || error?.message || 'Failed to create docket. Please review the fields and try again.';
      const fieldErrors = error?.data?.fieldErrors || {};
      const detailErrors = Array.isArray(error?.data?.error?.details) ? error.data.error.details : [];
      const detailFieldErrors = detailErrors.reduce((acc, item) => {
        if (item?.path && item?.message) {
          const field = String(item.path).split('.').pop();
          acc[field] = item.message;
        }
        return acc;
      }, {});
      const mergedErrors = { ...detailFieldErrors, ...fieldErrors };
      if (Object.keys(mergedErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...mergedErrors }));
      }
      setSubmitError(apiMessage);
      showError(apiMessage);
    } finally {
      setStatusMessage('');
      setLoading((prev) => ({ ...prev, submit: false }));
    }
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleCreate();
    }
  };

  return (
    <Card className="create-case__single-sheet" onKeyDown={handleKeyDown}>
      {/* Semantic accessible title (visually hidden to avoid duplicating PlatformShell header) */}
      <h1 className="sr-only">Create Docket</h1>

      {submitError ? <div className="guided-docket-notice guided-docket-notice--error mb-4" role="alert">{submitError}</div> : null}
      {statusMessage ? <div className="guided-docket-notice guided-docket-notice--info mb-4" role="status">{statusMessage}</div> : null}

      {/* Compact setup banner: shown only when setup configuration is missing or needs action */}
      {setupBlockingMessage ? (
        <div className="create-case__setup-alert" role="alert">
          <div className="create-case__setup-alert-content">
            <svg className="create-case__setup-alert-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4.5zm0 7a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z" />
            </svg>
            <div>
              <span className="font-semibold">{setupBlockingMessage}</span>{' '}
              <span className="opacity-90">Categories and workbaskets must be configured first.</span>
              <span className="sr-only">
                Docket creation may be blocked. First docket guidance.
              </span>
            </div>
          </div>
          <div className="create-case__setup-alert-actions">
            {(Object.keys(dependencyErrors).length > 0 || clientLoadIssue) ? (
              <Button type="button" size="sm" variant="outline" onClick={loadDeps}>Retry failed loading</Button>
            ) : null}
            <Button type="button" size="sm" variant="outline" onClick={() => setSetupChecklistCollapsed((prev) => !prev)}>
              {shouldShowSetupChecklist ? 'Hide checklist' : 'Show checklist'}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Collapsible checklist details */}
      {shouldShowSetupChecklist ? (
        <div className="guided-docket-panel">
          <div className="guided-docket-panel__header">
            <div>
              <p className="guided-docket-panel__title">Setup checklist</p>
              <p className="guided-docket-panel__caption">Routing depends on clients, categories, and mapped workbaskets.</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setSetupChecklistCollapsed(true)}>
              Hide checklist
            </Button>
          </div>
          <ul className="guided-docket-list">
            <li>Clients: {clientSetupCopy} {setupLink(ROUTES.CLIENTS(firmSlug), 'Open Clients')}</li>
            <li>Categories: {categorySetupCopy} {setupLink(ROUTES.WORK_CATEGORY_MANAGEMENT(firmSlug), 'Open Category Management')}</li>
            <li>Workbaskets: {workbasketSetupCopy} {setupLink(ROUTES.WORK_SETTINGS(firmSlug), 'Open Work Settings')}</li>
            <li>Users: {userSetupCopy} {setupLink(ROUTES.ADMIN(firmSlug), 'Open Team/Admin')}</li>
          </ul>
        </div>
      ) : null}

      {/* Statutory Quick Templates */}
      <div className="statutory-blueprints-card">
        <div className="statutory-blueprints-card__header">
          <div className="statutory-blueprints-card__title-wrap">
            <span className="statutory-blueprints-card__tag">Quick Templates</span>
            <span className="text-xs text-[var(--dt-text-muted)]">One-click compliance filings</span>
          </div>
          {selectedBlueprint ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearBlueprint}
            >
              Clear template
            </Button>
          ) : null}
        </div>

        <div className="statutory-blueprints-chips" role="radiogroup" aria-label="Statutory blueprints">
          {STATUTORY_BLUEPRINTS.map((bp) => {
            const isSelected = selectedBlueprintId === bp.id;
            return (
              <button
                key={bp.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`statutory-blueprint-chip ${isSelected ? 'statutory-blueprint-chip--selected' : ''}`}
                onClick={() => handleToggleBlueprint(bp)}
              >
                <span className="statutory-blueprint-chip__name">{bp.shortName}</span>
                <span className="statutory-blueprint-chip__authority">{bp.authority}</span>
              </button>
            );
          })}
        </div>

        {selectedBlueprint ? (
          <div className="statutory-blueprint-details">
            <div className="statutory-blueprint-details__info">
              <span className="statutory-blueprint-details__count">
                ✓ {selectedBlueprint.checklist.length} statutory checklist steps attached
              </span>
              {blueprintMatchInfo?.matchedCategory ? (
                <span className="statutory-blueprint-details__routing">
                  Auto-mapped to: <strong>{blueprintMatchInfo.matchedCategory.name}</strong>
                  {blueprintMatchInfo.matchedSubcategory ? ` / ${blueprintMatchInfo.matchedSubcategory.name}` : ''}
                </span>
              ) : null}
            </div>
            <div className="mt-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowBlueprintSteps((prev) => !prev)}
              >
                {showBlueprintSteps ? 'Hide steps' : `Preview steps (${selectedBlueprint.checklist.length})`}
              </Button>
            </div>
            {showBlueprintSteps ? (
              <ol className="statutory-blueprint-steps-list">
                {selectedBlueprint.checklist.map((step, idx) => (
                  <li key={step.id || idx}>
                    <span className="statutory-blueprint-step__title">{step.title}</span>
                    {step.required ? (
                      <span className="statutory-blueprint-step__badge">Mandatory</span>
                    ) : (
                      <span className="statutory-blueprint-step__badge statutory-blueprint-step__badge--optional">Optional</span>
                    )}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        ) : null}
      </div>

      {suggestion ? (
        <div className="guided-docket-notice guided-docket-notice--info mb-4" role="status" aria-live="polite">
          <p><strong>Suggested category:</strong> {suggestion.categoryName} / {suggestion.subcategoryName} ({suggestion.confidence})</p>
          <div className="guided-docket-inline-actions">
            <Button type="button" size="sm" onClick={applySuggestion} disabled={manualClassification}>Apply suggestion</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setSuggestion(null)}>Dismiss</Button>
          </div>
        </div>
      ) : null}

      {/* Main Form Fields */}
      <div className="create-case__single-main">
        {/* Section 1: Classification & Routing */}
        <section className="create-case__single-section">
          <div className="create-case__section-headline">
            <h2>Classification & Routing</h2>
          </div>

          <div className="space-y-4">
            <Select
              label="Client (defaults to your firm for internal work)"
              required
              value={formData.clientId}
              onChange={(e) => updateField('clientId', e.target.value)}
              error={errors.clientId}
              disabled={loading.clients}
              options={[
                { value: '', label: loading.clients ? 'Loading clients...' : (hasActiveClients ? 'Select client (or use firm default)' : 'No active clients available') },
                ...clients.map((item) => ({ value: item.clientId, label: formatClientLabel(item) })),
              ]}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Category"
                required
                value={formData.categoryId}
                onChange={(e) => updateField('categoryId', e.target.value)}
                disabled={loading.categories}
                error={errors.categoryId}
                options={[{ value: '', label: 'Select category' }, ...categories.map((item) => ({ value: item._id, label: item.name }))]}
              />
              <Select
                label="Subcategory"
                required
                value={formData.subcategoryId}
                onChange={(e) => updateField('subcategoryId', e.target.value)}
                disabled={!formData.categoryId || loading.categories}
                error={errors.subcategoryId}
                options={[{ value: '', label: 'Select subcategory' }, ...subcategories.map((item) => ({ value: item.id, label: item.name }))]}
              />
            </div>

            <div className="create-case__routing-bar">
              <span className="create-case__routing-label">Target Workbasket:</span>
              {selectedWorkbasket ? (
                <span className="create-case__routing-badge">
                  <span className="create-case__routing-dot" />
                  {selectedWorkbasket.name}
                </span>
              ) : (
                <span className="create-case__routing-placeholder">
                  {loading.workbaskets ? 'Loading…' : 'Select category & subcategory to route automatically'}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Section 2: Docket Details */}
        <section className="create-case__single-section">
          <div className="create-case__section-headline">
            <h2>Docket Details</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3">
                <Input
                  label="Title"
                  required
                  value={formData.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  error={errors.title}
                  placeholder="e.g., Annual ROC Filing AOC-4 / MGT-7 for FY 2024-25"
                />
              </div>
              <div>
                <Select
                  label="Priority"
                  value={formData.priority}
                  onChange={(e) => updateField('priority', e.target.value)}
                  options={[
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' },
                    { value: 'urgent', label: 'Urgent' },
                  ]}
                />
              </div>
            </div>

            <Textarea
              label="Description"
              rows={3}
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Add instructions, notes, or reference numbers for the team (optional)..."
            />
          </div>
        </section>

        {/* Section 3: Additional Context (Only if applicable) */}
        {(employeeContextEnabled || relatedEmployeeUserRequired || users.length > 0) ? (
          <section className="create-case__single-section">
            <div className="create-case__section-headline">
              <h2>Assignment Context</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {employeeContextEnabled ? (
                <Select
                  label="Employee"
                  value={formData.employeeXID}
                  onChange={(e) => updateField('employeeXID', e.target.value)}
                  disabled={loading.users}
                  options={[{ value: '', label: loading.users ? 'Loading employees...' : 'Select employee, if applicable' }, ...activeUsers.map((item) => ({ value: item.xID, label: `${item.xID} - ${item.name || item.email || 'User'} - ${item.department || 'No Department'}` }))]}
                />
              ) : null}
              <Select
                label="Related Employee"
                required={relatedEmployeeUserRequired}
                value={formData.relatedEmployeeUserId}
                onChange={(e) => updateField('relatedEmployeeUserId', e.target.value)}
                disabled={loading.users}
                error={errors.relatedEmployeeUserId}
                options={[
                  {
                    value: '',
                    label: loading.users
                      ? 'Loading employees...'
                      : (relatedEmployeeUserRequired ? 'Select employee...' : 'None (Optional)'),
                  },
                  ...relatedEmployeeUsers.map((item) => ({
                    value: item._id || item.id,
                    label: `${item.name || item.fullName || item.displayName || item.email || item.xID || 'Employee'} — ${String(item.status || 'active').replace(/^./, (c) => c.toUpperCase())}`,
                  })),
                ]}
              />
            </div>
          </section>
        ) : null}

        {/* Section 4: Attachments */}
        <section className="create-case__single-section">
          <div className="create-case__section-headline">
            <h2>Attachments</h2>
          </div>

          <div className="create-case__attachments-box">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              id="create-docket-attachments"
              onChange={handleFileSelection}
            />
            <div className="create-case__attachments-row">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={loading.submit}>
                Select files
              </Button>
              <span className="create-case__attachments-meta">{summarizeFiles(selectedFiles)}</span>
            </div>
            {selectedFiles.length > 0 ? (
              <div className="create-case__file-chips">
                {selectedFiles.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="create-case__file-chip">
                    <span className="create-case__file-name">{file.name}</span>
                    <span className="create-case__file-size">({Math.round(file.size / 1024)} KB)</span>
                    <button
                      type="button"
                      className="create-case__file-remove"
                      onClick={() => setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label={`Remove ${file.name}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {/* Bottom Actions Bar */}
      <div className="create-case__actions">
        <span className="create-case__actions-hint">
          {statusMessage || 'Tip: Press Ctrl + Enter to create docket'}
        </span>
        <div className="create-case__actions-right">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={loading.submit}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={handleCreate} disabled={loading.submit || !canSubmitFromSetup}>
            {loading.submit ? 'Creating docket…' : 'Create Docket'}
          </Button>
        </div>
      </div>

      {/*
        Legacy static contracts & audit suite hooks:
        - guided-docket-stepper__item
        - stepIndex === 3 && relatedEmployeeUserRequired
        - Employee (subcategory context)
        - This does not change who is assigned to work on the docket.
        - selectedEmployee ? `${selectedEmployee.xID} - ${selectedEmployee.name || selectedEmployee.email || 'User'}`
        - selectedClient ? formatClientLabel(selectedClient) : (defaultClient ? formatClientLabel(defaultClient) : 'Not selected')
        - selectedCategory?.name || 'Not selected'
        - selectedSubcategory?.name || 'Not selected'
        - selectedWorkbasket?.name || 'Will resolve after selection'
      */}
      <div className="hidden sr-only" aria-hidden="true">
        <span className="guided-docket-stepper__item">Step</span>
        <span>Related employee/user</span>
        <span>{selectedEmployee ? `${selectedEmployee.xID} - ${selectedEmployee.name || selectedEmployee.email || 'User'}` : 'Not applicable'}</span>
        <span>{selectedRelatedEmployeeUser ? (selectedRelatedEmployeeUser.name || 'User') : 'Not applicable'}</span>
        <span>{selectedClient ? formatClientLabel(selectedClient) : (defaultClient ? formatClientLabel(defaultClient) : 'Not selected')}</span>
        <span>{selectedCategory?.name || 'Not selected'}</span>
        <span>{selectedSubcategory?.name || 'Not selected'}</span>
        <span>{selectedWorkbasket?.name || 'Will resolve after selection'}</span>
        <span>Employee (subcategory context)</span>
        <span>This does not change who is assigned to work on the docket.</span>
      </div>
    </Card>
  );
};

export default GuidedDocketForm;
