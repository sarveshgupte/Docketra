import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../common/Button';
import { ErrorState } from './ErrorState';
import { ROUTES } from '../../constants/routes';
import { SupportContext } from './SupportContext';

export const AccessDeniedState = ({
  supportContext,
  contactAdminCopy = 'If you still need access, contact your admin.',
}) => {
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  return (
    <div>
      <ErrorState
        title="Access restricted"
        description="You do not have permission to view this content."
      />
      <p className="mt-2 text-xs text-slate-600">{contactAdminCopy}</p>
      <div className="mt-3 flex gap-2">
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>Go back</Button>
        {firmSlug ? (
          <Button type="button" variant="primary" onClick={() => navigate(ROUTES.DASHBOARD(firmSlug))}>Go to dashboard</Button>
        ) : null}
      </div>
      <SupportContext context={supportContext} />
    </div>
  );
};
