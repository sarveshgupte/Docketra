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

const STEPS = ['Basic Info', 'Classification', 'Routing', 'Assignment', 'Review & Create'];

const defaultForm = {
  workType: 'client',
  title: '',
  description: '',
  categoryId: '',
  subcategoryId: '',
  clientId: '',
  workbasketId: '',
  priority: 'medium',
  assignedTo: '',
};

const isEmailLikeError = (message) => typeof message === 'string' && message.toLowerCase().includes('validation');

export const GuidedDocketForm = ({ onCreated, onCancel, initialWorkType = 'client', initialClientId = '' }) => {
  const { showError } = useToast();
  const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [formData, setFormData] = useState({ ...defaultForm, workType: initialWorkType === 'internal' ? 'internal' : 'client' });
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
      || (formData.workType === 'client' && formData.clientId)
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
          const preferredClientId = initialClientId && nextClients.some((item) => item.clientId === initialClientId)
            ? initialClientId
            : '';
          return {
            ...prev,
            clientId: prev.clientId || preferredClientId || nextClients[0]?.clientId || '',
            workbasketId: prev.workbasketId || nextWorkbaskets[0]?._id || '',
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
    const title = formData.title.trim();

    if (stepIndex === 0) {
      if (!title) nextErrors.title = 'Enter a title to continue.';
      else if (title.length < 5) nextErrors.title = 'Title should be at least 5 characters.';

      if (formData.workType !== 'internal' && !formData.clientId) {
        nextErrors.clientId = 'Select a client for client work.';
      }
    }

    if (stepIndex === 2 && !formData.workbasketId) nextErrors.workbasketId = 'Workbasket mapping is required before submit.';

    if (formData.categoryId && formData.subcategoryId) {
      const isValidSub = subcategories.some((item) => item.id === formData.subcategoryId);
      if (!isValidSub) nextErrors.subcategoryId = 'Selected subcategory is not valid for this category.';
    }

    setErrors((prev) => ({ ...prev, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  };

  const canProceed = useMemo(() => {
    if (step === 0) return Boolean(formData.title.trim()) && (formData.workType === 'internal' || Boolean(formData.clientId));
    if (step === 2) return Boolean(formData.workbasketId);
    return true;
  }, [formData.clientId, formData.title, formData.workType, formData.workbasketId, step]);

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
    if (!validateStep(0) || !validateStep(2)) return;

    setLoading((prev) => ({ ...prev, submit: true }));
    setStatusMessage('Creating docket…');
    try {
      const response = await caseApi.createDocket({
        title: formData.title.trim(),
        description: formData.description.trim(),
        categoryId: formData.categoryId || undefined,
        subcategoryId: formData.subcategoryId || undefined,
        clientId: formData.workType === 'internal' ? undefined : formData.clientId,
        isInternal: formData.workType === 'internal',
        workType: formData.workType,
        workbasketId: formData.workbasketId,
        priority: formData.priority || 'medium',
        assignedTo: formData.assignedTo || undefined,
      });

      if (response?.success) {
        onCreated?.(response);
        return;
      }

      const apiMessage = response?.message || 'Failed to create docket. Please review the fields and try again.';
      setSubmitError(apiMessage);
      if (isEmailLikeError(apiMessage)) showError(apiMessage);
    } catch (error) {
      const apiMessage = error?.response?.data?.message || error?.message || 'Failed to create docket. Please review the fields and try again.';
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

      {step === 0 && (
        <>
          <Input label="Title" required value={formData.title} onChange={(e) => updateField('title', e.target.value)} error={errors.title} helpText="Use a clear title your team can recognize quickly." />
          <div>
            <p className="mb-2 block text-sm font-medium text-gray-800">Work Type <span className="ml-1 text-red-500">*</span></p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={formData.workType === 'client' ? 'primary' : 'outline'}
                onClick={() => {
                  setFormData((prev) => ({ ...prev, workType: 'client', clientId: prev.clientId || clients[0]?.clientId || '' }));
                  setErrors((prev) => ({ ...prev, clientId: '' }));
                }}
              >
                Client Work
              </Button>
              <Button
                type="button"
                variant={formData.workType === 'internal' ? 'primary' : 'outline'}
                onClick={() => {
                  setFormData((prev) => ({ ...prev, workType: 'internal', clientId: '' }));
                  setErrors((prev) => ({ ...prev, clientId: '' }));
                }}
              >
                Internal Task
              </Button>
            </div>
          </div>
          <Select
            label={formData.workType === 'internal' ? 'Client (optional for internal work)' : 'Client'}
            required={formData.workType !== 'internal'}
            value={formData.clientId}
            onChange={(e) => updateField('clientId', e.target.value)}
            error={errors.clientId}
            disabled={loading.clients || formData.workType === 'internal'}
            options={[
              { value: '', label: formData.workType === 'internal' ? 'Internal work (no client required)' : (loading.clients ? 'Loading clients...' : 'Select client') },
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
            value={formData.categoryId}
            onChange={(e) => updateField('categoryId', e.target.value)}
            disabled={loading.categories}
            helpText="Category and subcategory decide routing defaults."
            options={[{ value: '', label: 'Select category' }, ...categories.map((item) => ({ value: item._id, label: item.name }))]}
          />
          <Select
            label="Subcategory"
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
          <p><strong>Work Type:</strong> {formData.workType === 'internal' ? 'Internal Work' : 'Client Work'}</p>
          <p><strong>Client:</strong> {formData.workType === 'internal' ? 'Not linked (internal)' : ((clients.find((item) => item.clientId === formData.clientId)?.businessName && `${formData.clientId} - ${clients.find((item) => item.clientId === formData.clientId)?.businessName}`) || formData.clientId || '—')}</p>
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
