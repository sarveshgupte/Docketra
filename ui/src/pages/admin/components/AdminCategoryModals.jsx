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
}) => (
  <>
    <Modal
      isOpen={showCategoryModal}
      onClose={() => {
        setShowCategoryModal(false);
        setCategoryForm({ name: '' });
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

        <div className="admin__modal-actions">
          <Button
            type="button"
            variant="default"
            onClick={() => {
              setShowCategoryModal(false);
              setCategoryForm({ name: '' });
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
        setSubcategoryForm({ name: '', workbasketId: '' });
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
            ...workbaskets.map((workbasket) => ({ value: String(workbasket._id), label: workbasket.name })),
          ]}
          required
        />

        <div className="admin__modal-actions">
          <Button
            type="button"
            variant="default"
            onClick={() => {
              setShowSubcategoryModal(false);
              setSubcategoryForm({ name: '', workbasketId: '' });
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
