import { Button } from '../../../components/common/Button';

export const AdminSectionHeader = ({
  title,
  description,
  actions = [],
}) => (
  <div className="admin__section-header">
    <div className="admin__section-heading">
      <h2 className="admin__section-title">{title}</h2>
      {description ? <p className="admin__section-description">{description}</p> : null}
    </div>
    {actions.length ? (
      <div className="admin__section-actions">
        {actions.map((action) => (
          <Button
            key={action.key || action.label}
            variant={action.variant || 'default'}
            onClick={action.onClick}
            disabled={Boolean(action.disabled)}
          >
            {action.label}
          </Button>
        ))}
      </div>
    ) : null}
  </div>
);

export default AdminSectionHeader;
