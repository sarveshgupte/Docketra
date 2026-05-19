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
        setCategoryForm({ name: '', requiresRelatedEmployeeUser: false });
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
        <label className="flex items-start gap-2 text-sm text-gray-700">
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
              setCategoryForm({ name: '', requiresRelatedEmployeeUser: false });
            }}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Creating...' : 'Create Category'}</Button>
        </div>
      </form>
    </Modal>

    <Modal
      isOpen={showSubcategoryModal}
      onClose={() => {
        setShowSubcategoryModal(false);
        setSubcategoryForm({ name: '', workbasketId: '', requiresRelatedEmployeeUser: false });
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
        <label className="flex items-start gap-2 text-sm text-gray-700">
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
              setSubcategoryForm({ name: '', workbasketId: '', requiresRelatedEmployeeUser: false });
              setSelectedCategory(null);
            }}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Adding...' : 'Add Subcategory'}</Button>
        </div>
      </form>
    </Modal>
  </>
  );
};
