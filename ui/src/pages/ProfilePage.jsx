import React from 'react';
import { PlatformShell } from '../components/platform/PlatformShell';
import { Card, CardBody } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Loading } from '../components/common/Loading';
import { useAuth } from '../hooks/useAuth';

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const getRoleVariant = (role) => {
  const normalized = String(role || '').trim().toUpperCase();
  if (normalized === 'SUPER_ADMIN') return 'danger';
  if (normalized === 'PRIMARY_ADMIN') return 'warning';
  if (normalized === 'ADMIN') return 'info';
  return 'neutral';
};

const formatValue = (value, fallback = '—') => {
  const text = String(value || '').trim();
  return text || fallback;
};

const profileRows = (profile) => ([
  { label: 'Full name', value: formatValue(profile?.name) },
  { label: 'Email', value: formatValue(profile?.email) },
  { label: 'Employee ID', value: formatValue(profile?.xID) },
  { label: 'Role', value: formatValue(profile?.role) },
]);

export const ProfilePage = () => {
  const { user, loading: authLoading, isHydrating } = useAuth();
  const loading = authLoading || isHydrating;
  const profile = user || {};

  if (loading) {
    return (
      <PlatformShell moduleLabel="Workspace" title="Profile" subtitle="Account snapshot.">
        <div className="flex min-h-[42vh] items-center justify-center">
          <Loading message="Loading profile..." />
        </div>
      </PlatformShell>
    );
  }

  const rows = profileRows(profile);

  return (
    <PlatformShell moduleLabel="Workspace" title="Profile" subtitle="Account snapshot.">
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <Card animateOnMount className="overflow-hidden">
            <CardBody className="p-0">
              <div className="border-b border-[var(--dt-border-whisper)] bg-[var(--dt-surface-subtle)] px-6 py-5 sm:px-8">
                <div className="flex items-start gap-4 sm:items-center">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.1rem] bg-[var(--dt-accent)] text-xl font-semibold tracking-[-0.04em] text-white shadow-sm ring-4 ring-white/80">
                    {getInitials(profile?.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--dt-text-muted)]">
                      Workspace account
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[var(--dt-text)] sm:text-[2rem]">
                      {formatValue(profile?.name, 'User profile')}
                    </h2>
                    <p className="mt-1 truncate text-sm text-[var(--dt-text-secondary)]">
                      {formatValue(profile?.email, 'No email on file')}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Badge variant={getRoleVariant(profile?.role)}>
                      {formatValue(profile?.role, 'Employee')}
                    </Badge>
                    <span className="inline-flex items-center gap-2 text-xs font-medium text-[var(--dt-text-secondary)]">
                      <span className="h-2 w-2 rounded-full bg-[var(--dt-success)]" />
                      Active secure
                    </span>
                  </div>
                </div>
              </div>

              <dl className="grid gap-px bg-[var(--dt-border-whisper)] sm:grid-cols-2">
                {rows.map((row) => (
                  <div key={row.label} className="bg-white px-6 py-5">
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--dt-text-muted)]">
                      {row.label}
                    </dt>
                    <dd className="mt-2 break-words text-sm font-medium text-[var(--dt-text)]">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="flex flex-wrap items-center gap-6 px-6 py-4 text-sm sm:px-8">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--dt-text-muted)]">
                    Firm
                  </div>
                  <div className="mt-1 font-semibold text-[var(--dt-text)]">
                    {formatValue(profile?.firm?.name, 'Not set')}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--dt-text-muted)]">
                    Session
                  </div>
                  <div className="mt-1 font-semibold text-[var(--dt-success)]">
                    Active secure
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card animateOnMount className="overflow-hidden">
            <CardBody className="p-0">
              <div className="border-b border-[var(--dt-border-whisper)] px-6 py-5">
                <p className="text-lg font-semibold tracking-[-0.02em] text-[var(--dt-text)]">
                  Reporting
                </p>
                <p className="mt-1 text-sm text-[var(--dt-text-secondary)]">
                  Who this account reports to.
                </p>
              </div>

              <div className="px-6 py-5">
                {profile?.reportsTo ? (
                  <div className="rounded-2xl border border-[var(--dt-border-whisper)] bg-[var(--dt-surface-subtle)] p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--dt-accent)] text-sm font-semibold tracking-[-0.03em] text-white shadow-sm">
                        {getInitials(profile.reportsTo.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-[var(--dt-text)]">
                            {formatValue(profile.reportsTo.name, 'Reporting manager')}
                          </p>
                          <Badge variant="info">Manager</Badge>
                        </div>
                        <p className="mt-1 truncate text-sm text-[var(--dt-text-secondary)]">
                          {formatValue(profile.reportsTo.email, 'No email on file')}
                        </p>
                      </div>
                    </div>

                    <dl className="mt-4 grid gap-px overflow-hidden rounded-xl border border-[var(--dt-border-whisper)] bg-[var(--dt-border-whisper)] sm:grid-cols-2">
                      <div className="bg-white px-4 py-3">
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--dt-text-muted)]">
                          Employee ID
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-[var(--dt-text)]">
                          {formatValue(profile.reportsTo.xID)}
                        </dd>
                      </div>
                      <div className="bg-white px-4 py-3">
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--dt-text-muted)]">
                          Role
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-[var(--dt-text)]">
                          {formatValue(profile.reportsTo.role)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--dt-border)] bg-[var(--dt-surface-subtle)] px-5 py-8 text-center">
                    <p className="text-sm font-semibold text-[var(--dt-text)]">
                      No reporting manager
                    </p>
                    <p className="mt-1 text-sm text-[var(--dt-text-secondary)]">
                      This account reports directly to firm leadership.
                    </p>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </section>
      </div>
    </PlatformShell>
  );
};

export default ProfilePage;
