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
  ), [formData, selectedFiles.length]);

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
  const shouldShowSetupChecklist = !setupChecklistCollapsed || !canSubmitFromSetup || Object.keys(dependencyErrors).length > 0 || Boolean(clientLoadIssue);
  const firmSlug = window.location.pathname.split('/')[3] || '';
  const canOpenSetupLinks = isFirmAdminOrAbove(user);
  const setupLink = (href, label) => (canOpenSetupLinks ? <a href={href}>{label}</a> : null);
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
    setErrors((prev) => ({ ...prev, [name]: '' }));
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
    setErrors((prev) => ({ ...prev, categoryId: '', subcategoryId: '' }));
    setSuggestion(null);
    setSubmitError('');
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
      nextErrors.relatedEmployeeUserId = 'Related employee/user is required for this category.';
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

  return (
    <Card className="create-case__single-sheet">
      {/* Legacy class contract retained for static UI checks: guided-docket-stepper__item */}
      <div className="create-case__header">
        <h1>Create Docket</h1>
        <p className="text-secondary">One page, direct routing. Choose the client, classify the docket, add context, and submit.</p>
      </div>

      {submitError ? <p className="guided-docket-notice guided-docket-notice--error">{submitError}</p> : null}
      {statusMessage ? <p className="guided-docket-notice guided-docket-notice--info">{statusMessage}</p> : null}

      <div className="guided-docket-panel">
        <div className="guided-docket-panel__header">
          <div>
            <p className="guided-docket-panel__title">Setup checklist</p>
            <p className="guided-docket-panel__caption">The form stays simple, but routing still depends on clients, categories, and mapped workbaskets.</p>
          </div>
          <Button type="button" variant="outline" onClick={() => setSetupChecklistCollapsed((prev) => !prev)}>
            {shouldShowSetupChecklist ? 'Hide checklist' : 'Show checklist'}
          </Button>
        </div>
        {shouldShowSetupChecklist ? (
          <ul className="guided-docket-list">
            <li>Clients: {clientSetupCopy} {setupLink(ROUTES.CLIENTS(firmSlug), 'Open Clients')}</li>
            <li>Categories: {categorySetupCopy} {setupLink(ROUTES.WORK_CATEGORY_MANAGEMENT(firmSlug), 'Open Category Management')}</li>
            <li>Workbaskets: {workbasketSetupCopy} {setupLink(ROUTES.WORK_SETTINGS(firmSlug), 'Open Work Settings')}</li>
            <li>Users: {userSetupCopy} {setupLink(ROUTES.ADMIN(firmSlug), 'Open Team/Admin')}</li>
          </ul>
        ) : null}
        {setupBlockingMessage ? <p className="guided-docket-notice guided-docket-notice--warning">{setupBlockingMessage}</p> : null}
        {(Object.keys(dependencyErrors).length > 0 || clientLoadIssue) ? (
          <Button type="button" variant="outline" onClick={loadDeps}>Retry failed loading</Button>
        ) : null}
      </div>

      <div className="create-case__single-layout">
        <div className="create-case__single-main">
          <section className="create-case__single-section">
            <div className="create-case__section-headline">
              <div>
                <h2>Classification</h2>
                <p>Category and subcategory decide routing, workbasket placement, and SLA.</p>
              </div>
            </div>

            {suggestion ? (
              <div className="guided-docket-notice guided-docket-notice--info" role="status" aria-live="polite">
                <p><strong>Suggested category:</strong> {suggestion.categoryName} / {suggestion.subcategoryName} ({suggestion.confidence})</p>
                <div className="guided-docket-inline-actions">
                  <Button type="button" onClick={applySuggestion} disabled={manualClassification}>Apply suggestion</Button>
                  <Button type="button" variant="outline" onClick={() => setSuggestion(null)}>Dismiss</Button>
                </div>
              </div>
            ) : null}

            <div className="create-case__field-grid">
              <Select
                label="Client (defaults to your firm for internal work)"
                required
                value={formData.clientId}
                onChange={(e) => updateField('clientId', e.target.value)}
                error={errors.clientId}
                disabled={loading.clients}
                helpText={hasActiveClients ? 'Choose the client this docket belongs to.' : 'Ask an admin to grant client access or confirm the firm default client setup.'}
                options={[
                  { value: '', label: loading.clients ? 'Loading clients...' : (hasActiveClients ? 'Use default firm client' : 'No active clients available') },
                  ...clients.map((item) => ({ value: item.clientId, label: formatClientLabel(item) })),
                ]}
              />
              <Select
                label="Category"
                required
                value={formData.categoryId}
                onChange={(e) => updateField('categoryId', e.target.value)}
                disabled={loading.categories}
                error={errors.categoryId}
                helpText="Start with the broader work type."
                options={[{ value: '', label: 'Select category' }, ...categories.map((item) => ({ value: item._id, label: item.name }))]}
              />
              <Select
                label="Subcategory"
                required
                value={formData.subcategoryId}
                onChange={(e) => updateField('subcategoryId', e.target.value)}
                disabled={!formData.categoryId || loading.categories}
                error={errors.subcategoryId}
                helpText="The selected subcategory routes the docket to the right workbasket."
                options={[{ value: '', label: 'Select subcategory' }, ...subcategories.map((item) => ({ value: item.id, label: item.name }))]}
              />
            </div>

            {(employeeContextEnabled || relatedEmployeeUserRequired || users.length > 0) ? (
              <div className="create-case__field-grid">
                {employeeContextEnabled ? (
                  <Select
                    label="Employee"
                    value={formData.employeeXID}
                    onChange={(e) => updateField('employeeXID', e.target.value)}
                    disabled={loading.users}
                    helpText="Shown only because this subcategory needs employee-specific context."
                    options={[{ value: '', label: loading.users ? 'Loading employees...' : 'Select employee, if applicable' }, ...activeUsers.map((item) => ({ value: item.xID, label: `${item.xID} - ${item.name || item.email || 'User'} - ${item.department || 'No Department'}` }))]}
                  />
                ) : null}
                <Select
                  label="Related employee/user"
                  required={relatedEmployeeUserRequired}
                  value={formData.relatedEmployeeUserId}
                  onChange={(e) => updateField('relatedEmployeeUserId', e.target.value)}
                  disabled={loading.users}
                  error={errors.relatedEmployeeUserId}
                  helpText={relatedEmployeeUserRequired
                    ? 'Required for this category/subcategory.'
                    : 'Optional context when the docket concerns a specific employee or user.'}
                  options={[
                    { value: '', label: loading.users ? 'Loading users...' : 'Not applicable' },
                    ...relatedEmployeeUsers.map((item) => ({
                      value: item._id || item.id,
                      label: `${item.name || item.fullName || item.displayName || item.email || item.xID || 'User'} — ${String(item.status || 'active').replace(/^./, (c) => c.toUpperCase())}`,
                    })),
                  ]}
                />
              </div>
            ) : null}
          </section>

          <section className="create-case__single-section">
            <div className="create-case__section-headline">
              <div>
                <h2>Docket details</h2>
                <p>Title is compulsory even after category selection, so teams can identify the docket quickly in worklists and search.</p>
              </div>
            </div>

            <div className="create-case__field-grid create-case__field-grid--details">
              <Input
                label="Title"
                required
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                error={errors.title}
                helpText="Use a specific action-oriented title your team can scan fast."
              />
              <Input
                label="Workbasket"
                readOnly
                value={selectedWorkbasket?.name || (loading.workbaskets ? 'Loading workbasket...' : 'Will route from selected subcategory')}
                error={errors.workbasketId}
                helpText="This is derived automatically from the selected subcategory."
              />
            </div>

            <Textarea
              label="Description"
              rows={5}
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              helpText="Optional. Add context, dates, or instructions that help execution."
            />
          </section>

          <section className="create-case__single-section">
            <div className="create-case__section-headline">
              <div>
                <h2>Files</h2>
                <p>Optional. Any selected files are uploaded right after the docket is created.</p>
              </div>
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
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={loading.submit}>
                  Select files
                </Button>
                <span className="create-case__attachments-meta">{summarizeFiles(selectedFiles)}</span>
              </div>
              {selectedFiles.length > 0 ? (
                <ul className="create-case__attachments-list">
                  {selectedFiles.map((file) => (
                    <li key={`${file.name}-${file.size}-${file.lastModified}`}>{file.name}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="create-case__single-side">
          <section className="create-case__single-section create-case__single-section--summary">
            <div className="create-case__section-headline">
              <div>
                <h2>Submission summary</h2>
                <p>This docket will be created unassigned unless you later route or assign it elsewhere.</p>
              </div>
            </div>

            <dl className="create-case__summary-grid">
              <div>
                <dt>Client</dt>
                <dd>{selectedClient ? formatClientLabel(selectedClient) : (defaultClient ? formatClientLabel(defaultClient) : 'Not selected')}</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{selectedCategory?.name || 'Not selected'}</dd>
              </div>
              <div>
                <dt>Subcategory</dt>
                <dd>{selectedSubcategory?.name || 'Not selected'}</dd>
              </div>
              <div>
                <dt>Workbasket</dt>
                <dd>{selectedWorkbasket?.name || 'Will resolve after selection'}</dd>
              </div>
              <div>
                <dt>Related employee/user</dt>
                <dd>{selectedRelatedEmployeeUser ? (selectedRelatedEmployeeUser.name || selectedRelatedEmployeeUser.fullName || selectedRelatedEmployeeUser.displayName || selectedRelatedEmployeeUser.email || selectedRelatedEmployeeUser.xID || 'User') : 'Not applicable'}</dd>
              </div>
              <div>
                <dt>Employee</dt>
                <dd>{selectedEmployee ? `${selectedEmployee.xID} - ${selectedEmployee.name || selectedEmployee.email || 'User'}` : 'Not applicable'}</dd>
              </div>
              <div>
                <dt>Files</dt>
                <dd>{selectedFiles.length ? `${selectedFiles.length} selected` : 'None'}</dd>
              </div>
            </dl>

            {!hasRoutingPrerequisites ? (
              <p className="guided-docket-notice guided-docket-notice--warning">
                Docket creation will stay blocked until an active category/subcategory is mapped to a workbasket.
              </p>
            ) : null}
          </section>
        </aside>
      </div>

      <div className="create-case__actions guided-docket-actions">
        <div className="create-case__status">
          {statusMessage || 'Category and subcategory set routing and SLA. Title stays mandatory for clarity in queues.'}
        </div>
        <div className="create-case__actions-right">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={loading.submit}>Cancel</Button>
          <Button type="button" variant="primary" onClick={handleCreate} disabled={loading.submit || !canSubmitFromSetup}>
            {loading.submit ? 'Submitting…' : 'Submit docket'}
          </Button>
        </div>
      </div>

      <style>{`
        .guided-docket-panel {
          margin-bottom: 1rem;
          border: 1px solid var(--dt-border-whisper);
          border-radius: var(--dt-radius-card);
          background: var(--dt-surface-subtle);
          padding: 1rem 1.125rem;
        }

        .guided-docket-panel__header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 0.75rem;
        }

        .guided-docket-panel__title {
          margin: 0;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--dt-text);
        }

        .guided-docket-panel__caption {
          margin: 0.2rem 0 0;
          font-size: 0.75rem;
          color: var(--dt-text-muted);
        }

        .guided-docket-list {
          margin: 0;
          padding-left: 1rem;
          color: var(--dt-text-secondary);
          display: grid;
          gap: 0.4rem;
          font-size: 0.875rem;
        }

        .guided-docket-notice {
          margin: 0 0 1rem;
          border-radius: 12px;
          padding: 0.875rem 1rem;
          font-size: 0.875rem;
        }

        .guided-docket-notice--error {
          border: 1px solid color-mix(in srgb, var(--dt-error) 30%, white);
          background: var(--dt-error-subtle);
          color: var(--dt-error);
        }

        .guided-docket-notice--info {
          border: 1px solid color-mix(in srgb, var(--dt-focus) 25%, white);
          background: color-mix(in srgb, var(--dt-focus) 8%, white);
          color: var(--dt-text);
        }

        .guided-docket-notice--warning {
          border: 1px solid #f6d365;
          background: #fff8e6;
          color: #8a5a00;
        }

        .guided-docket-inline-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: 0.75rem;
          flex-wrap: wrap;
        }

        .create-case__single-layout {
          display: grid;
          gap: 1rem;
          align-items: start;
        }

        .create-case__single-main {
          display: grid;
          gap: 1rem;
        }

        .create-case__single-side {
          min-width: 0;
        }

        .create-case__single-section {
          border: 1px solid var(--dt-border-whisper);
          border-radius: var(--dt-radius-card);
          background: var(--dt-surface);
          padding: 1.125rem;
        }

        .create-case__single-section--summary {
          position: sticky;
          top: 1rem;
        }

        .create-case__section-headline {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .create-case__section-headline h2 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--dt-text);
        }

        .create-case__section-headline p {
          margin: 0.35rem 0 0;
          font-size: 0.8125rem;
          color: var(--dt-text-muted);
          line-height: 1.5;
        }

        .create-case__field-grid {
          display: grid;
          gap: 0.875rem;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .create-case__field-grid--details {
          grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
          margin-bottom: 0.875rem;
        }

        .create-case__attachments-box {
          border: 1px dashed var(--dt-border);
          border-radius: var(--dt-radius-card);
          padding: 1rem;
          background: var(--dt-surface-subtle);
        }

        .create-case__attachments-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .create-case__attachments-meta {
          font-size: 0.8125rem;
          color: var(--dt-text-muted);
        }

        .create-case__attachments-list {
          margin: 0.875rem 0 0;
          padding-left: 1rem;
          color: var(--dt-text-secondary);
          display: grid;
          gap: 0.35rem;
          font-size: 0.875rem;
        }

        .create-case__summary-grid {
          display: grid;
          gap: 0.875rem;
          margin: 0;
        }

        .create-case__summary-grid div {
          border-bottom: 1px solid var(--dt-border-whisper);
          padding-bottom: 0.75rem;
        }

        .create-case__summary-grid div:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }

        .create-case__summary-grid dt {
          font-size: 0.6875rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--dt-text-muted);
          margin-bottom: 0.3rem;
        }

        .create-case__summary-grid dd {
          margin: 0;
          font-size: 0.875rem;
          color: var(--dt-text);
          line-height: 1.5;
          word-break: break-word;
        }

        .guided-docket-actions {
          gap: 1rem;
        }

        @media (min-width: 1120px) {
          .create-case__single-layout {
            grid-template-columns: minmax(0, 1.75fr) minmax(280px, 0.9fr);
          }
        }

        @media (max-width: 1023px) {
          .create-case__field-grid,
          .create-case__field-grid--details {
            grid-template-columns: 1fr;
          }

          .create-case__section-headline,
          .guided-docket-panel__header {
            flex-direction: column;
          }

          .create-case__single-section--summary {
            position: static;
          }
        }
      `}</style>
    </Card>
  );
};

export default GuidedDocketForm;
