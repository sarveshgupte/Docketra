/**
 * Create Docket Page
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { Textarea } from '../components/common/Textarea';
import { Button } from '../components/common/Button';
import { SectionCard } from '../components/layout/SectionCard';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { caseApi } from '../api/case.api';
import { categoryService } from '../services/categoryService';
import { clientApi } from '../api/client.api';
import { getFirmConfig } from '../utils/firmConfig';
import { formatClientDisplay } from '../utils/formatters';
import { formatDateTime } from '../utils/formatDateTime';
import { UX_COPY } from '../constants/uxCopy';
import { resolveUiError } from '../utils/uiFeedback';
import './CreateCasePage.css';

/** Returns a simple completion fraction for a section given field names and formData. */
const sectionCompletion = (fields, formData) => {
  const filled = fields.filter((f) => formData[f] && String(formData[f]).trim() !== '').length;
  return { filled, total: fields.length, complete: filled === fields.length };
};

/** Small badge that shows when a section is complete. */
const CompletionDot = ({ complete }) =>
  complete ? (
    <span className="create-case__section-done" aria-label="Section complete">✓</span>
  ) : null;

const getDefaultSlaDueDate = () => {
  const { slaDefaultDays = 3 } = getFirmConfig();
  const due = new Date(Date.now() + Number(slaDefaultDays || 3) * 24 * 60 * 60 * 1000);
  due.setMinutes(due.getMinutes() - due.getTimezoneOffset());
  return due.toISOString().slice(0, 16);
};

export const CreateCasePage = () => {
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const { user } = useAuth();
  const isAdmin = ['ADMIN', 'Admin'].includes(user?.role);
  const toast = useToast();
  const { showSuccess } = toast;
  const { loading: submitting, error: submitError, run: runSubmit, clearError } = useAsyncAction();
  
  const [formData, setFormData] = useState({
    clientId: '', // Will be populated from active clients
    categoryId: '',
    subcategoryId: '',
    title: '', // MANDATORY
    description: '', // MANDATORY
    slaDueDate: getDefaultSlaDueDate(), // MANDATORY
  });
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [clients, setClients] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingDependencies, setLoadingDependencies] = useState(false);
  const [dependencyErrors, setDependencyErrors] = useState({ categories: '', clients: '' });
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [successMessage, setSuccessMessage] = useState(null);
  const [footerConfirmation, setFooterConfirmation] = useState('');
  // Task 7: Soft auto-save state — only enabled when user is authenticated
  const userId = user?._id || user?.id;
  const DRAFT_STORAGE_KEY = userId ? `createCaseDraft_${userId}` : null;
  const AUTO_SAVE_DELAY_MS = 5000;
  const autoSaveTimerRef = useRef(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const titleInputRef = useRef(null);

  const fetchCategories = useCallback(async () => {
    setLoadingDependencies(true);
    setDependencyErrors((current) => ({ ...current, categories: '' }));
    try {
      const response = await categoryService.getCategories(true); // Get only active categories
      if (response.success) {
        setCategories(response.data || []);
      }
    } catch (err) {
      setDependencyErrors((current) => ({ ...current, categories: 'Could not load categories.' }));
      resolveUiError(err, {
        fallbackMessage: 'Failed to load categories.',
        toast,
        toastOnError: true,
        inline: false,
      });
    } finally {
      setLoadingCategories(false);
      setLoadingDependencies(false);
    }
  }, [toast]);

  const fetchClients = useCallback(async () => {
    setLoadingDependencies(true);
    setDependencyErrors((current) => ({ ...current, clients: '' }));
    try {
      // Use forCreateCase=true to always get Default Client (C000001) + active clients
      const response = await clientApi.getClients(false, true);
      if (response.success) {
        const clientList = response.data || [];
        setClients(clientList);
        
        // Always default to C000001 (Default Client) if available
        const defaultClient = clientList.find(c => c.clientId === 'C000001');
        setFormData((prev) => {
          if (prev.clientId) return prev;
          if (defaultClient) return { ...prev, clientId: 'C000001' };
          if (clientList.length > 0) return { ...prev, clientId: clientList[0].clientId };
          return prev;
        });
      }
    } catch (err) {
      setDependencyErrors((current) => ({ ...current, clients: 'Could not load clients.' }));
      resolveUiError(err, {
        fallbackMessage: 'Failed to load clients.',
        toast,
        toastOnError: true,
        inline: false,
      });
    } finally {
      setLoadingClients(false);
      setLoadingDependencies(false);
    }
  }, [toast]);

  // Fetch categories for dropdown
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Fetch clients for dropdown
  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    if (!DRAFT_STORAGE_KEY || draftRestored) return;
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const parsedDraft = JSON.parse(raw);
      if (!parsedDraft || typeof parsedDraft !== 'object') return;
      const hasMeaningfulContent = Boolean(parsedDraft.title || parsedDraft.description || parsedDraft.categoryId);
      if (!hasMeaningfulContent) return;
      setHasDraft(true);
    } catch {
      // ignore invalid draft payload
    } finally {
      setDraftRestored(true);
    }
  }, [DRAFT_STORAGE_KEY, draftRestored]);
  
  // Update subcategories when category changes
  useEffect(() => {
    if (formData.categoryId) {
      const selectedCategory = categories.find(cat => cat._id === formData.categoryId);
      if (selectedCategory) {
        // Filter only active subcategories
        const activeSubs = (selectedCategory.subcategories || []).filter(sub => sub.isActive);
        setSubcategories(activeSubs);
        if (activeSubs.length === 1) {
          setFormData((prev) => ({ ...prev, subcategoryId: activeSubs[0].id }));
        }
      } else {
        setSubcategories([]);
      }
      // Reset subcategory when category changes
      if (!selectedCategory || (selectedCategory.subcategories || []).filter(sub => sub.isActive).length !== 1) {
        setFormData(prev => ({ ...prev, subcategoryId: '' }));
      }
    } else {
      setSubcategories([]);
    }
  }, [formData.categoryId, categories]);

  useEffect(() => {
    if (loadingDependencies || loadingCategories || loadingClients || successMessage) return;
    titleInputRef.current?.focus();
  }, [loadingDependencies, loadingCategories, loadingClients, successMessage]);

  // Task 7: Auto-save draft to localStorage after 5s of inactivity (only when authenticated)
  useEffect(() => {
    if (!DRAFT_STORAGE_KEY) return; // no-op if user not authenticated
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    // Only save if there's meaningful content (not just default clientId)
    const hasContent = formData.title || formData.description || formData.categoryId;
    if (!hasContent) return;
    autoSaveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formData));
        setDraftSaved(true);
        setTimeout(() => setDraftSaved(false), 3000); // hide indicator after 3s
      } catch {
        // ignore storage errors
      }
    }, AUTO_SAVE_DELAY_MS);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  // DRAFT_STORAGE_KEY and AUTO_SAVE_DELAY_MS are stable per render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData]);

  const categoryOptions = [
    { value: '', label: 'Select Category', disabled: true },
    ...categories.map(cat => ({
      value: cat._id,
      label: cat.name,
    })),
  ];
  
  const subcategoryOptions = [
    { value: '', label: 'Select Subcategory', disabled: true },
    ...subcategories.map(sub => ({
      value: sub.id,
      label: sub.name,
    })),
  ];

  const clientOptions = [
    { value: '', label: 'Select Client', disabled: true },
    ...clients.map(client => ({
      value: client.clientId,
      label: formatClientDisplay(client), // Format: C000002 – Business Name
    })),
  ];

  const validateField = (name, value) => {
    let error = '';
    
    switch (name) {
      case 'clientId':
        if (!value) {
          error = 'Client is required';
        }
        break;
      case 'title':
        if (!value || !value.trim()) {
          error = 'Title is required';
        }
        break;
      case 'description':
        if (!value || !value.trim()) {
          error = 'Description is required';
        }
        break;
      case 'categoryId':
        if (!value) {
          error = 'Category is required';
        }
        break;
      case 'subcategoryId':
        if (!value) {
          error = 'Subcategory is required';
        }
        break;
      case 'slaDueDate':
        if (!value) {
          error = 'SLA Due Date is required';
        } else {
          // Parse the datetime-local value and compare with current time
          const selectedDate = new Date(value);
          const now = new Date();
          if (selectedDate <= now) {
            error = 'SLA Due Date must be in the future';
          }
        }
        break;
      default:
        break;
    }
    
    return error;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Validate field on change
    const error = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));
  };
  
  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    
    // Validate field on blur
    const error = validateField(name, formData[name]);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const validateForm = () => {
    const newErrors = {};
    
    newErrors.clientId = validateField('clientId', formData.clientId);
    newErrors.title = validateField('title', formData.title);
    newErrors.description = validateField('description', formData.description);
    newErrors.categoryId = validateField('categoryId', formData.categoryId);
    newErrors.subcategoryId = validateField('subcategoryId', formData.subcategoryId);
    newErrors.slaDueDate = validateField('slaDueDate', formData.slaDueDate);
    
    setErrors(newErrors);
    setTouched({
      clientId: true,
      title: true,
      description: true,
      categoryId: true,
      subcategoryId: true,
      slaDueDate: true,
    });
    
    return !Object.values(newErrors).some(error => error);
  };

  const handleSubmit = async (e, forceCreate = false) => {
    e.preventDefault();
    setDuplicateWarning(null);
    setSuccessMessage(null);
    clearError();

    if (!validateForm()) {
      return;
    }

    try {
      const payload = isAdmin ? formData : { ...formData, slaDueDate: undefined };
      const response = await runSubmit(() => caseApi.createCase(payload, forceCreate), {
        toast,
        toastOnError: true,
        inline: false,
        fallbackMessage: 'Failed to create docket. Please retry.',
      });
      
      if (response.success) {
        const confirmationTime = formatDateTime(new Date());
        const successCopy = `Docket ${response.data.caseId} created • ${confirmationTime}`;
        showSuccess(successCopy);
        setFooterConfirmation(successCopy);
        // DO NOT redirect to case detail - show success message instead
        // Per PR requirements: show success and options to go to Workbasket or create another
        setSuccessMessage({
          caseId: response.data.caseId,
          caseName: response.data.caseName,
          timestamp: confirmationTime,
        });
        // Reset form for creating another case
        setFormData({
          clientId: clients.find((client) => client.clientId === 'C000001')?.clientId || (clients.length > 0 ? clients[0].clientId : ''),
          categoryId: '',
          subcategoryId: '',
          title: '',
          description: '',
          slaDueDate: getDefaultSlaDueDate(),
        });
        setErrors({});
        setTouched({});
        setDuplicateWarning(null);
        // Task 7: Clear draft on successful submit
        if (DRAFT_STORAGE_KEY) {
          try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch { /* ignore */ }
        }
        setDraftSaved(false);
        setHasDraft(false);
      }
    } catch (err) {
      if (err.response?.status === 409) {
        // Duplicate client warning
        setDuplicateWarning(err.response.data);
      } else {
        setErrors(prev => ({ ...prev, submit: '' }));
      }
    }
  };

  const handleForceCreate = (e) => {
    handleSubmit(e, true);
  };

  const handleCancelDuplicate = () => {
    setDuplicateWarning(null);
  };

  const retryDependencies = () => {
    setLoadingCategories(true);
    setLoadingClients(true);
    setDependencyErrors({ categories: '', clients: '' });
    fetchCategories();
    fetchClients();
  };

  const restoreDraft = () => {
    if (!DRAFT_STORAGE_KEY) return;
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const parsedDraft = JSON.parse(raw);
      if (!parsedDraft || typeof parsedDraft !== 'object') return;
      setFormData((prev) => ({ ...prev, ...parsedDraft }));
      setHasDraft(false);
      setFooterConfirmation('Draft restored. Review fields and submit when ready.');
    } catch {
      setHasDraft(false);
    }
  };

  const discardDraft = () => {
    if (!DRAFT_STORAGE_KEY) return;
    try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch { /* ignore */ }
    setHasDraft(false);
    setFooterConfirmation('Saved draft removed. Starting with fresh defaults.');
  };

  // Computed section completion state
  const sec1 = useMemo(() => sectionCompletion(['clientId'], formData), [formData]);
  const sec2 = useMemo(() => sectionCompletion(['categoryId', 'subcategoryId', 'title', 'description'], formData), [formData]);
  const sec3 = useMemo(() => sectionCompletion(['slaDueDate'], formData), [formData]);

  // Summary panel derived values
  const selectedClient = clients.find((c) => c.clientId === formData.clientId);
  const selectedCategory = categories.find((c) => c._id === formData.categoryId);
  const selectedSubcategory = subcategories.find((s) => s.id === formData.subcategoryId);
  const allSectionsValid = sec1.complete && sec2.complete && sec3.complete;
  const blockingDependencyIssue = Boolean(dependencyErrors.categories || dependencyErrors.clients);
  const hasNoClients = !loadingClients && clients.length === 0;
  const hasNoCategories = !loadingCategories && categories.length === 0;

  return (
    <Layout>
      <div className="create-case">
        <div className="create-case__header">
          <h1>Create Docket</h1>
          <p className="text-secondary">All fields marked with * are required</p>
          <p className="text-secondary">Tip: use Tab to move quickly across fields, and press Ctrl/Cmd + Enter in Description to submit.</p>
          {/* Task 7: Draft auto-save indicator */}
          {draftSaved && (
            <span className="create-case__draft-saved" role="status" aria-live="polite">
              💾 Draft locally saved
            </span>
          )}
        </div>

        {hasDraft ? (
          <Card className="mb-4">
            <div className="neo-alert neo-alert--warning">
              <h3>Resume where you left off?</h3>
              <p className="mt-sm">We found an unsent draft for this form.</p>
              <div className="mt-md" style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                <Button type="button" variant="primary" onClick={restoreDraft}>Restore draft</Button>
                <Button type="button" variant="outline" onClick={discardDraft}>Start fresh</Button>
              </div>
            </div>
          </Card>
        ) : null}

        {/* Success Message */}
        {successMessage && (
          <div className="neo-alert neo-alert--success" style={{ marginBottom: 'var(--spacing-lg)' }}>
            <h3>✅ Docket Created Successfully!</h3>
            <p>
              Docket <strong>{successMessage.caseId}</strong> has been created and moved to the Workbasket.
            </p>
            <p className="text-secondary">{successMessage.timestamp}</p>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
              <Button variant="primary" onClick={() => navigate(`/app/firm/${firmSlug}/cases/${successMessage.caseId}`)}>
                View Docket
              </Button>
              <Button variant="outline" onClick={() => navigate(`/app/firm/${firmSlug}/global-worklist`)}>
                Go to Workbasket
              </Button>
              <Button variant="outline" onClick={() => setSuccessMessage(null)}>
                Create Another Docket
              </Button>
            </div>
          </div>
        )}

        <div className="create-case__layout">
          {/* Main form area */}
          <div className="create-case__form-area">
            {(blockingDependencyIssue || hasNoClients || hasNoCategories) && (
              <Card className="mb-4">
                <div className="neo-alert neo-alert--warning">
                  <h3>Some required setup data is unavailable</h3>
                  <p className="mt-sm">
                    {blockingDependencyIssue
                      ? 'We could not load clients or categories, so case creation is temporarily disabled.'
                      : 'Add at least one active client and category before creating a docket.'}
                  </p>
                  <div className="mt-md" style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                    <Button type="button" variant="outline" onClick={() => window.location.reload()}>
                      Reload page
                    </Button>
                    <Button type="button" variant="primary" onClick={retryDependencies}>
                      Retry setup data
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {duplicateWarning ? (
              <Card>
                <div className="create-case__duplicate-warning">
                  <div className="neo-alert neo-alert--warning">
                    <h3>Duplicate Client Detected</h3>
                    <p>{duplicateWarning.message}</p>
                    
                    {duplicateWarning.matchedFields && (
                      <div className="create-case__matched-fields">
                        <p><strong>Matched Fields:</strong></p>
                        <ul>
                          {duplicateWarning.matchedFields.map((field, index) => (
                            <li key={index}>{field}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    <p className="mt-md">
                      Do you want to continue creating this case?
                    </p>
                  </div>

                  <div className="create-case__duplicate-actions">
                    <Button onClick={handleCancelDuplicate}>
                      Cancel
                    </Button>
                    <Button variant="danger" onClick={handleForceCreate} disabled={submitting}>
                      {submitting ? 'Saving...' : 'Continue Anyway'}
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <form onSubmit={handleSubmit}>
                {/* Section 1 – Client Context */}
                <SectionCard
                  title={
                    <span className="create-case__section-heading">
                      Client Context <CompletionDot complete={sec1.complete} />
                    </span>
                  }
                  subtitle="Who is this case for?"
                  className="create-case__section"
                >
                  <Select
                    label="Client"
                    name="clientId"
                    value={formData.clientId}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    options={clientOptions}
                    required
                    disabled={loadingClients || blockingDependencyIssue || hasNoClients}
                    error={touched.clientId && errors.clientId}
                    helpText="Default client is preselected when available to reduce setup time."
                  />
                </SectionCard>

                {/* Section 2 – Docket Classification */}
                <SectionCard
                  title={
                    <span className="create-case__section-heading">
                      Docket Classification <CompletionDot complete={sec2.complete} />
                    </span>
                  }
                  subtitle="Define the case type and details."
                  className="create-case__section"
                >
                  <Select
                    label="Category"
                    name="categoryId"
                    value={formData.categoryId}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    options={categoryOptions}
                    required
                    disabled={loadingCategories || blockingDependencyIssue || hasNoCategories}
                    error={touched.categoryId && errors.categoryId}
                  />

                  <Select
                    label="Subcategory"
                    name="subcategoryId"
                    value={formData.subcategoryId}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    options={subcategoryOptions}
                    required
                    disabled={!formData.categoryId || subcategories.length === 0}
                    error={touched.subcategoryId && errors.subcategoryId}
                    helpText={!formData.categoryId ? 'Pick a category first.' : subcategories.length === 0 ? 'No active subcategories available for this category yet.' : undefined}
                  />

                  <Input
                    label="Title"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Enter docket title"
                    required
                    error={touched.title && errors.title}
                    ref={titleInputRef}
                    helpText="Use a short, descriptive title (e.g., GST filing delay Q2)."
                  />

                  <Textarea
                    label="Description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Provide detailed docket description"
                    rows={6}
                    required
                    error={touched.description && errors.description}
                    helpText="Add context, key dates, and expected next action."
                    onKeyDown={(event) => {
                      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                  />
                </SectionCard>

                {/* Section 3 – Execution & SLA */}
                <SectionCard
                  title={
                    <span className="create-case__section-heading">
                      Execution &amp; SLA <CompletionDot complete={sec3.complete} />
                    </span>
                  }
                  subtitle="Set delivery expectations."
                  className="create-case__section"
                >
                  <Input
                    label={isAdmin ? 'SLA Due Date' : 'SLA Due Date 🔒'}
                    name="slaDueDate"
                    type="datetime-local"
                    value={formData.slaDueDate}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    required
                    disabled={!isAdmin}
                    title={!isAdmin ? 'Only admins can modify SLA.' : undefined}
                    error={touched.slaDueDate && errors.slaDueDate}
                  />
                </SectionCard>

                {(errors.submit || submitError) && (
                  <div className="neo-alert neo-alert--danger">
                    {(errors.submit || submitError)} Retry by submitting again.
                  </div>
                )}

                <div className="create-case__actions">
                  <div className="create-case__status" aria-live="polite">
                    {submitting
                      ? 'Creating docket...'
                      : loadingDependencies
                        ? 'Loading required dropdown data...'
                        : footerConfirmation || 'Draft not saved yet'}
                  </div>
                  <div className="create-case__actions-right">
                    <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                    Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={submitting || blockingDependencyIssue || hasNoClients || hasNoCategories}
                    >
                      {submitting ? 'Saving...' : 'Create Docket'}
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* Right summary panel (desktop only) */}
          <aside className="create-case__summary">
            <div className="create-case__summary-inner">
              <h3 className="create-case__summary-title">Summary</h3>

              <div className="create-case__summary-row">
                <span className="create-case__summary-label">Client</span>
                <span className="create-case__summary-value">
                  {selectedClient ? formatClientDisplay(selectedClient) : <em className="create-case__summary-empty">Not selected</em>}
                </span>
              </div>

              <div className="create-case__summary-row">
                <span className="create-case__summary-label">Category</span>
                <span className="create-case__summary-value">
                  {selectedCategory ? selectedCategory.name : <em className="create-case__summary-empty">Not selected</em>}
                </span>
              </div>

              {selectedSubcategory && (
                <div className="create-case__summary-row">
                  <span className="create-case__summary-label">Subcategory</span>
                  <span className="create-case__summary-value">{selectedSubcategory.name}</span>
                </div>
              )}

              <div className="create-case__summary-row">
                <span className="create-case__summary-label">SLA Due</span>
                <span className="create-case__summary-value">
                  {formData.slaDueDate
                    ? formatDateTime(new Date(formData.slaDueDate))
                    : <em className="create-case__summary-empty">Not set</em>}
                </span>
              </div>

              <div className="create-case__summary-status">
                <span
                  className={`create-case__summary-validity${allSectionsValid ? ' create-case__summary-validity--ok' : ''}`}
                >
                  {allSectionsValid ? '✓ Ready to submit' : 'Complete all required fields'}
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
};
