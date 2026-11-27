import { useEffect, useMemo } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Input } from '../../../components/common/Input';
import { Select } from '../../../components/common/Select';
import { Textarea } from '../../../components/common/Textarea';
import { Button } from '../../../components/common/Button';
import { generateSecureRandomString } from '../../../utils/crypto';

const createEmptyKnowledgeLink = () => ({
  draftKey: `${Date.now()}-${generateSecureRandomString(6)}`,
  title: '',
  url: '',
  description: '',
  type: 'reference',
});

const ensureKnowledgeLinks = (links = []) => (
  Array.isArray(links) && links.length > 0 ? links : [createEmptyKnowledgeLink()]
);

const createDefaultCategoryForm = () => ({
  name: '',
  workbasketId: '',
  defaultSlaDays: '',
  qcPercent: '',
  requiresRelatedEmployeeUser: false,
});

const createDefaultSubcategoryForm = () => ({
  name: '',
  workbasketId: '',
  defaultSlaDays: '',
  qcPercent: '',
  requiresRelatedEmployeeUser: false,
  sopTitle: '',
  sopBody: '',
  sopLinks: [createEmptyKnowledgeLink()],
  sopFiles: [],
});

const WorkbasketLinkField = ({
  value,
  onChange,
  selectableWorkbaskets,
  workbaskets,
  qcWorkbasketByPrimaryId,
  label = 'Workbasket',
}) => {
  const currentAssignedWorkbasket = value
    ? (Array.isArray(workbaskets) ? workbaskets : []).find((w) => String(w._id) === String(value))
    : null;
  const isCurrentWorkbasketInactive = Boolean(
    currentAssignedWorkbasket
      && !selectableWorkbaskets.some((w) => String(w._id) === String(currentAssignedWorkbasket._id))
  );
  const linkedQcWorkbasket = value ? qcWorkbasketByPrimaryId?.get(String(value)) || null : null;

  return (
    <div className="space-y-2">
      <Select
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        options={[
          {
            value: '',
            label: selectableWorkbaskets.length === 0
              ? 'No active primary workbaskets available'
              : 'Select workbasket',
            disabled: true,
          },
          ...(isCurrentWorkbasketInactive ? [{
            value: String(currentAssignedWorkbasket._id),
            label: `${currentAssignedWorkbasket.name} (Inactive - reassign recommended)`,
          }] : []),
          ...selectableWorkbaskets.map((workbasket) => ({ value: String(workbasket._id), label: workbasket.name })),
        ]}
        required
      />
      {selectableWorkbaskets.length === 0 && (
        <p className="text-xs text-amber-600">
          No active primary workbaskets found. Please create one in Work Settings first.
        </p>
      )}
      {value ? (
        linkedQcWorkbasket ? (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs text-indigo-900">
            <span className="font-semibold">Linked QC Workbasket:</span> {linkedQcWorkbasket.name}
          </div>
        ) : (
          <p className="text-xs text-amber-700">
            Selected workbasket does not have an active linked QC workbasket. Enable or repair its QC workbasket in Work Settings before saving.
          </p>
        )
      ) : (
        <p className="text-xs text-slate-500">
          Linking a primary workbasket automatically pairs its QC workbasket.
        </p>
      )}
    </div>
  );
};

const SubcategoryKnowledgeSection = ({
  form,
  setForm,
  mode,
  knowledgeFileUploading,
  onUploadKnowledgeFile,
  onDeleteKnowledgeFile,
}) => {
  const isEdit = mode === 'edit';

  const addKnowledgeLink = () => {
    setForm((prev) => ({
      ...prev,
      sopLinks: [...ensureKnowledgeLinks(prev?.sopLinks), createEmptyKnowledgeLink()],
    }));
  };

  const updateKnowledgeLink = (draftKey, field, value) => {
    setForm((prev) => ({
      ...prev,
      sopLinks: ensureKnowledgeLinks(prev?.sopLinks).map((link) => (
        link.draftKey === draftKey ? { ...link, [field]: value } : link
      )),
    }));
  };

  const removeKnowledgeLink = (draftKey) => {
    const remaining = ensureKnowledgeLinks(form?.sopLinks).filter((link) => link.draftKey !== draftKey);
    setForm((prev) => ({
      ...prev,
      sopLinks: remaining.length > 0 ? remaining : [createEmptyKnowledgeLink()],
    }));
  };

  const handleKnowledgeFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await onUploadKnowledgeFile?.(file);
    event.target.value = '';
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
      <div>
        <p className="text-sm font-bold text-slate-800">Linked Knowledge</p>
        <p className="text-xs text-slate-500 mt-1">
          {isEdit
            ? 'This content is shown inside the docket `Linked Knowledge` tab and stays read-only during execution.'
            : 'This appears inside docket `Linked Knowledge` and is managed only from category settings.'}
        </p>
      </div>
      <Input
        label="Knowledge title"
        name={isEdit ? 'editSopTitle' : 'sopTitle'}
        value={form.sopTitle || ''}
        onChange={(e) => setForm({ ...form, sopTitle: e.target.value })}
        placeholder="Example: OPC monthly filing instructions"
      />
      <Textarea
        label="Knowledge notes / instructions"
        name={isEdit ? 'editSopBody' : 'sopBody'}
        rows={6}
        value={form.sopBody || ''}
        onChange={(e) => setForm({ ...form, sopBody: e.target.value })}
        placeholder="Add the read-only text your team should see while executing this docket."
        helpText="Use this for instructions, process notes, caveats, and reusable execution guidance."
      />
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-700">Reference links / files</p>
            <p className="text-xs text-slate-500">Paste URLs to drive files, folders, portals, or internal references.</p>
          </div>
          <Button type="button" variant="outline" onClick={addKnowledgeLink}>
            Add Link
          </Button>
        </div>
        {ensureKnowledgeLinks(form.sopLinks).map((link) => (
          <div key={link.draftKey} className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Link title"
                value={link.title}
                onChange={(e) => updateKnowledgeLink(link.draftKey, 'title', e.target.value)}
                placeholder="Example: MCA filing checklist"
              />
              <Input
                label="URL"
                value={link.url}
                onChange={(e) => updateKnowledgeLink(link.draftKey, 'url', e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select
                label="Link type"
                value={link.type}
                onChange={(e) => updateKnowledgeLink(link.draftKey, 'type', e.target.value)}
                options={[
                  { value: 'reference', label: 'Reference' },
                  { value: 'portal', label: 'Portal' },
                  { value: 'template', label: 'Template' },
                  { value: 'internal', label: 'Internal' },
                  { value: 'other', label: 'Other' },
                ]}
              />
              <Input
                label="Description"
                value={link.description}
                onChange={(e) => updateKnowledgeLink(link.draftKey, 'description', e.target.value)}
                placeholder="Optional context for the team"
              />
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="ghost" onClick={() => removeKnowledgeLink(link.draftKey)}>
                Remove Link
              </Button>
            </div>
          </div>
        ))}
        {isEdit ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">Uploaded files</p>
                <p className="text-xs text-slate-500">Add PDFs, docs, sheets, or other files that should appear in Linked Knowledge.</p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.txt,.csv,.zip,application/pdf,image/*,text/plain,text/csv"
                  onChange={handleKnowledgeFileChange}
                  disabled={knowledgeFileUploading}
                />
                {knowledgeFileUploading ? 'Uploading...' : 'Upload File'}
              </label>
            </div>
            {Array.isArray(form.sopFiles) && form.sopFiles.length > 0 ? (
              <ul className="space-y-2">
                {form.sopFiles.map((file, index) => {
                  const href = file?.downloadUrl || file?.webViewLink || '';
                  return (
                    <li key={file?.id || `${file?.fileName || 'knowledge-file'}-${index}`} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {href ? (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-700 underline break-all">
                              {file?.fileName || 'Knowledge file'}
                            </a>
                          ) : (
                            <span className="text-sm font-semibold text-slate-800 break-all">{file?.fileName || 'Knowledge file'}</span>
                          )}
                          <span className="rounded-xs bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 border border-slate-200/60">File</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                          {file?.mimeType ? <span>{file.mimeType}</span> : null}
                          {Number.isFinite(Number(file?.size)) ? <span>{Math.round(Number(file.size) / 1024)} KB</span> : null}
                          {file?.uploadedByXID ? <span>Uploaded by {file.uploadedByXID}</span> : null}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onDeleteKnowledgeFile?.(file?.id)}
                        disabled={knowledgeFileUploading}
                      >
                        Remove
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">No files uploaded yet.</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Save this subcategory first, then upload actual files from the edit form.
          </p>
        )}
      </div>
    </div>
  );
};

export const AdminCategoryModals = ({
  categories = [],
  showCategoryModal,
  setShowCategoryModal,
  categoryForm,
  setCategoryForm,
  onCreateCategory,
  submitting,
  showSubcategoryModal,
  setShowSubcategoryModal,
  selectedCategory,
  setSelectedCategory,
  subcategoryForm,
  setSubcategoryForm,
  onAddSubcategory,
  showEditCategoryModal,
  setShowEditCategoryModal,
  editCategoryForm,
  setEditCategoryForm,
  onUpdateCategory,
  showEditSubcategoryModal,
  setShowEditSubcategoryModal,
  editSubcategoryForm,
  setEditSubcategoryForm,
  onUpdateSubcategory,
  knowledgeFileUploading,
  onUploadKnowledgeFile,
  onDeleteKnowledgeFile,
  workbaskets,
  qcWorkbasketByPrimaryId: qcWorkbasketMapProp,
}) => {
  const selectableWorkbaskets = useMemo(() => (
    (Array.isArray(workbaskets) ? workbaskets : []).filter(
      (workbasket) => workbasket && workbasket.isActive !== false && (workbasket.type === 'PRIMARY' || !workbasket.type)
    )
  ), [workbaskets]);

  const qcWorkbasketByPrimaryId = useMemo(() => {
    if (qcWorkbasketMapProp instanceof Map) return qcWorkbasketMapProp;
    return new Map(
      (Array.isArray(workbaskets) ? workbaskets : [])
        .filter((wb) => wb && wb.isActive !== false && String(wb.type || '').toUpperCase() === 'QC' && wb.parentWorkbasketId)
        .map((wb) => [String(wb.parentWorkbasketId), wb])
    );
  }, [qcWorkbasketMapProp, workbaskets]);

  const addSubcategoryParentRequiresEmployee = selectedCategory?.requiresRelatedEmployeeUser === true;
  const editSubcategoryParent = (categories || []).find((c) => String(c._id || c.id) === String(editSubcategoryForm.categoryId));
  const editSubcategoryParentRequiresEmployee = editSubcategoryParent?.requiresRelatedEmployeeUser === true;

  useEffect(() => {
    if (showCategoryModal && selectableWorkbaskets.length === 1 && !categoryForm.workbasketId) {
      setCategoryForm((prev) => ({ ...prev, workbasketId: String(selectableWorkbaskets[0]._id) }));
    }
  }, [showCategoryModal, selectableWorkbaskets, categoryForm.workbasketId, setCategoryForm]);

  useEffect(() => {
    if (showEditCategoryModal && selectableWorkbaskets.length === 1 && !editCategoryForm.workbasketId) {
      setEditCategoryForm((prev) => ({ ...prev, workbasketId: String(selectableWorkbaskets[0]._id) }));
    }
  }, [showEditCategoryModal, selectableWorkbaskets, editCategoryForm.workbasketId, setEditCategoryForm]);

  useEffect(() => {
    if (showSubcategoryModal && selectableWorkbaskets.length === 1 && !subcategoryForm.workbasketId) {
      setSubcategoryForm((prev) => ({ ...prev, workbasketId: String(selectableWorkbaskets[0]._id) }));
    }
  }, [showSubcategoryModal, selectableWorkbaskets, subcategoryForm.workbasketId, setSubcategoryForm]);

  useEffect(() => {
    if (showEditSubcategoryModal && selectableWorkbaskets.length === 1 && !editSubcategoryForm.workbasketId) {
      setEditSubcategoryForm((prev) => ({ ...prev, workbasketId: String(selectableWorkbaskets[0]._id) }));
    }
  }, [showEditSubcategoryModal, selectableWorkbaskets, editSubcategoryForm.workbasketId, setEditSubcategoryForm]);

  const closeCreateCategoryModal = () => {
    setShowCategoryModal(false);
    setCategoryForm(createDefaultCategoryForm());
  };

  const closeEditCategoryModal = () => {
    setShowEditCategoryModal(false);
    setEditCategoryForm({ id: '', ...createDefaultCategoryForm() });
  };

  const closeAddSubcategoryModal = () => {
    setShowSubcategoryModal(false);
    setSubcategoryForm(createDefaultSubcategoryForm());
    setSelectedCategory(null);
  };

  const closeEditSubcategoryModal = () => {
    setShowEditSubcategoryModal(false);
    setEditSubcategoryForm({ categoryId: '', subcategoryId: '', ...createDefaultSubcategoryForm() });
  };

  return (
  <>
    <Modal isOpen={showCategoryModal} onClose={closeCreateCategoryModal} title="Create New Category">
      <form onSubmit={onCreateCategory} className="admin__create-form">
        <Input
          label="Category Name"
          name="name"
          value={categoryForm.name}
          onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
          placeholder="Enter category name"
          required
        />
        <WorkbasketLinkField
          value={categoryForm.workbasketId || ''}
          onChange={(workbasketId) => setCategoryForm({ ...categoryForm, workbasketId })}
          selectableWorkbaskets={selectableWorkbaskets}
          workbaskets={workbaskets}
          qcWorkbasketByPrimaryId={qcWorkbasketByPrimaryId}
        />
        <Input
          label="Default SLA working days"
          name="defaultSlaDays"
          type="number"
          min="0"
          value={categoryForm.defaultSlaDays || ''}
          onChange={(e) => setCategoryForm({ ...categoryForm, defaultSlaDays: e.target.value })}
          placeholder="e.g. 3"
          helpText="Counts only the firm's configured working days."
        />
        <Input
          label="QC review percentage"
          name="qcPercent"
          type="number"
          min="0"
          max="100"
          value={categoryForm.qcPercent || ''}
          onChange={(e) => setCategoryForm({ ...categoryForm, qcPercent: e.target.value })}
          placeholder="e.g. 10"
          helpText="Percentage of resolved dockets sent to QC when subcategory QC is not set."
        />
        <label className="admin__checkbox-field">
          <input
            type="checkbox"
            checked={categoryForm.requiresRelatedEmployeeUser === true}
            onChange={(e) => setCategoryForm({ ...categoryForm, requiresRelatedEmployeeUser: e.target.checked })}
          />
          <span>
            <strong>Require related employee during docket creation</strong>
            <span className="sr-only">Require related employee/user during docket creation</span>
            <br />
            Enable this for HR, payroll, onboarding, offboarding, reimbursement, or employee-specific work.
          </span>
        </label>

        <div className="admin__modal-actions">
          <Button type="button" variant="default" onClick={closeCreateCategoryModal}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Creating...' : 'Create Category'}</Button>
        </div>
      </form>
    </Modal>

    <Modal isOpen={showEditCategoryModal} onClose={closeEditCategoryModal} title="Edit Category">
      <form onSubmit={onUpdateCategory} className="admin__create-form">
        <Input label="Category Name" name="name" value={editCategoryForm.name} onChange={(e) => setEditCategoryForm({ ...editCategoryForm, name: e.target.value })} required />
        <WorkbasketLinkField
          value={editCategoryForm.workbasketId || ''}
          onChange={(workbasketId) => setEditCategoryForm({ ...editCategoryForm, workbasketId })}
          selectableWorkbaskets={selectableWorkbaskets}
          workbaskets={workbaskets}
          qcWorkbasketByPrimaryId={qcWorkbasketByPrimaryId}
        />
        <Input label="Default SLA working days" name="defaultSlaDays" type="number" min="0" value={editCategoryForm.defaultSlaDays || ''} onChange={(e) => setEditCategoryForm({ ...editCategoryForm, defaultSlaDays: e.target.value })} helpText="Counts only the firm's configured working days." />
        <Input label="QC review percentage" name="qcPercent" type="number" min="0" max="100" value={editCategoryForm.qcPercent || ''} onChange={(e) => setEditCategoryForm({ ...editCategoryForm, qcPercent: e.target.value })} helpText="Percentage of resolved dockets sent to QC when subcategory QC is not set." />
        <label className="admin__checkbox-field">
          <input type="checkbox" checked={editCategoryForm.requiresRelatedEmployeeUser === true} onChange={(e) => setEditCategoryForm({ ...editCategoryForm, requiresRelatedEmployeeUser: e.target.checked })} />
          <span>
            <strong>Require related employee during docket creation</strong>
            <span className="sr-only">Require related employee/user during docket creation</span>
            <br />
            Enable this for HR, payroll, onboarding, offboarding, reimbursement, or employee-specific work.
          </span>
        </label>
        <div className="admin__modal-actions">
          <Button type="button" variant="default" onClick={closeEditCategoryModal}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Category'}</Button>
        </div>
      </form>
    </Modal>

    <Modal isOpen={showSubcategoryModal} onClose={closeAddSubcategoryModal} title={`Add Subcategory to ${selectedCategory?.name || ''}`}>
      <form onSubmit={onAddSubcategory} className="admin__create-form">
        <Input
          label="Subcategory Name"
          name="name"
          value={subcategoryForm.name}
          onChange={(e) => setSubcategoryForm({ ...subcategoryForm, name: e.target.value })}
          placeholder="Enter subcategory name"
          required
        />
        <WorkbasketLinkField
          value={subcategoryForm.workbasketId || ''}
          onChange={(workbasketId) => setSubcategoryForm({ ...subcategoryForm, workbasketId })}
          selectableWorkbaskets={selectableWorkbaskets}
          workbaskets={workbaskets}
          qcWorkbasketByPrimaryId={qcWorkbasketByPrimaryId}
        />
        <Input
          label="SLA working days"
          name="defaultSlaDays"
          type="number"
          min="0"
          value={subcategoryForm.defaultSlaDays || ''}
          onChange={(e) => setSubcategoryForm({ ...subcategoryForm, defaultSlaDays: e.target.value })}
          placeholder="e.g. 2"
          helpText="This is the default SLA for dockets in this subcategory."
        />
        <Input
          label="QC review percentage"
          name="qcPercent"
          type="number"
          min="0"
          max="100"
          value={subcategoryForm.qcPercent || ''}
          onChange={(e) => setSubcategoryForm({ ...subcategoryForm, qcPercent: e.target.value })}
          placeholder="e.g. 10"
          helpText="Set 100 to send every resolved docket in this subcategory to QC. Leave 0 to inherit category QC."
        />
        {addSubcategoryParentRequiresEmployee ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
            <p className="font-semibold">Enforced by category: &quot;{selectedCategory?.name}&quot;</p>
            <p>
              Dockets in this subcategory will require an employee because this rule is enabled on the category itself. To make it optional, turn this setting off on the parent category.
            </p>
          </div>
        ) : null}
        <label className="admin__checkbox-field">
          <input
            type="checkbox"
            checked={addSubcategoryParentRequiresEmployee || subcategoryForm.requiresRelatedEmployeeUser === true}
            disabled={addSubcategoryParentRequiresEmployee}
            onChange={(e) => setSubcategoryForm({ ...subcategoryForm, requiresRelatedEmployeeUser: e.target.checked })}
          />
          <span>
            <strong>Require related employee during docket creation</strong>
            <span className="sr-only">Require related employee/user during docket creation</span>
            <br />
            {addSubcategoryParentRequiresEmployee
              ? `Inherited from category "${selectedCategory?.name}".`
              : 'Enable this for HR, payroll, onboarding, offboarding, reimbursement, or employee-specific work.'}
          </span>
        </label>
        <SubcategoryKnowledgeSection form={subcategoryForm} setForm={setSubcategoryForm} mode="add" />
        <div className="admin__modal-actions">
          <Button type="button" variant="default" onClick={closeAddSubcategoryModal}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Adding...' : 'Add Subcategory'}</Button>
        </div>
      </form>
    </Modal>

    <Modal isOpen={showEditSubcategoryModal} onClose={closeEditSubcategoryModal} title="Edit Subcategory">
      <form onSubmit={onUpdateSubcategory} className="admin__create-form">
        <Input label="Subcategory Name" name="name" value={editSubcategoryForm.name} onChange={(e) => setEditSubcategoryForm({ ...editSubcategoryForm, name: e.target.value })} required />
        <WorkbasketLinkField
          value={editSubcategoryForm.workbasketId || ''}
          onChange={(workbasketId) => setEditSubcategoryForm({ ...editSubcategoryForm, workbasketId })}
          selectableWorkbaskets={selectableWorkbaskets}
          workbaskets={workbaskets}
          qcWorkbasketByPrimaryId={qcWorkbasketByPrimaryId}
        />
        <Input label="SLA working days" name="defaultSlaDays" type="number" min="0" value={editSubcategoryForm.defaultSlaDays || ''} onChange={(e) => setEditSubcategoryForm({ ...editSubcategoryForm, defaultSlaDays: e.target.value })} helpText="This is the default SLA for dockets in this subcategory." />
        <Input label="QC review percentage" name="qcPercent" type="number" min="0" max="100" value={editSubcategoryForm.qcPercent || ''} onChange={(e) => setEditSubcategoryForm({ ...editSubcategoryForm, qcPercent: e.target.value })} helpText="Set 100 to send every resolved docket in this subcategory to QC. Leave 0 to inherit category QC." />
        {editSubcategoryParentRequiresEmployee ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
            <p className="font-semibold">Enforced by category: &quot;{editSubcategoryParent?.name}&quot;</p>
            <p>
              Dockets in this subcategory will require an employee because this rule is enabled on the category itself. To make it optional, turn this setting off on the parent category.
            </p>
          </div>
        ) : null}
        <label className="admin__checkbox-field">
          <input
            type="checkbox"
            checked={editSubcategoryParentRequiresEmployee || editSubcategoryForm.requiresRelatedEmployeeUser === true}
            disabled={editSubcategoryParentRequiresEmployee}
            onChange={(e) => setEditSubcategoryForm({ ...editSubcategoryForm, requiresRelatedEmployeeUser: e.target.checked })}
          />
          <span>
            <strong>Require related employee during docket creation</strong>
            <span className="sr-only">Require related employee/user during docket creation</span>
            <br />
            {editSubcategoryParentRequiresEmployee
              ? `Inherited from category "${editSubcategoryParent?.name}".`
              : 'Enable this for HR, payroll, onboarding, offboarding, reimbursement, or employee-specific work.'}
          </span>
        </label>
        <SubcategoryKnowledgeSection
          form={editSubcategoryForm}
          setForm={setEditSubcategoryForm}
          mode="edit"
          knowledgeFileUploading={knowledgeFileUploading}
          onUploadKnowledgeFile={onUploadKnowledgeFile}
          onDeleteKnowledgeFile={onDeleteKnowledgeFile}
        />
        <div className="admin__modal-actions">
          <Button type="button" variant="default" onClick={closeEditSubcategoryModal}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Subcategory'}</Button>
        </div>
      </form>
    </Modal>
  </>
  );
};
