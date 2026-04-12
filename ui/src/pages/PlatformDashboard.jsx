/**
 * Platform Dashboard
 * SuperAdmin view of platform-level metrics
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { superadminService } from '../services/superadminService';
import { SuperAdminLayout } from '../components/common/SuperAdminLayout';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { MetricCard } from '../components/reports/MetricCard';
import { Loading } from '../components/common/Loading';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../hooks/useToast';
import { productUpdatesService } from '../services/productUpdatesService';

export const PlatformDashboard = () => {
  const navigate = useNavigate();
  const toast = useToast();
  
  const emptyStats = {
    totalFirms: 0,
    activeFirms: 0,
    inactiveFirms: 0,
    totalClients: 0,
    totalUsers: 0,
  };
  const [loading, setLoading] = useState(true);
  const [updateForm, setUpdateForm] = useState({
    title: '',
    bullets: ['', '', ''],
    isPublished: true,
    version: '',
  });
  const [publishingUpdate, setPublishingUpdate] = useState(false);
  const [stats, setStats] = useState(emptyStats);
  const isFetchingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const hasShownErrorRef = useRef(false);

  // Load platform stats once per dashboard load
  useEffect(() => {
    if (!hasLoadedRef.current && !isFetchingRef.current) {
      loadStats();
    }
  }, []);

  const loadStats = async () => {
    if (isFetchingRef.current) {
      return;
    }
    isFetchingRef.current = true;
    try {
      setLoading(true);
      const response = await superadminService.getPlatformStats();
      
      // HTTP 304 means cached data is still valid - keep current state
      if (response?.status !== 304) {
        if (response?.success) {
          const data = response.data || emptyStats;
          if (!response.data) {
            console.warn('PlatformDashboard: API returned success but no data, using emptyStats');
          }
          setStats(data);
        } else if (response?.degraded) {
          const data = response?.data || emptyStats;
          if (!response.data) {
            console.warn('PlatformDashboard: API returned degraded but no data, using emptyStats');
          }
          setStats(data);
        } else if (!hasShownErrorRef.current) {
          toast.error('Failed to load platform statistics');
          hasShownErrorRef.current = true;
        }
      }
    } catch (error) {
      // Don't reset stats on error - preserve existing data
      if (!hasShownErrorRef.current) {
        toast.error('Failed to load platform statistics');
        hasShownErrorRef.current = true;
      }
      console.error('Error loading platform stats:', error);
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  const handleCreateUpdate = async (event) => {
    event.preventDefault();
    const content = updateForm.bullets.map((item) => item.trim()).filter(Boolean);
    if (!updateForm.title.trim() || content.length === 0) {
      toast.error('Add a title and at least one bullet point.');
      return;
    }

    try {
      setPublishingUpdate(true);
      const response = await productUpdatesService.create({
        title: updateForm.title.trim(),
        content,
        isPublished: updateForm.isPublished,
        version: updateForm.version.trim() || undefined,
      });
      if (response?.success) {
        toast.success('Product update published.');
        setUpdateForm({ title: '', bullets: ['', '', ''], isPublished: true, version: '' });
      } else {
        toast.error(response?.message || 'Failed to publish update.');
      }
    } catch (error) {
      toast.error('Failed to publish update.');
    } finally {
      setPublishingUpdate(false);
    }
  };

  if (loading) {
    return (
      <SuperAdminLayout>
        <Loading message="Loading platform data..." />
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="mx-auto w-full max-w-7xl space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Platform Overview</h1>
            <p className="text-sm text-gray-500">
              Manage firms on the Docketra platform. Operational work is handled within firms.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Total Firms"
              value={stats.totalFirms}
              subtitle={
                stats.totalFirms === 0
                  ? 'No firms exist yet. This is expected.'
                  : `${stats.activeFirms} Active • ${stats.inactiveFirms} Inactive`
              }
              onClick={() => navigate('/app/superadmin/firms')}
            />
            <MetricCard
              title="Active Firms"
              value={stats.activeFirms}
              subtitle="Currently enabled firms"
              subtitleClassName="text-green-600"
            />
            <MetricCard
              title="Total Clients"
              value={stats.totalClients}
              subtitle={stats.totalClients === 0 ? 'No clients yet. Create a firm to begin.' : 'Across all firms'}
            />
            <MetricCard
              title="Total Users"
              value={stats.totalUsers}
              subtitle={stats.totalUsers === 0 ? 'No users yet. Create a firm to begin.' : 'Across all firms'}
            />
          </div>

          {stats.totalFirms === 0 ? (
            <Card>
              <EmptyState
                title="No firms created yet"
                description="Create your first firm to start onboarding clients, users, and operational dashboards."
                actionLabel="Create first firm"
                onAction={() => navigate('/app/superadmin/firms')}
                icon
              />
            </Card>
          ) : null}

          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Firm Management</h2>
              <Badge>Platform Admin</Badge>
            </div>
            <p className="text-sm text-gray-500">
              Create new firms, activate or deactivate existing ones, and manage firm administrators.
            </p>
            <div>
              <Button variant="primary" onClick={() => navigate('/app/superadmin/firms')}>
                Go to Firms Management
              </Button>
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Product Updates</h2>
              <Badge>What&apos;s New</Badge>
            </div>
            <p className="text-sm text-gray-500">
              Publish the latest release note shown to users on their next login.
            </p>
            <form className="space-y-3" onSubmit={handleCreateUpdate}>
              <input
                value={updateForm.title}
                onChange={(event) => setUpdateForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Update title"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                maxLength={160}
              />
              <input
                value={updateForm.version}
                onChange={(event) => setUpdateForm((prev) => ({ ...prev, version: event.target.value }))}
                placeholder="Version (optional, e.g. v1.4)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                maxLength={32}
              />
              {updateForm.bullets.map((bullet, index) => (
                <input
                  key={index}
                  value={bullet}
                  onChange={(event) => setUpdateForm((prev) => {
                    const nextBullets = [...prev.bullets];
                    nextBullets[index] = event.target.value;
                    return { ...prev, bullets: nextBullets };
                  })}
                  placeholder={`Bullet point ${index + 1}`}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  maxLength={180}
                />
              ))}
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={updateForm.isPublished}
                  onChange={(event) => setUpdateForm((prev) => ({ ...prev, isPublished: event.target.checked }))}
                />
                Publish immediately
              </label>
              <Button type="submit" variant="primary" disabled={publishingUpdate}>
                {publishingUpdate ? 'Publishing…' : 'Publish update'}
              </Button>
            </form>
          </Card>
      </div>
    </SuperAdminLayout>
  );
};
