import React, { useState, useEffect } from 'react';
import { PlatformShell } from '../components/platform/PlatformShell';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Loading } from '../components/common/Loading';
import { useAuth } from '../hooks/useAuth';

export const ProfilePage = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setProfileData(user);
    setLoading(false);
  }, [user]);

  if (loading) {
    return (
      <PlatformShell moduleLabel="Workspace" title="Profile" subtitle="View your account and role context.">
        <Loading message="Loading profile..." />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell moduleLabel="Workspace" title="Profile" subtitle="View your account and role context.">
      <div className="min-h-screen w-full flex-1 bg-gray-50">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Profile</h1>
            <p className="text-sm text-gray-500">View your account information.</p>
          </div>

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
            <div className="space-y-2 lg:col-span-1">
              <h2 className="text-lg font-medium text-gray-900">Identity</h2>
              <p className="text-sm text-gray-500">These fields are managed by your organization and cannot be edited here.</p>
            </div>
            <Card className="lg:col-span-2 lg:max-w-4xl">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Input label="Employee ID (xID)" value={profileData?.xID || ''} readOnly />
                <Input label="Role" value={profileData?.role || ''} readOnly />
                <Input label="Name" value={profileData?.name || ''} readOnly />
                <Input label="Email" value={profileData?.email || ''} readOnly />
                {profileData?.firm ? (
                  <Input label="Firm" value={profileData.firm.name || ''} readOnly className="sm:col-span-2" />
                ) : null}
              </div>
            </Card>
          </section>
        </div>
      </div>
    </PlatformShell>
  );
};
