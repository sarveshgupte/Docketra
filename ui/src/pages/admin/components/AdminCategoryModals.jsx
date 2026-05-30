import { Modal } from '../../../components/common/Modal';
import { Input } from '../../../components/common/Input';
import { Select } from '../../../components/common/Select';
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
        setSubcategoryForm({ name: '', workbasketId: '', defaultSlaDays: '', requiresRelatedEmployeeUser: false });
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

        <div className="admin__modal-actions">
          <Button
            type="button"
            variant="default"
            onClick={() => {
              setShowSubcategoryModal(false);
              setSubcategoryForm({ name: '', workbasketId: '', defaultSlaDays: '', requiresRelatedEmployeeUser: false });
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
        setEditSubcategoryForm({ categoryId: '', subcategoryId: '', name: '', workbasketId: '', defaultSlaDays: '', requiresRelatedEmployeeUser: false });
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
        <div className="admin__modal-actions">
          <Button type="button" variant="default" onClick={() => { setShowEditSubcategoryModal(false); setEditSubcategoryForm({ categoryId: '', subcategoryId: '', name: '', workbasketId: '', defaultSlaDays: '', requiresRelatedEmployeeUser: false }); }}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Subcategory'}</Button>
        </div>
      </form>
    </Modal>
  </>
  );
};
