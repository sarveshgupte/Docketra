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
  const initialWorkType = location.state?.initialWorkType === 'internal' ? 'internal' : 'client';
  const initialClientId = queryParams.get('clientId') || location.state?.clientId || '';

  return (
    <PlatformShell
      moduleLabel="Tasks / Dockets"
      title="Create Docket"
      subtitle="Use the guided flow to classify, route, and assign new dockets consistently."
      actions={null}
    >
      <div className="create-case">
        <GuidedDocketForm
          initialWorkType={initialWorkType}
          initialClientId={initialClientId}
          onCancel={() => navigate(ROUTES.CASES(firmSlug))}
          onCreated={(response) => {
            const docketId = response?.data?.docketId || response?.data?.caseId;
            const routedWorkbasketId = response?.data?.ownerTeamId || response?.data?.routedToTeamId || response?.data?.workbasketId;
            showSuccess(`✅ Docket ${docketId || 'created'} created successfully and routed.`);
            const destination = routedWorkbasketId
              ? `${ROUTES.GLOBAL_WORKLIST(firmSlug)}?workbasketId=${encodeURIComponent(String(routedWorkbasketId))}`
              : ROUTES.GLOBAL_WORKLIST(firmSlug);
            navigate(destination);
          }}
        />
      </div>
    </PlatformShell>
  );
};

export default CreateCasePage;
