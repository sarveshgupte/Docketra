import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { EmptyState } from '../components/ui/EmptyState';
import { productUpdatesService } from '../services/productUpdatesService';
import { useToast } from '../hooks/useToast';

const formatUpdateDate = (value) => {
  if (!value) return 'Date unavailable';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Date unavailable';

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(parsed);
};

export const ProductUpdatesHistoryPage = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [updates, setUpdates] = useState([]);

  useEffect(() => {
    let mounted = true;

    const loadUpdates = async () => {
      try {
        setLoading(true);
        const response = await productUpdatesService.list();
        const allUpdates = Array.isArray(response?.data) ? response.data : [];
        const publishedUpdates = allUpdates
          .filter((item) => item?.isPublished)
          .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());

        if (mounted) {
          setUpdates(publishedUpdates);
        }
      } catch (error) {
        if (mounted) {
          toast.error('Unable to load product updates right now.');
          setUpdates([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadUpdates();

    return () => {
      mounted = false;
    };
  }, [toast]);

  const hasUpdates = useMemo(() => updates.length > 0, [updates]);

  if (loading) {
    return <Loading message="Loading product updates..." />;
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Version &amp; Product Updates</h1>
        <p className="text-sm text-gray-500">All published release notes, newest first.</p>
      </div>

      {!hasUpdates ? (
        <Card>
          <EmptyState
            title="No product updates yet"
            description="Published product updates will show up here in reverse chronological order."
            icon
          />
        </Card>
      ) : (
        updates.map((update) => (
          <Card key={update._id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-gray-900">{update.title || 'Product update'}</h2>
              <p className="text-sm text-gray-500">{formatUpdateDate(update.createdAt)}</p>
            </div>
            {update.version ? (
              <p className="text-sm font-medium text-gray-700">Version {update.version}</p>
            ) : null}
            <ul className="list-disc space-y-2 pl-5 text-sm text-gray-700">
              {(Array.isArray(update.content) ? update.content : []).map((bullet, index) => (
                <li key={`${update._id}-${index}`}>{bullet}</li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
};
