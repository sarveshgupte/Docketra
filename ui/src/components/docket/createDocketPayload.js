const ensureCanonicalId = (value) => (typeof value === 'string' ? value.trim() : '');

export const buildCreateDocketPayload = (formData = {}) => {
  const workType = formData.workType === 'internal' ? 'internal' : 'client';
  const title = ensureCanonicalId(formData.title);
  const categoryId = ensureCanonicalId(formData.categoryId);
  const subcategoryId = ensureCanonicalId(formData.subcategoryId);
  const clientId = ensureCanonicalId(formData.clientId);
  const workbasketId = ensureCanonicalId(formData.workbasketId);
  const assignedTo = ensureCanonicalId(formData.assignedTo).toUpperCase();
  const description = typeof formData.description === 'string' ? formData.description.trim() : '';
  const priority = ensureCanonicalId(formData.priority || 'medium').toLowerCase();
  const idempotencyKey = ensureCanonicalId(formData.idempotencyKey);
  const employeeXID = ensureCanonicalId(formData.employeeXID).toUpperCase();
  const dueDate = ensureCanonicalId(formData.dueDate);
  const eventDate = ensureCanonicalId(formData.eventDate);
  const relatedEmployeeUserId = ensureCanonicalId(formData.relatedEmployeeUserId);

  const checklist = Array.isArray(formData.checklist) && formData.checklist.length > 0
    ? formData.checklist.map((item, index) => ({
        id: item?.id ? String(item.id).trim() : `chk-${index + 1}`,
        title: String(item?.title || '').trim(),
        description: typeof item?.description === 'string' ? item.description.trim() : '',
        required: item?.required !== false,
        sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : index,
        dueOffsetDays: Number.isFinite(Number(item?.dueOffsetDays)) ? Number(item.dueOffsetDays) : undefined,
      })).filter((item) => item.title.length > 0)
    : undefined;

  return {
    title,
    description,
    categoryId: categoryId || undefined,
    subcategoryId: subcategoryId || undefined,
    clientId: workType === 'internal' ? undefined : (clientId || undefined),
    isInternal: workType === 'internal',
    workType,
    workbasketId: workbasketId || undefined,
    priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium',
    assignedTo: assignedTo || undefined,
    employeeXID: employeeXID || undefined,
    idempotencyKey: idempotencyKey || undefined,
    dueDate: dueDate || undefined,
    eventDate: eventDate || undefined,
    relatedEmployeeUserId: relatedEmployeeUserId || undefined,
    checklist: (checklist && checklist.length > 0) ? checklist : undefined,
  };
};

export const validateCreateDocketPayload = (payload = {}, { categories = [], subcategories = [] } = {}) => {
  const errors = {};
  if (!payload.title) errors.title = 'Enter a title to continue.';
  if (!payload.categoryId) errors.categoryId = 'Select a category to continue.';
  if (!payload.subcategoryId) errors.subcategoryId = 'Select a subcategory to continue.';
  if (!payload.workbasketId) errors.workbasketId = 'Workbasket mapping is required before submit.';
  if (!payload.isInternal && !payload.clientId) errors.clientId = 'Select a client for client work.';

  if (payload.categoryId && categories.length) {
    const selectedCategory = categories.find((item) => item._id === payload.categoryId);
    if (!selectedCategory) errors.categoryId = 'Selected category is no longer available.';
  }
  if (payload.subcategoryId && subcategories.length) {
    const selectedSubcategory = subcategories.find((item) => item.id === payload.subcategoryId);
    if (!selectedSubcategory) errors.subcategoryId = 'Selected subcategory is not valid for this category.';
  }
  return errors;
};

export const resolveEarliestErrorStep = (errors = {}, fieldToStepMap = {}) => {
  const mappedSteps = Object.keys(errors)
    .map((fieldName) => fieldToStepMap[fieldName])
    .filter((stepIndex) => Number.isInteger(stepIndex));

  if (mappedSteps.length === 0) {
    return null;
  }

  return Math.min(...mappedSteps);
};
