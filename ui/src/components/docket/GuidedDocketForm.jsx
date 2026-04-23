import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Textarea } from '../common/Textarea';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { categoryService } from '../../services/categoryService';
import { adminApi } from '../../api/admin.api';
import { caseApi } from '../../api/case.api';
import { clientApi } from '../../api/client.api';
import { useToast } from '../../hooks/useToast';
import { useUnsavedChangesPrompt } from '../../hooks/useUnsavedChangesPrompt';
import { buildCreateDocketPayload, validateCreateDocketPayload, resolveEarliestErrorStep } from './createDocketPayload';

const STEPS = ['Basic Info', 'Classification', 'Routing', 'Assignment', 'Review & Create'];
const createSubmissionKey = () => {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `docket-create-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const defaultForm = {
  title: '',
  description: '',
  categoryId: '',
  subcategoryId: '',
  clientId: '',
  workbasketId: '',
  priority: 'medium',
  assignedTo: '',
  idempotencyKey: '',
};

const isEmailLikeError = (message) => typeof message === 'string' && message.toLowerCase().includes('validation');
const FIELD_TO_STEP = {
  title: 0,
  workType: 0,
  clientId: 0,
  categoryId: 1,
  subcategoryId: 1,
  workbasketId: 2,
  priority: 2,
  assignedTo: 3,
};

export const GuidedDocketForm = ({ onCreated, onCancel, initialClientId = '' }) => {
  const { showError } = useToast();
  const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [formData, setFormData] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [workbaskets, setWorkbaskets] = useState([]);
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState({ categories: true, workbaskets: true, users: true, clients: true, submit: false });

  const isDirty = useMemo(() => {
    return Boolean(
      formData.title.trim()
      || formData.description.trim()
      || formData.categoryId
      || formData.subcategoryId
      || formData.assignedTo
      || formData.clientId
    );
  }, [formData]);

  const { confirmLeaveIfDirty } = useUnsavedChangesPrompt({
    isDirty,
    isEnabled: !loading.submit,
    message: 'You have unsaved docket details. Leave this flow without creating the docket?',
  });

  useEffect(() => {
    const loadDeps = async () => {
      setStatusMessage('Loading form dependencies…');
      try {
        const [categoryResponse, workbasketResponse, usersResponse, clientResponse] = await Promise.all([
          categoryService.getCategories(true),
          adminApi.listWorkbaskets({ activeOnly: true }),
          adminApi.getUsers({ limit: 200, status: 'active' }),
          clientApi.getClients(true, true),
        ]);

        const nextCategories = categoryResponse?.data || [];
        const nextWorkbaskets = workbasketResponse?.data || [];
        const nextUsers = usersResponse?.data || [];
        const nextClients = clientResponse?.data || [];

        setCategories(nextCategories);
        setWorkbaskets(nextWorkbaskets);
        setUsers(nextUsers);
        setClients(nextClients);

        setFormData((prev) => {
          const firmDefaultClientId = nextClients.find((item) => item.isDefaultClient || item.isSystemClient || item.isInternal || item.clientId === 'C000001')?.clientId || '';
          const preferredClientId = initialClientId && nextClients.some((item) => item.clientId === initialClientId)
            ? initialClientId
            : '';
        return {
          ...prev,
          clientId: prev.clientId || preferredClientId || firmDefaultClientId || nextClients[0]?.clientId || '',
          workbasketId: prev.workbasketId || nextWorkbaskets[0]?._id || '',
          idempotencyKey: prev.idempotencyKey || createSubmissionKey(),
        };
      });
      } catch (error) {
        setSubmitError('Failed to load form options. Please refresh and retry.');
      } finally {
        setStatusMessage('');
        setLoading({ categories: false, workbaskets: false, users: false, clients: false, submit: false });
      }
    };

    loadDeps();
  }, [initialClientId]);

  useEffect(() => {
    const selected = categories.find((item) => item._id === formData.categoryId);
    const nextSubcategories = (selected?.subcategories || []).filter((item) => item.isActive);
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
    }));
  }, [categories, formData.categoryId, formData.subcategoryId, workbaskets]);

  const validateStep = (stepIndex = step) => {
    const nextErrors = {};
    const payload = buildCreateDocketPayload(formData);

    if (stepIndex === 0) {
      if (!payload.title) nextErrors.title = 'Enter a title to continue.';
      else if (payload.title.length < 5) nextErrors.title = 'Title should be at least 5 characters.';
      if (!payload.isInternal && !payload.clientId) nextErrors.clientId = 'Select a client for client work.';
    }

    if (stepIndex === 1) {
      if (!payload.categoryId) nextErrors.categoryId = 'Select a category to continue.';
      if (!payload.subcategoryId) nextErrors.subcategoryId = 'Select a subcategory to continue.';
    }

    if (stepIndex === 2 && !payload.workbasketId) nextErrors.workbasketId = 'Workbasket mapping is required before submit.';

    if (payload.categoryId && payload.subcategoryId) {
      const isValidSub = subcategories.some((item) => item.id === payload.subcategoryId);
      if (!isValidSub) nextErrors.subcategoryId = 'Selected subcategory is not valid for this category.';
    }

    setErrors((prev) => ({ ...prev, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  };

  const canProceed = useMemo(() => {
    if (step === 0) return Boolean(formData.title.trim()) && (formData.workType === 'internal' || Boolean(formData.clientId));
    if (step === 1) return Boolean(formData.categoryId) && Boolean(formData.subcategoryId);
    if (step === 2) return Boolean(formData.workbasketId);
    return true;
  }, [formData.clientId, formData.title, formData.workbasketId, step]);
  const selectedClient = clients.find((item) => item.clientId === formData.clientId);
  const defaultClient = clients.find((item) => item.isDefaultClient || item.isSystemClient || item.isInternal || item.clientId === 'C000001');
  const hasRoutingPrerequisites = categories.length > 0 && workbaskets.length > 0;

  const updateField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
    setSubmitError('');
  };

  const handleCancel = () => {
    if (!confirmLeaveIfDirty()) return;
    onCancel?.();
  };

  const handleCreate = async () => {
    if (loading.submit) return;
    setSubmitError('');
    const submitPayload = { ...formData, idempotencyKey: formData.idempotencyKey || createSubmissionKey() };
    const payload = buildCreateDocketPayload(submitPayload);
    const payloadErrors = validateCreateDocketPayload(payload, { categories, subcategories });
    if (!validateStep(0) || !validateStep(1) || !validateStep(2) || Object.keys(payloadErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...payloadErrors }));
      return;
    }

    setLoading((prev) => ({ ...prev, submit: true }));
    setStatusMessage('Creating docket…');
    try {
      const response = await caseApi.createDocket(payload);

      if (response?.success) {
        setFormData((prev) => ({ ...prev, idempotencyKey: createSubmissionKey() }));
        onCreated?.(response);
        return;
      }

      const apiMessage = response?.message || 'Failed to create docket. Please review the fields and try again.';
      setSubmitError(apiMessage);
      if (isEmailLikeError(apiMessage)) showError(apiMessage);
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
        const earliestStep = resolveEarliestErrorStep(mergedErrors, FIELD_TO_STEP);
        if (earliestStep !== null) {
          setStep(Math.min(step, earliestStep));
        }
      }
      setSubmitError(apiMessage);
      showError(apiMessage);
    } finally {
      setStatusMessage('');
      setLoading((prev) => ({ ...prev, submit: false }));
    }
  };

  return (
    <Card>
      <div className="create-case__header">
        <h1>Create Docket</h1>
        <p className="text-secondary">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {STEPS.map((label, index) => (
          <span key={label} className={`status-badge ${index === step ? 'status-open' : ''}`}>{index + 1}. {label}</span>
        ))}
      </div>

      {submitError ? <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p> : null}
      {statusMessage ? <p className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">{statusMessage}</p> : null}
      <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">First docket guidance</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li>Client: {selectedClient ? `${selectedClient.clientId} - ${selectedClient.businessName || 'Unnamed client'}` : (defaultClient ? `${defaultClient.clientId} - ${defaultClient.businessName || 'Default firm client'}` : 'Will use your default firm client if available')}.</li>
          <li>Category + subcategory are required because they determine routing and downstream queue visibility.</li>
          <li>Workbench is required and auto-selected from category/subcategory mapping.</li>
          <li>After creation, the docket appears in All Dockets and enters Workbench or the selected assignee’s My Worklist.</li>
        </ul>
      </div>
      {!hasRoutingPrerequisites ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Docket creation may be blocked until categories/subcategories and at least one active workbench are configured in Work Settings.
        </p>
      ) : null}

      {step === 0 && (
        <>
          <Input label="Title" required value={formData.title} onChange={(e) => updateField('title', e.target.value)} error={errors.title} helpText="Use a clear title your team can recognize quickly." />
          <Select
            label="Client (defaults to your firm for internal work)"
            required
            value={formData.clientId}
            onChange={(e) => updateField('clientId', e.target.value)}
            error={errors.clientId}
            disabled={loading.clients}
            helpText="Select a client. Use your firm (default) for internal tasks."
            options={[
              { value: '', label: loading.clients ? 'Loading clients...' : 'Use default firm client (auto-filled on submit)' },
              ...clients.map((item) => ({ value: item.clientId, label: `${item.clientId} - ${item.businessName || 'Unnamed client'}` })),
            ]}
          />
          <Textarea label="Description (optional)" rows={4} value={formData.description} onChange={(e) => updateField('description', e.target.value)} helpText="Include enough context for the assignee and reviewer." />
        </>
      )}

      {step === 1 && (
        <>
          <Select
            label="Category"
            required
            value={formData.categoryId}
            onChange={(e) => updateField('categoryId', e.target.value)}
            disabled={loading.categories}
            error={errors.categoryId}
            helpText="Category and subcategory decide routing defaults."
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
        </>
      )}

      {step === 2 && (
        <>
          <Input
            label="Workbasket"
            readOnly
            value={(workbaskets.find((item) => item._id === formData.workbasketId)?.name) || (loading.workbaskets ? 'Loading workbasket...' : 'Auto-selected by category/subcategory')}
            error={errors.workbasketId}
            helpText="Workbasket is auto-mapped from category/subcategory settings."
          />
          <Select
            label="Priority"
            value={formData.priority}
            onChange={(e) => updateField('priority', e.target.value)}
            options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]}
          />
        </>
      )}

      {step === 3 && (
        <Select
          label="Assign to user (optional)"
          value={formData.assignedTo}
          onChange={(e) => updateField('assignedTo', e.target.value)}
          disabled={loading.users}
          helpText="Leave empty to keep this docket in queue for assignment."
          options={[{ value: '', label: loading.users ? 'Loading users...' : 'Keep unassigned in workbasket' }, ...users.map((item) => ({ value: item.xID, label: `${item.xID} - ${item.name || item.email || 'User'}` }))]}
        />
      )}

      {step === 4 && (
        <div>
          <h3>Review</h3>
          <p><strong>Title:</strong> {formData.title || '—'}</p>
          <p><strong>Description:</strong> {formData.description || '—'}</p>
          <p><strong>Client:</strong> {((clients.find((item) => item.clientId === formData.clientId)?.businessName && `${formData.clientId} - ${clients.find((item) => item.clientId === formData.clientId)?.businessName}`) || formData.clientId || 'Default firm client (auto-selected)')}</p>
          <p><strong>Category:</strong> {(categories.find((item) => item._id === formData.categoryId)?.name) || '—'}</p>
          <p><strong>Subcategory:</strong> {(subcategories.find((item) => item.id === formData.subcategoryId)?.name) || '—'}</p>
          <p><strong>Workbasket:</strong> {(workbaskets.find((item) => item._id === formData.workbasketId)?.name) || '—'}</p>
          <p><strong>Priority:</strong> {formData.priority || 'medium'}</p>
          <p><strong>Assignee:</strong> {formData.assignedTo || 'Unassigned (workbasket queue)'}</p>
        </div>
      )}

      <div className="create-case__actions" style={{ marginTop: 16 }}>
        <Button type="button" variant="outline" onClick={handleCancel} disabled={loading.submit}>Cancel</Button>
        <Button type="button" variant="outline" onClick={() => setStep((prev) => Math.max(0, prev - 1))} disabled={step === 0 || loading.submit}>Back</Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" variant="primary" onClick={() => validateStep() && setStep((prev) => Math.min(STEPS.length - 1, prev + 1))} disabled={!canProceed || loading.submit}>Next</Button>
        ) : (
          <Button type="button" variant="primary" onClick={handleCreate} disabled={loading.submit}>{loading.submit ? 'Creating…' : 'Create Docket'}</Button>
        )}
      </div>
    </Card>
  );
};

export default GuidedDocketForm;
