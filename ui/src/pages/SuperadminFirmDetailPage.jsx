import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SuperAdminLayout } from '../components/common/SuperAdminLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { EmptyState } from '../components/ui/EmptyState';
import { superadminService } from '../services/superadminService';
import { useToast } from '../hooks/useToast';

const pretty = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const toLocalDateTime = (value) => (value ? new Date(value).toLocaleString() : 'N/A');

export const SuperadminFirmDetailPage = () => {
  const { firmId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [firm, setFirm] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [onboarding, setOnboarding] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);

  const loadOverview = useCallback(async () => {
    if (!firmId) {
      setError('Missing firm ID. Return to Firms Management and retry.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const [firmsRes, adminsRes, onboardingRes, diagnosticsRes] = await Promise.allSettled([
      superadminService.listFirms(),
      superadminService.listFirmAdmins(firmId),
      superadminService.getOnboardingInsightDetails({ firmId, completionState: 'all', staleAfterDays: 7, sinceDays: 30, limit: 100 }),
      superadminService.getSupportDiagnostics({ limit: 50 }),
    ]);

    const firmsData = firmsRes.status === 'fulfilled' && firmsRes.value?.success ? firmsRes.value.data : null;
    const firmMatch = Array.isArray(firmsData) ? firmsData.find((entry) => String(entry?._id) === String(firmId)) : null;
    const adminData = adminsRes.status === 'fulfilled' && adminsRes.value?.success ? adminsRes.value.data : [];
    const onboardingData = onboardingRes.status === 'fulfilled' && onboardingRes.value?.success ? onboardingRes.value.data : null;
    const diagnosticsData = diagnosticsRes.status === 'fulfilled' && diagnosticsRes.value?.success ? diagnosticsRes.value.data : null;

    setFirm(firmMatch || null);
    setAdmins(Array.isArray(adminData) ? adminData : []);
    setOnboarding(onboardingData);
    setDiagnostics(diagnosticsData);

    if (!firmMatch) {
      setError('Firm was not found in the current superadmin scope.');
    } else if (
      adminsRes.status === 'rejected'
      || onboardingRes.status === 'rejected'
      || diagnosticsRes.status === 'rejected'
    ) {
      setError('Some firm detail modules are temporarily unavailable.');
    }

    setLoading(false);
  }, [firmId]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const loginUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return firm?.firmSlug && origin ? `${origin}/${firm.firmSlug}/login` : null;
  }, [firm?.firmSlug]);

  const firmDiagnostics = useMemo(() => (diagnostics?.firms || []).find((item) => String(item?.firmId) === String(firmId)), [diagnostics, firmId]);

  const onboardingFirm = useMemo(() => (onboarding?.firms || []).find((item) => String(item?.firmId) === String(firmId)) || null, [onboarding, firmId]);

  const handleResendAccess = async () => { await superadminService.resendAdminAccess(firmId); toast.success('Admin access was resent.'); void loadOverview(); };
  const handleForceReset = async (adminId) => { await superadminService.forceResetFirmAdmin(firmId, adminId); toast.success('Password reset initiated.'); void loadOverview(); };
  const handleStatus = async (adminId, status) => { await superadminService.updateFirmAdminStatus(firmId, status, adminId); toast.success(`Admin ${status === 'ACTIVE' ? 'enabled' : 'disabled'}.`); void loadOverview(); };
  const handleDelete = async (adminId) => { await superadminService.deleteFirmAdmin(firmId, adminId); toast.success('Admin removed.'); void loadOverview(); };

  if (loading) return <SuperAdminLayout><Loading message="Loading firm 360 detail..." /></SuperAdminLayout>;

  return (
    <SuperAdminLayout>
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Firm 360 Detail</h1>
            <p className="text-sm text-gray-500">Superadmin lifecycle and support cockpit (metadata only).</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/app/superadmin/firms')}>Back to Firms Management</Button>
            <Button variant="secondary" onClick={() => navigate('/app/superadmin')}>Platform Command Center</Button>
            <Button variant="primary" onClick={loadOverview}>Retry</Button>
          </div>
        </div>

        <Card><p className="text-sm text-amber-700">Superadmin can manage tenant lifecycle and support metadata, but cannot access firm client records, dockets, tasks, attachments, or private client content.</p></Card>
        {error ? <Card><p className="text-sm text-amber-700">{error}</p></Card> : null}

        {!firm ? <Card><EmptyState title="Firm not found" description="This firm is unavailable or outside current scope." actionLabel="Back to firms" onAction={() => navigate('/app/superadmin/firms')} /></Card> : (
          <>
            <Card className="space-y-3">
              <h2 className="text-lg font-semibold">Firm identity</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                <div><strong>Firm name:</strong> {firm.name || 'N/A'}</div><div><strong>firmId:</strong> {firm.firmId || 'N/A'}</div><div><strong>firmSlug:</strong> {firm.firmSlug || 'N/A'}</div><div><strong>Status:</strong> {pretty(firm.status)}</div>
                <div><strong>Created:</strong> {toLocalDateTime(firm.createdAt)}</div><div><strong>Clients:</strong> {firm.clientCount ?? 0}</div><div><strong>Users:</strong> {firm.userCount ?? 0}</div><div><strong>Admin email:</strong> {firm.adminEmail || 'N/A'}</div>
                <div className="md:col-span-2 xl:col-span-4"><strong>Firm login URL:</strong> {loginUrl ? <a className="text-blue-600 underline" href={loginUrl} target="_blank" rel="noreferrer">{loginUrl}</a> : 'N/A'}</div>
              </div>
            </Card>

            <Card className="space-y-3">
              <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Admin management</h2><Button onClick={handleResendAccess}>Resend admin access</Button></div>
              {!admins.length ? <p className="text-sm text-gray-500">No admins available for this firm.</p> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="text-left text-gray-500"><th>Name</th><th>Masked email</th><th>xID</th><th>Status</th><th>System admin</th><th>Last login</th><th>Invite sent</th><th>Password set</th><th>Actions</th></tr></thead><tbody>{admins.map((admin) => <tr key={admin._id} className="border-t"><td>{admin.name || 'N/A'}</td><td>{admin.emailMasked || admin.email || 'N/A'}</td><td>{admin.xid || admin.userXid || 'N/A'}</td><td>{pretty(admin.status)}</td><td>{admin.isSystem ? 'Yes' : 'No'}</td><td>{toLocalDateTime(admin.lastLoginAt)}</td><td>{toLocalDateTime(admin.inviteSentAt)}</td><td>{toLocalDateTime(admin.passwordSetAt || admin.passwordUpdatedAt)}</td><td className="space-x-2"><Button size="small" onClick={() => handleForceReset(admin._id)}>Force reset</Button><Button size="small" variant="secondary" onClick={() => handleStatus(admin._id, admin.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE')}>{admin.status === 'ACTIVE' ? 'Disable' : 'Enable'}</Button>{!admin.isSystem ? <Button size="small" variant="danger" onClick={() => handleDelete(admin._id)}>Delete</Button> : null}</td></tr>)}</tbody></table></div>}
              <Button variant="secondary" onClick={() => navigate('/app/superadmin/firms')}>Add additional admin (via Firms Management)</Button>
            </Card>

            <Card className="space-y-2"><h2 className="text-lg font-semibold">Onboarding health</h2><p className="text-sm">Completion state: {onboardingFirm?.completionState || 'Unknown'}</p><p className="text-sm">Stale users: {onboardingFirm?.staleUsers || 0} · Incomplete users: {onboardingFirm?.incompleteUsers || 0}</p><p className="text-sm">Blockers: {(onboardingFirm?.blockers || []).join(', ') || 'None'}</p><p className="text-sm">Next suggested action: {onboardingFirm?.nextAction || 'Continue monitoring'}</p><Link className="text-sm text-blue-600 underline" to={`/app/superadmin/onboarding-insights/${firmId}`}>Open onboarding insight detail</Link></Card>

            <Card className="space-y-2"><h2 className="text-lg font-semibold">Storage / BYOS</h2><p className="text-sm">Storage mode: {pretty(firmDiagnostics?.storageMode || firm?.storageMode || 'unknown')}</p><p className="text-sm">Provider: {pretty(firmDiagnostics?.storageProvider || firm?.storageProvider || 'unknown')}</p><p className="text-sm">Health: {pretty(firmDiagnostics?.storageHealthStatus || 'unknown')}</p><p className="text-sm">Connected: {String(firmDiagnostics?.storageHealthStatus || '').toUpperCase() === 'HEALTHY' ? 'Yes' : 'Unknown'}</p></Card>

            <Card className="space-y-2"><h2 className="text-lg font-semibold">Plan / limits</h2><p className="text-sm">Plan: {firm?.plan || 'N/A'}</p><p className="text-sm">Max users: {firm?.maxUsers ?? 'N/A'}</p><p className="text-sm">Subscription status: {pretty(firm?.subscriptionStatus || 'unknown')}</p><p className="text-sm">Billing status: {pretty(firm?.billingStatus || 'unknown')}</p><p className="text-sm">Billing owner ID: {firm?.billingOwnerId || 'N/A'}</p></Card>

            <Card className="space-y-2"><h2 className="text-lg font-semibold">Support diagnostics</h2><p className="text-sm">Recent login/OTP issue count: {(diagnostics?.loginAndOtpIssues || []).length}</p><p className="text-sm break-all">Request IDs: {(diagnostics?.requestIds || []).join(', ') || 'N/A'}</p><p className="text-sm">Storage issue summary: {pretty(firmDiagnostics?.storageHealthStatus || 'unknown')}</p><p className="text-sm">Slow endpoint p95: {diagnostics?.slowEndpointSummary?.p95Ms ?? 'N/A'} ms</p></Card>
          </>
        )}
      </div>
    </SuperAdminLayout>
  );
};

export default SuperadminFirmDetailPage;
