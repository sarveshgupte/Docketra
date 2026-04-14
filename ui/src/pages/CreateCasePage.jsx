import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { useToast } from '../hooks/useToast';
import GuidedDocketForm from '../components/docket/GuidedDocketForm';
import './CreateCasePage.css';

export const CreateCasePage = () => {
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const { showSuccess } = useToast();

  return (
    <Layout>
      <div className="create-case">
        <GuidedDocketForm
          onCreated={(response) => {
            const docketId = response?.data?.docketId || response?.data?.caseId;
            showSuccess(`Docket ${docketId} created successfully`);
            navigate(`/app/firm/${firmSlug}/global-worklist`);
          }}
        />
      </div>
    </Layout>
  );
};

export default CreateCasePage;
