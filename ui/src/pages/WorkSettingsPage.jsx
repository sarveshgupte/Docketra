import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { PageHeader } from '../components/layout/PageHeader';
import { ROUTES } from '../constants/routes';

export const WorkSettingsPage = () => {
  const navigate = useNavigate();
  const { firmSlug } = useParams();

  return (
    <Layout>
      <PageHeader
        title="Work Settings"
        subtitle="Configure work taxonomy and docket structuring rules for your firm."
      />

      <Card className="neo-card">
        <div className="flex items-start justify-between gap-4 p-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Category Management</h2>
            <p className="mt-1 text-sm text-gray-600">
              Create categories and subcategories that define where dockets are created.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => navigate(`${ROUTES.ADMIN(firmSlug)}?tab=categories`)}
          >
            Open Category Management
          </Button>
        </div>
      </Card>
    </Layout>
  );
};
