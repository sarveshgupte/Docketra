import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { useToast } from '../hooks/useToast';
import GuidedDocketForm from '../components/docket/GuidedDocketForm';
import './CreateCasePage.css';

export const CreateCasePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { firmSlug } = useParams();
  const { showSuccess } = useToast();
  const initialWorkType = location.state?.initialWorkType === 'internal' ? 'internal' : 'client';

  return (
    <Layout>
      <div className="create-case">
        <GuidedDocketForm
          initialWorkType={initialWorkType}
          onCreated={(response) => {
            const docketId = response?.data?.docketId || response?.data?.caseId;
            const routedWorkbasketId = response?.data?.ownerTeamId || response?.data?.routedToTeamId || response?.data?.workbasketId;
            showSuccess(`✅ Docket ${docketId || 'created'} created successfully and routed.`);
            const destination = routedWorkbasketId
              ? `/app/firm/${firmSlug}/global-worklist?workbasketId=${encodeURIComponent(String(routedWorkbasketId))}`
              : `/app/firm/${firmSlug}/global-worklist`;
            navigate(destination);
          }}
        />
      </div>
    </Layout>
  );
};

export default CreateCasePage;
