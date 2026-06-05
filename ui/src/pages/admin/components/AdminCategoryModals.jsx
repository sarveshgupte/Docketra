import { Modal } from '../../../components/common/Modal';
import { Input } from '../../../components/common/Input';
import { Select } from '../../../components/common/Select';
import { Textarea } from '../../../components/common/Textarea';
import { Button } from '../../../components/common/Button';

export const AdminCategoryModals = ({
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
  workbaskets,
}) => {
  const selectableWorkbaskets = (Array.isArray(workbaskets) ? workbaskets : []).filter(
    (workbasket) => workbasket && workbasket.isActive !== false && workbasket.type === 'PRIMARY'
  );

  const createEmptyKnowledgeLink = () => ({
    draftKey: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: '',
    url: '',
    description: '',
    type: 'reference',
  });

  const ensureKnowledgeLinks = (links = []) => (
    Array.isArray(links) && links.length > 0 ? links : [createEmptyKnowledgeLink()]
  );

  const addKnowledgeLink = (form, setForm) => {
    setForm((prev) => ({
      ...prev,
      sopLinks: [...ensureKnowledgeLinks(prev?.sopLinks), createEmptyKnowledgeLink()],
    }));
  };

  const updateKnowledgeLink = (setForm, draftKey, field, value) => {
    setForm((prev) => ({
      ...prev,
      sopLinks: ensureKnowledgeLinks(prev?.sopLinks).map((link) => (
        link.draftKey === draftKey ? { ...link, [field]: value } : link
      )),
    }));
  };

  const removeKnowledgeLink = (form, setForm, draftKey) => {
    const remaining = ensureKnowledgeLinks(form?.sopLinks).filter((link) => link.draftKey !== draftKey);
    setForm((prev) => ({
      ...prev,
      sopLinks: remaining.length > 0 ? remaining : [createEmptyKnowledgeLink()],
    }));
  };

  return (
  <>
    <Modal
      isOpen={showCategoryModal}
      onClose={() => {
        setShowCategoryModal(false);
        setCategoryForm({ name: '', defaultSlaDays: '', requiresRelatedEmployeeUser: false });
      }}
      title="Create New Category"
    >
      <form onSubmit={onCreateCategory} className="admin__create-form">
        <Input
          label="Category Name"
          name="name"
          value={categoryForm.name}
          onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
          placeholder="Enter category name"
          required
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
        <label className="admin__checkbox-field">
          <input
            type="checkbox"
            checked={categoryForm.requiresRelatedEmployeeUser === true}
            onChange={(e) => setCategoryForm({ ...categoryForm, requiresRelatedEmployeeUser: e.target.checked })}
          />
          <span>
            <strong>Require related employee/user during docket creation</strong>
            <br />
            Enable this for HR, payroll, onboarding, offboarding, reimbursement, or employee-specific work.
          </span>
        </label>

        <div className="admin__modal-actions">
          <Button
            type="button"
            variant="default"
            onClick={() => {
              setShowCategoryModal(false);
              setCategoryForm({ name: '', defaultSlaDays: '', requiresRelatedEmployeeUser: false });
            }}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Creating...' : 'Create Category'}</Button>
        </div>
      </form>
    </Modal>
    <Modal
      isOpen={showEditCategoryModal}
      onClose={() => {
        setShowEditCategoryModal(false);
        setEditCategoryForm({ id: '', name: '', defaultSlaDays: '', requiresRelatedEmployeeUser: false });
      }}
      title="Edit Category"
    >
      <form onSubmit={onUpdateCategory} className="admin__create-form">
        <Input label="Category Name" name="name" value={editCategoryForm.name} onChange={(e) => setEditCategoryForm({ ...editCategoryForm, name: e.target.value })} required />
        <Input label="Default SLA working days" name="defaultSlaDays" type="number" min="0" value={editCategoryForm.defaultSlaDays || ''} onChange={(e) => setEditCategoryForm({ ...editCategoryForm, defaultSlaDays: e.target.value })} helpText="Counts only the firm's configured working days." />
        <label className="admin__checkbox-field">
          <input type="checkbox" checked={editCategoryForm.requiresRelatedEmployeeUser === true} onChange={(e) => setEditCategoryForm({ ...editCategoryForm, requiresRelatedEmployeeUser: e.target.checked })} />
          <span><strong>Require related employee/user during docket creation</strong><br />Enable this for HR, payroll, onboarding, offboarding, reimbursement, or employee-specific work.</span>
        </label>
        <div className="admin__modal-actions">
          <Button type="button" variant="default" onClick={() => { setShowEditCategoryModal(false); setEditCategoryForm({ id: '', name: '', defaultSlaDays: '', requiresRelatedEmployeeUser: false }); }}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Category'}</Button>
        </div>
      </form>
    </Modal>

    <Modal
      isOpen={showSubcategoryModal}
      onClose={() => {
        setShowSubcategoryModal(false);
        setSubcategoryForm({
          name: '',
          workbasketId: '',
          defaultSlaDays: '',
          requiresRelatedEmployeeUser: false,
          sopTitle: '',
          sopBody: '',
          sopLinks: [createEmptyKnowledgeLink()],
        });
        setSelectedCategory(null);
      }}
      title={`Add Subcategory to ${selectedCategory?.name || ''}`}
    >
      <form onSubmit={onAddSubcategory} className="admin__create-form">
        <Input
          label="Subcategory Name"
          name="name"
          value={subcategoryForm.name}
          onChange={(e) => setSubcategoryForm({ ...subcategoryForm, name: e.target.value })}
          placeholder="Enter subcategory name"
          required
        />
        <Select
          label="Workbasket"
          value={subcategoryForm.workbasketId}
          onChange={(e) => setSubcategoryForm({ ...subcategoryForm, workbasketId: e.target.value })}
          options={[
            { value: '', label: 'Select workbasket', disabled: true },
            ...selectableWorkbaskets.map((workbasket) => ({ value: String(workbasket._id), label: workbasket.name })),
          ]}
          required
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
        <label className="admin__checkbox-field">
          <input
            type="checkbox"
            checked={subcategoryForm.requiresRelatedEmployeeUser === true}
            onChange={(e) => setSubcategoryForm({ ...subcategoryForm, requiresRelatedEmployeeUser: e.target.checked })}
          />
          <span>
            <strong>Require related employee/user during docket creation</strong>
            <br />
            Enable this for HR, payroll, onboarding, offboarding, reimbursement, or employee-specific work.
          </span>
        </label>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
          <div>
            <p className="text-sm font-bold text-slate-800">Linked Knowledge</p>
            <p className="text-xs text-slate-500 mt-1">
              This appears inside docket `Linked Knowledge` and is managed only from category settings.
            </p>
          </div>
          <Input
            label="Knowledge title"
            name="sopTitle"
            value={subcategoryForm.sopTitle || ''}
            onChange={(e) => setSubcategoryForm({ ...subcategoryForm, sopTitle: e.target.value })}
            placeholder="Example: OPC monthly filing instructions"
          />
          <Textarea
            label="Knowledge notes / instructions"
            name="sopBody"
            rows={6}
            value={subcategoryForm.sopBody || ''}
            onChange={(e) => setSubcategoryForm({ ...subcategoryForm, sopBody: e.target.value })}
            placeholder="Add the read-only text your team should see while executing this docket."
            helpText="Use this for instructions, process notes, caveats, and reusable execution guidance."
          />
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">Reference links / files</p>
                <p className="text-xs text-slate-500">Paste URLs to drive files, folders, portals, or internal references.</p>
              </div>
              <Button type="button" variant="outline" onClick={() => addKnowledgeLink(subcategoryForm, setSubcategoryForm)}>
                Add Link
              </Button>
            </div>
            {ensureKnowledgeLinks(subcategoryForm.sopLinks).map((link) => (
              <div key={link.draftKey} className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    label="Link title"
                    value={link.title}
                    onChange={(e) => updateKnowledgeLink(setSubcategoryForm, link.draftKey, 'title', e.target.value)}
                    placeholder="Example: MCA filing checklist"
                  />
                  <Input
                    label="URL"
                    value={link.url}
                    onChange={(e) => updateKnowledgeLink(setSubcategoryForm, link.draftKey, 'url', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Select
                    label="Link type"
                    value={link.type}
                    onChange={(e) => updateKnowledgeLink(setSubcategoryForm, link.draftKey, 'type', e.target.value)}
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
                    onChange={(e) => updateKnowledgeLink(setSubcategoryForm, link.draftKey, 'description', e.target.value)}
                    placeholder="Optional context for the team"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="button" variant="ghost" onClick={() => removeKnowledgeLink(subcategoryForm, setSubcategoryForm, link.draftKey)}>
                    Remove Link
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="admin__modal-actions">
          <Button
            type="button"
            variant="default"
            onClick={() => {
              setShowSubcategoryModal(false);
              setSubcategoryForm({
                name: '',
                workbasketId: '',
                defaultSlaDays: '',
                requiresRelatedEmployeeUser: false,
                sopTitle: '',
                sopBody: '',
                sopLinks: [createEmptyKnowledgeLink()],
              });
              setSelectedCategory(null);
            }}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Adding...' : 'Add Subcategory'}</Button>
        </div>
      </form>
    </Modal>
    <Modal
      isOpen={showEditSubcategoryModal}
      onClose={() => {
        setShowEditSubcategoryModal(false);
        setEditSubcategoryForm({
          categoryId: '',
          subcategoryId: '',
          name: '',
          workbasketId: '',
          defaultSlaDays: '',
          requiresRelatedEmployeeUser: false,
          sopTitle: '',
          sopBody: '',
          sopLinks: [createEmptyKnowledgeLink()],
        });
      }}
      title="Edit Subcategory"
    >
      <form onSubmit={onUpdateSubcategory} className="admin__create-form">
        <Input label="Subcategory Name" name="name" value={editSubcategoryForm.name} onChange={(e) => setEditSubcategoryForm({ ...editSubcategoryForm, name: e.target.value })} required />
        <Select
          label="Workbasket"
          value={editSubcategoryForm.workbasketId}
          onChange={(e) => setEditSubcategoryForm({ ...editSubcategoryForm, workbasketId: e.target.value })}
          options={[{ value: '', label: 'Select workbasket', disabled: true }, ...selectableWorkbaskets.map((w) => ({ value: String(w._id), label: w.name }))]}
          required
        />
        <Input label="SLA working days" name="defaultSlaDays" type="number" min="0" value={editSubcategoryForm.defaultSlaDays || ''} onChange={(e) => setEditSubcategoryForm({ ...editSubcategoryForm, defaultSlaDays: e.target.value })} helpText="This is the default SLA for dockets in this subcategory." />
        <label className="admin__checkbox-field">
          <input type="checkbox" checked={editSubcategoryForm.requiresRelatedEmployeeUser === true} onChange={(e) => setEditSubcategoryForm({ ...editSubcategoryForm, requiresRelatedEmployeeUser: e.target.checked })} />
          <span><strong>Require related employee/user during docket creation</strong><br />Enable this for HR, payroll, onboarding, offboarding, reimbursement, or employee-specific work.</span>
        </label>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
          <div>
            <p className="text-sm font-bold text-slate-800">Linked Knowledge</p>
            <p className="text-xs text-slate-500 mt-1">
              This content is shown inside the docket `Linked Knowledge` tab and stays read-only during execution.
            </p>
          </div>
          <Input
            label="Knowledge title"
            name="editSopTitle"
            value={editSubcategoryForm.sopTitle || ''}
            onChange={(e) => setEditSubcategoryForm({ ...editSubcategoryForm, sopTitle: e.target.value })}
            placeholder="Example: OPC monthly filing instructions"
          />
          <Textarea
            label="Knowledge notes / instructions"
            name="editSopBody"
            rows={6}
            value={editSubcategoryForm.sopBody || ''}
            onChange={(e) => setEditSubcategoryForm({ ...editSubcategoryForm, sopBody: e.target.value })}
            placeholder="Add the read-only text your team should see while executing this docket."
            helpText="Use this for instructions, process notes, caveats, and reusable execution guidance."
          />
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">Reference links / files</p>
                <p className="text-xs text-slate-500">Paste URLs to drive files, folders, portals, or internal references.</p>
              </div>
              <Button type="button" variant="outline" onClick={() => addKnowledgeLink(editSubcategoryForm, setEditSubcategoryForm)}>
                Add Link
              </Button>
            </div>
            {ensureKnowledgeLinks(editSubcategoryForm.sopLinks).map((link) => (
              <div key={link.draftKey} className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    label="Link title"
                    value={link.title}
                    onChange={(e) => updateKnowledgeLink(setEditSubcategoryForm, link.draftKey, 'title', e.target.value)}
                    placeholder="Example: MCA filing checklist"
                  />
                  <Input
                    label="URL"
                    value={link.url}
                    onChange={(e) => updateKnowledgeLink(setEditSubcategoryForm, link.draftKey, 'url', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Select
                    label="Link type"
                    value={link.type}
                    onChange={(e) => updateKnowledgeLink(setEditSubcategoryForm, link.draftKey, 'type', e.target.value)}
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
                    onChange={(e) => updateKnowledgeLink(setEditSubcategoryForm, link.draftKey, 'description', e.target.value)}
                    placeholder="Optional context for the team"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="button" variant="ghost" onClick={() => removeKnowledgeLink(editSubcategoryForm, setEditSubcategoryForm, link.draftKey)}>
                    Remove Link
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="admin__modal-actions">
          <Button
            type="button"
            variant="default"
            onClick={() => {
              setShowEditSubcategoryModal(false);
              setEditSubcategoryForm({
                categoryId: '',
                subcategoryId: '',
                name: '',
                workbasketId: '',
                defaultSlaDays: '',
                requiresRelatedEmployeeUser: false,
                sopTitle: '',
                sopBody: '',
                sopLinks: [createEmptyKnowledgeLink()],
              });
            }}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Subcategory'}</Button>
        </div>
      </form>
    </Modal>
  </>
  );
};
