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
  onEditCategory,
  onDeleteCategory,
  onToggleSubcategoryStatus,
  onEditSubcategory,
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
              <div className="admin__actions admin__actions--category">
                <div className="admin__action-group" role="group" aria-label={`${category.name} actions`}>
                  <Button size="small" variant="default" onClick={() => onAddSubcategory(category)}>+ Add Subcategory</Button>
                  <Button size="small" variant="outline" onClick={() => onEditCategory(category)}>Edit</Button>
                  <Button
                    size="small"
                    variant={category.isActive ? 'outline' : 'primary'}
                    onClick={() => onToggleCategoryStatus(category)}
                  >
                    {category.isActive ? 'Disable' : 'Enable'}
                  </Button>
                </div>
                <div className="admin__action-group admin__action-group--danger" role="group" aria-label={`${category.name} destructive actions`}>
                  <Button size="small" variant="danger" onClick={() => onDeleteCategory(category)}>Delete</Button>
                </div>
              </div>
            </div>

            {category.subcategories && category.subcategories.length > 0 && (
              <div className="subcategories-list">
                <h4>Subcategories:</h4>
                <DataTable
                  columns={[
                    { key: 'name', label: 'Subcategory', render: (sub) => <div className="admin__subcategory-name">{sub.name}</div> },
                    {
                      key: 'workbasketId',
                      label: 'Workbasket',
                      render: (sub) => {
                        const linkedWorkbasketName = workbasketNameById.get(String(sub?.workbasketId || ''));
                        return linkedWorkbasketName || '—';
                      },
                    },
                    { key: 'defaultSlaDays', label: 'SLA', render: (sub) => Number(sub.defaultSlaDays || 0) > 0 ? `${sub.defaultSlaDays} working day${Number(sub.defaultSlaDays) === 1 ? '' : 's'}` : '—' },
                    { key: 'status', label: 'Status', render: (sub) => <StatusBadge status={sub.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
                    {
                      key: 'actions',
                      label: 'Action',
                      align: 'right',
                      render: (sub) => (
                        <div className="admin__actions admin__actions--compact">
                          <div className="admin__action-group" role="group" aria-label={`${sub.name} actions`}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onEditSubcategory(category, sub)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant={sub.isActive ? 'outline' : 'primary'}
                              onClick={() => onToggleSubcategoryStatus(category, sub)}
                            >
                              {sub.isActive ? 'Disable' : 'Enable'}
                            </Button>
                          </div>
                          <div className="admin__action-group admin__action-group--danger" role="group" aria-label={`${sub.name} destructive actions`}>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => onDeleteSubcategory(category, sub)}
                            >
                              Delete
                            </Button>
                          </div>
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
