import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Textarea } from '../common/Textarea';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { categoryService } from '../../services/categoryService';
import { adminApi } from '../../api/admin.api';
import { caseApi } from '../../api/case.api';

const STEPS = [
  'Basic Info',
  'Classification',
  'Routing',
  'Assignment',
  'Review & Create',
];

const defaultForm = {
  title: '',
  description: '',
  categoryId: '',
  subcategoryId: '',
  workbasketId: '',
  priority: 'medium',
  assignedTo: '',
};

export const GuidedDocketForm = ({ onCreated }) => {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [workbaskets, setWorkbaskets] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState({ categories: true, workbaskets: true, users: true, submit: false });

  useEffect(() => {
    const loadDeps = async () => {
      try {
        const [categoryResponse, workbasketResponse, usersResponse] = await Promise.all([
          categoryService.getCategories(true),
          adminApi.listWorkbaskets({ activeOnly: true }),
          adminApi.getUsers({ limit: 200, status: 'active' }),
        ]);

        const nextCategories = categoryResponse?.data || [];
        const nextWorkbaskets = workbasketResponse?.data || [];
        const nextUsers = usersResponse?.data || [];

        setCategories(nextCategories);
        setWorkbaskets(nextWorkbaskets);
        setUsers(nextUsers);
        if (nextWorkbaskets[0]?._id) {
          setFormData((prev) => ({ ...prev, workbasketId: prev.workbasketId || nextWorkbaskets[0]._id }));
        }
      } finally {
        setLoading({ categories: false, workbaskets: false, users: false, submit: false });
      }
    };

    loadDeps();
  }, []);

  useEffect(() => {
    const selected = categories.find((item) => item._id === formData.categoryId);
    const nextSubcategories = (selected?.subcategories || []).filter((item) => item.isActive);
    setSubcategories(nextSubcategories);
    if (!nextSubcategories.find((item) => item.id === formData.subcategoryId)) {
      setFormData((prev) => ({ ...prev, subcategoryId: '' }));
    }
  }, [categories, formData.categoryId, formData.subcategoryId]);

  const validateStep = (stepIndex = step) => {
    const nextErrors = {};
    if (stepIndex === 0 && !formData.title.trim()) nextErrors.title = 'Title is required';
    if (stepIndex === 2 && !formData.workbasketId) nextErrors.workbasketId = 'Workbasket is required';
    if (formData.categoryId && formData.subcategoryId) {
      const isValidSub = subcategories.some((item) => item.id === formData.subcategoryId);
      if (!isValidSub) nextErrors.subcategoryId = 'Invalid subcategory for selected category';
    }

    setErrors((prev) => ({ ...prev, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  };

  const canProceed = useMemo(() => {
    if (step === 0) return Boolean(formData.title.trim());
    if (step === 2) return Boolean(formData.workbasketId);
    return true;
  }, [formData.title, formData.workbasketId, step]);

  const updateField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleCreate = async () => {
    if (!validateStep(0) || !validateStep(2)) return;

    setLoading((prev) => ({ ...prev, submit: true }));
    try {
      const response = await caseApi.createDocket({
        title: formData.title,
        description: formData.description,
        categoryId: formData.categoryId || undefined,
        subcategoryId: formData.subcategoryId || undefined,
        workbasketId: formData.workbasketId,
        priority: formData.priority || 'medium',
        assignedTo: formData.assignedTo || undefined,
      });

      if (response?.success) {
        onCreated?.(response);
      }
    } finally {
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

      {step === 0 && (
        <>
          <Input label="Title" required value={formData.title} onChange={(e) => updateField('title', e.target.value)} error={errors.title} />
          <Textarea label="Description (optional)" rows={4} value={formData.description} onChange={(e) => updateField('description', e.target.value)} />
        </>
      )}

      {step === 1 && (
        <>
          <Select
            label="Category"
            value={formData.categoryId}
            onChange={(e) => updateField('categoryId', e.target.value)}
            disabled={loading.categories}
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
          <Select
            label="Workbasket"
            required
            value={formData.workbasketId}
            onChange={(e) => updateField('workbasketId', e.target.value)}
            error={errors.workbasketId}
            disabled={loading.workbaskets}
            options={[{ value: '', label: loading.workbaskets ? 'Loading workbaskets...' : 'Select workbasket' }, ...workbaskets.map((item) => ({ value: item._id, label: item.name }))]}
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
          helpText="If empty, assignment falls back to workbasket rules."
          options={[{ value: '', label: loading.users ? 'Loading users...' : 'Auto-assign from workbasket' }, ...users.map((item) => ({ value: item.xID, label: `${item.xID} - ${item.name || item.email || 'User'}` }))]}
        />
      )}

      {step === 4 && (
        <div>
          <h3>Review</h3>
          <p><strong>Title:</strong> {formData.title || '—'}</p>
          <p><strong>Description:</strong> {formData.description || '—'}</p>
          <p><strong>Category:</strong> {(categories.find((item) => item._id === formData.categoryId)?.name) || '—'}</p>
          <p><strong>Subcategory:</strong> {(subcategories.find((item) => item.id === formData.subcategoryId)?.name) || '—'}</p>
          <p><strong>Workbasket:</strong> {(workbaskets.find((item) => item._id === formData.workbasketId)?.name) || '—'}</p>
          <p><strong>Priority:</strong> {formData.priority || 'medium'}</p>
          <p><strong>Assignee:</strong> {formData.assignedTo || 'Auto-assign'}</p>
        </div>
      )}

      <div className="create-case__actions" style={{ marginTop: 16 }}>
        <Button type="button" variant="outline" onClick={() => setStep((prev) => Math.max(0, prev - 1))} disabled={step === 0 || loading.submit}>Back</Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" variant="primary" onClick={() => validateStep() && setStep((prev) => Math.min(STEPS.length - 1, prev + 1))} disabled={!canProceed || loading.submit}>Next</Button>
        ) : (
          <Button type="button" variant="primary" onClick={handleCreate} disabled={loading.submit}>{loading.submit ? 'Creating...' : 'Create Docket'}</Button>
        )}
      </div>
    </Card>
  );
};

export default GuidedDocketForm;
