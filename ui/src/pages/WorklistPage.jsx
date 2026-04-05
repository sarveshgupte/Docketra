/**
 * Worklist Page
 *
 * Composes WorklistView (card list). Pending view uses the same layout with a different data source.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Button } from '../components/common/Button';
import { Stack } from '../components/layout/Stack';
import { PageHeader } from '../components/layout/PageHeader';
import { useQueryState } from '../hooks/useQueryState';
import { useActiveDocket } from '../hooks/useActiveDocket';
import { ROUTES } from '../constants/routes';
import { WorklistView } from '../../views/WorklistView';
import './WorklistPage.css';

export const WorklistPage = () => {
  const navigate = useNavigate();
  const { query, setQuery } = useQueryState({ status: '', sort: 'updatedAt', order: 'desc' });
  const { firmSlug } = useParams();
  const { openDocket } = useActiveDocket();

  const [sortState, setSortState] = useState({ key: query.sort, direction: query.order });

  const statusParam = query.status;
  const isPendingView = statusParam && (
    statusParam === 'PENDING'
    || statusParam.split(',').includes('PENDING')
  );

  useEffect(() => {
    const defaultKey = isPendingView ? 'pendingUntil' : 'updatedAt';
    const nextKey = query.sort || defaultKey;
    const nextDirection = query.order || 'desc';
    setSortState({ key: nextKey, direction: nextDirection });
  }, [isPendingView, query.sort, query.order]);

  useEffect(() => {
    if (!sortState?.key || !sortState?.direction) {
      setQuery({ sort: null, order: null });
      return;
    }
    setQuery({ sort: sortState.key, order: sortState.direction });
  }, [sortState, setQuery]);

  const handleCaseClick = useCallback(({ caseId, sourceList, index, origin }) => {
    openDocket({
      caseId,
      navigate,
      to: ROUTES.CASE_DETAIL(firmSlug, caseId),
      state: { sourceList, index, origin },
    });
  }, [openDocket, navigate, firmSlug]);

  const pageInfo = isPendingView
    ? {
      title: 'My Pending Dockets',
      description: 'Dockets temporarily on hold (status = PENDING)',
    }
    : {
      title: 'My Worklist',
      description: 'Your open dockets assigned to you. Pending dockets appear in My Pending Dockets.',
    };

  return (
    <Layout>
      <Stack className="worklist" space={16}>
        <PageHeader
          title={pageInfo.title}
          subtitle={pageInfo.description}
          actions={(
            <Button variant="primary" onClick={() => navigate(ROUTES.CREATE_CASE(firmSlug))}>
              Create Docket
            </Button>
          )}
        />
        <WorklistView
          variant={isPendingView ? 'pending' : 'worklist'}
          sortState={sortState}
          onOpenDocket={handleCaseClick}
        />
      </Stack>
    </Layout>
  );
};
