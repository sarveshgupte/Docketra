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
      moduleLabel="Tasks / Dockets"
      title="Create Docket"
      subtitle="Use the guided flow to classify, route, and assign new dockets consistently."
      actions={null}
    >
      <div className="create-case">
        <GuidedDocketForm
          initialClientId={initialClientId}
          onCancel={() => navigate(ROUTES.CASES(firmSlug))}
          onCreated={(response) => {
            const docketId = response?.data?.docketId || response?.data?.caseId;
            showSuccess(`✅ Docket ${docketId || 'created'} created successfully.`);
          }}
        />
      </div>
    </PlatformShell>
  );
};

export default CreateCasePage;
