import React, { useState, useEffect } from 'react';
import { PlatformShell } from '../components/platform/PlatformShell';
import { Card, CardHeader, CardBody } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Badge } from '../components/common/Badge';
import { Loading } from '../components/common/Loading';
import { useAuth } from '../hooks/useAuth';

// Helper to extract initials from name
const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Helper to generate a unique HSL gradient based on user's name
const getAvatarGradient = (name) => {
  if (!name) return 'linear-gradient(135deg, var(--dt-accent) 0%, #3b82f6 100%)';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash % 360);
  const h2 = (h1 + 35) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 75%, 48%) 0%, hsl(${h2}, 85%, 58%) 100%)`;
};

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
        <div className="flex h-[50vh] w-full items-center justify-center">
          <Loading message="Loading profile context..." />
        </div>
      </PlatformShell>
    );
  }

  const avatarGradient = getAvatarGradient(profileData?.name);
  const managerGradient = getAvatarGradient(profileData?.reportsTo?.name);

  return (
    <PlatformShell moduleLabel="Workspace" title="Profile" subtitle="View your account and role context.">
      <div className="w-full max-w-7xl mx-auto px-4 py-8 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* LEFT COLUMN: Identity & Status Overview */}
          <div className="space-y-6 lg:col-span-1">
            <Card animateOnMount className="flex flex-col items-center text-center p-6 bg-white border border-[var(--dt-border-whisper)]">
              {/* Initials Avatar with custom nameplate HSL gradient */}
              <div 
                className="w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-3xl shadow-md border-4 border-white ring-4 ring-blue-50/60"
                style={{ background: avatarGradient }}
              >
                {getInitials(profileData?.name)}
              </div>

              <h2 className="text-base font-semibold text-[var(--dt-text)] mt-4 tracking-tight">
                {profileData?.name || 'User Profile'}
              </h2>
              <p className="text-xs text-[var(--dt-text-muted)] break-all mt-1">
                {profileData?.email}
              </p>

              <div className="mt-3">
                <Badge variant={
                  profileData?.role?.toUpperCase() === 'SUPER_ADMIN' ? 'danger' :
                  profileData?.role?.toUpperCase() === 'PRIMARY_ADMIN' ? 'warning' :
                  profileData?.role?.toUpperCase() === 'ADMIN' ? 'info' : 'neutral'
                }>
                  {profileData?.role || 'Employee'}
                </Badge>
              </div>

              {/* Secure Session Pulse */}
              <div className="w-full mt-6 pt-4 border-t border-[var(--dt-border-whisper)] flex items-center justify-between text-xs text-[var(--dt-text-secondary)]">
                <span>Session Status</span>
                <span className="inline-flex items-center gap-1.5 font-medium text-[var(--dt-success)]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--dt-success)] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--dt-success)]"></span>
                  </span>
                  Active Secure
                </span>
              </div>

              {/* Associated Firm details */}
              {profileData?.firm ? (
                <div className="w-full mt-3 pt-3 border-t border-[var(--dt-border-whisper)] flex items-center justify-between text-xs text-[var(--dt-text-secondary)]">
                  <span>Associated Firm</span>
                  <span className="font-semibold text-[var(--dt-text)] truncate max-w-[150px]" title={profileData.firm.name}>
                    {profileData.firm.name}
                  </span>
                </div>
              ) : null}
            </Card>
          </div>

          {/* RIGHT COLUMN: Metadata & Structural Context Panels */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Identity Details Card */}
            <Card animateOnMount className="bg-white border border-[var(--dt-border-whisper)]">
              <CardHeader title="Identity Details" />
              <CardBody>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Input label="Full Name" value={profileData?.name || ''} readOnly />
                  <Input label="Email Address" value={profileData?.email || ''} readOnly />
                  <Input label="Employee ID (xID)" value={profileData?.xID || ''} readOnly />
                  <Input label="Organizational Role" value={profileData?.role || ''} readOnly />
                </div>
              </CardBody>
            </Card>

            {/* Reporting Structure Card */}
            <Card animateOnMount className="bg-white border border-[var(--dt-border-whisper)]">
              <CardHeader title="Reporting Structure" />
              <CardBody>
                {profileData?.reportsTo ? (
                  <div className="flex items-start gap-4 p-4 rounded-lg bg-[var(--dt-surface-subtle)] border border-[var(--dt-border-whisper)] transition-all duration-200 hover:border-[var(--dt-border)]">
                    <div 
                      className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm border-2 border-white"
                      style={{ background: managerGradient }}
                    >
                      {getInitials(profileData.reportsTo.name)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-[var(--dt-text)] truncate">
                          {profileData.reportsTo.name}
                        </p>
                        <Badge variant="info" className="text-xs">Reporting Manager</Badge>
                      </div>
                      <p className="text-xs text-[var(--dt-text-secondary)] truncate">
                        <a 
                          href={`mailto:${profileData.reportsTo.email}`} 
                          className="hover:text-[var(--dt-accent)] transition-colors inline-flex items-center gap-1 font-medium"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                          </svg>
                          {profileData.reportsTo.email}
                        </a>
                      </p>
                      <div className="flex items-center gap-4 text-xs text-[var(--dt-text-muted)] pt-1">
                        <span>xID: <strong className="text-[var(--dt-text-secondary)]">{profileData.reportsTo.xID}</strong></span>
                        <span>Role: <strong className="text-[var(--dt-text-secondary)]">{profileData.reportsTo.role}</strong></span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center rounded-lg bg-[var(--dt-surface-subtle)] border border-dashed border-[var(--dt-border)]">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--dt-text-muted)] mb-2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    <p className="text-xs font-semibold text-[var(--dt-text)]">Independent Contributor</p>
                    <p className="text-[11px] text-[var(--dt-text-muted)] mt-1">
                      This account reports directly to the Board of Directors or Firm Administrator.
                    </p>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Security & System Context Card */}
            <Card animateOnMount className="bg-white border border-[var(--dt-border-whisper)]">
              <CardHeader title="Security & Telemetry Context" />
              <CardBody>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[var(--dt-surface-subtle)] border border-[var(--dt-border-whisper)]">
                    <span className="text-[var(--dt-accent)] mt-0.5 text-sm">🛡️</span>
                    <div>
                      <p className="font-semibold text-[var(--dt-text)] text-xs">Active Cryptographic Shielding</p>
                      <p className="text-[11px] text-[var(--dt-text-muted)] mt-0.5 leading-normal">
                        Database-backed PAN and Aadhaar identity tokens are encrypted and masked under strict Mongoose schema security contracts.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[var(--dt-surface-subtle)] border border-[var(--dt-border-whisper)]">
                    <span className="text-[var(--dt-success)] mt-0.5 text-sm">⚡</span>
                    <div>
                      <p className="font-semibold text-[var(--dt-text)] text-xs">Cloudflare Turnstile Protected</p>
                      <p className="text-[11px] text-[var(--dt-text-muted)] mt-0.5 leading-normal">
                        All platform mutations and public file sharing sessions are verified using anti-abuse turnstile verification gating.
                      </p>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>

          </div>
        </div>
      </div>
    </PlatformShell>
  );
};
