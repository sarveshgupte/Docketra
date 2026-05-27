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
      title="Create Docket"
      subtitle="Use the guided flow to classify, route, and assign your first docket with clear setup checks."
      actions={null}
    >
      <div className="create-case">
        <GuidedDocketForm
          initialClientId={initialClientId}
          onCancel={() => navigate(ROUTES.DOCKETS(firmSlug))}
          onCreated={(response, wbName) => {
            const docketId = response?.data?.docketId || response?.data?.caseId;
            showSuccess(`✅ Docket ${docketId || 'created'} created successfully. This docket has been moved to ${wbName || 'general'} wb.`);
          }}
        />
      </div>
    </PlatformShell>
  );
};

export default CreateCasePage;
