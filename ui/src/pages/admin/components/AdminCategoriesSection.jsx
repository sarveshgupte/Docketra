import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { DataTable } from '../../../components/common/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { AdminSectionHeader } from './AdminSectionHeader';

export const AdminCategoriesSection = ({
  categories,
  workbasketNameById,
  onBulkUpload,
  onDownloadTemplate,
  onCreateCategory,
  onAddSubcategory,
  onToggleCategoryStatus,
  onDeleteCategory,
  onToggleSubcategoryStatus,
  onDeleteSubcategory,
  StatusBadge,
}) => (
  <Card>
    <AdminSectionHeader
      title="Category Management"
      description="Maintain category and subcategory taxonomy used by dockets and workbaskets."
      actions={[
        { key: 'bulk-upload-categories', label: 'Bulk Upload', onClick: onBulkUpload },
        { key: 'download-categories-template', label: 'Download Template', onClick: onDownloadTemplate },
        { key: 'create-category', label: '+ Create Category', variant: 'primary', onClick: onCreateCategory },
      ]}
    />

    {categories.length === 0 ? (
      <EmptyState
        title="No categories created yet"
        description="Use categories to organize your cases."
      />
    ) : (
      <div className="categories-list">
        {categories.map((category) => (
          <Card key={category._id} className="category-card">
            <div className="category-header">
              <div>
                <h3>{category.name}</h3>
                <Badge status={category.isActive ? 'Approved' : 'Rejected'}>
                  {category.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="category-actions">
                <Button size="small" variant="default" onClick={() => onAddSubcategory(category)}>+ Add Subcategory</Button>
                <Button
                  size="small"
                  variant={category.isActive ? 'danger' : 'primary'}
                  onClick={() => onToggleCategoryStatus(category)}
                >
                  {category.isActive ? 'Disable' : 'Enable'}
                </Button>
                <Button size="small" variant="danger" onClick={() => onDeleteCategory(category)}>Delete</Button>
              </div>
            </div>

            {category.subcategories && category.subcategories.length > 0 && (
              <div className="subcategories-list">
                <h4>Subcategories:</h4>
                <DataTable
                  columns={[
                    { key: 'name', label: 'Subcategory', render: (sub) => <div className="font-medium text-gray-900">{sub.name}</div> },
                    {
                      key: 'workbasketId',
                      label: 'Workbasket',
                      render: (sub) => {
                        const linkedWorkbasketName = workbasketNameById.get(String(sub?.workbasketId || ''));
                        return linkedWorkbasketName || '—';
                      },
                    },
                    { key: 'status', label: 'Status', render: (sub) => <StatusBadge status={sub.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
                    {
                      key: 'actions',
                      label: 'Action',
                      align: 'right',
                      render: (sub) => (
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant={sub.isActive ? 'outline' : 'primary'}
                            onClick={() => onToggleSubcategoryStatus(category, sub)}
                          >
                            {sub.isActive ? 'Disable' : 'Enable'}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => onDeleteSubcategory(category, sub)}
                          >
                            Delete
                          </Button>
                        </div>
                      ),
                    },
                  ]}
                  rows={category.subcategories}
                />
              </div>
            )}
          </Card>
        ))}
      </div>
    )}
  </Card>
);
