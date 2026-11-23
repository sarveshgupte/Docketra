import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { PlatformShell } from '../components/platform/PlatformShell';
import { useToast } from '../hooks/useToast';
import GuidedDocketForm from '../components/docket/GuidedDocketForm';
import { ROUTES } from '../constants/routes';
import './CreateCasePage.css';

export const CreateCasePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { firmSlug } = useParams();
  const { showSuccess } = useToast();
  const queryParams = new URLSearchParams(location.search || '');
  const initialClientId = queryParams.get('clientId') || location.state?.clientId || '';

  return (
    <PlatformShell
      moduleLabel="Dockets"
      title="New Docket"
      subtitle="Register and route a new docket to your team queues."
      actions={null}
    >
      <div className="create-case">
        <GuidedDocketForm
          initialClientId={initialClientId}
          onCancel={() => navigate(ROUTES.TASK_MANAGER(firmSlug))}
          onCreated={(response, wbName) => {
            const docketId = response?.data?.docketId || response?.data?.caseId || response?.data?.case?.caseId;
            showSuccess(`Docket ${docketId || 'created'} created successfully and routed to ${wbName || 'General'} workbasket.`);
            if (docketId) {
              navigate(ROUTES.CASE_DETAIL(firmSlug, docketId));
            } else {
              navigate(ROUTES.TASK_MANAGER(firmSlug));
            }
          }}
        />
      </div>
    </PlatformShell>
  );
};

export default CreateCasePage;
