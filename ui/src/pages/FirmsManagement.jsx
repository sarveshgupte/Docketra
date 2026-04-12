/**
 * Firms Management Page
 * SuperAdmin view for managing firms
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { superadminService } from '../services/superadminService';
import { SuperAdminLayout } from '../components/common/SuperAdminLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Loading } from '../components/common/Loading';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { useToast } from '../hooks/useToast';
import { formatDate, getFirmStatusInfo } from '../utils/formatters';
import './FirmsManagement.css';

const formatYesNoUnknown = (value) => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return 'Unknown';
};

const formatTermsAccepted = (value) => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return 'Legacy User';
};

const formatVerificationMethod = (value) => {
  if (value === 'OTP' || value === 'GOOGLE') return value;
  return 'Unknown';
};

const formatTermsVersion = (termsVersion, termsAccepted) => {
  if (termsVersion) return termsVersion;
  if (termsAccepted === null || termsAccepted === undefined) return 'Legacy User';
  return 'Unknown';
};

const sanitizeEntityList = (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object');
};

const safeText = (value, fallback = 'N/A') => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
};

const safeCount = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

const normalizeFirm = (firm, index) => {
  const safeFirm = (firm && typeof firm === 'object') ? firm : {};
  const fallbackId = `firm-${index}`;
  return {
    _id: safeText(safeFirm._id, fallbackId),
    firmId: safeText(safeFirm.firmId),
    name: safeText(safeFirm.name),
    adminEmail: safeText(safeFirm.adminEmail),
    status: safeText(safeFirm.status, 'UNKNOWN'),
    firmSlug: typeof safeFirm.firmSlug === 'string' && safeFirm.firmSlug.trim() ? safeFirm.firmSlug.trim() : null,
    emailVerified: safeFirm.emailVerified,
    verificationMethod: safeFirm.verificationMethod,
    emailVerifiedAt: safeFirm.emailVerifiedAt,
    termsAccepted: safeFirm.termsAccepted,
    termsVersion: safeFirm.termsVersion,
    termsAcceptedAt: safeFirm.termsAcceptedAt,
    clientCount: safeCount(safeFirm.clientCount),
    userCount: safeCount(safeFirm.userCount),
    createdAt: safeFirm.createdAt,
    signupIP: safeText(safeFirm.signupIP, 'Unknown'),
    signupUserAgent: safeText(safeFirm.signupUserAgent, 'Unknown'),
  };
};

const normalizeAdmin = (admin, index) => {
  const safeAdmin = (admin && typeof admin === 'object') ? admin : {};
  return {
    _id: safeText(safeAdmin._id, `admin-${index}`),
    name: safeText(safeAdmin.name),
    emailMasked: safeText(safeAdmin.emailMasked, safeText(safeAdmin.email)),
    status: safeText(safeAdmin.status, 'UNKNOWN'),
    isSystem: safeAdmin.isSystem === true,
    lastLoginAt: safeAdmin.lastLoginAt,
  };
};

const hasValidId = (value) => typeof value === 'string' && value.trim().length > 0;

export const FirmsManagement = () => {
  const toast = useToast();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [firms, setFirms] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    adminName: '',
    adminEmail: '',
  });

  // Resend admin access state
  const [resendConfirm, setResendConfirm] = useState({ open: false, firm: null });
  const [isResending, setIsResending] = useState(false);
  const [isForcingReset, setIsForcingReset] = useState(false);
  const [isUpdatingAdminStatus, setIsUpdatingAdminStatus] = useState(false);
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const [isDeletingAdmin, setIsDeletingAdmin] = useState(false);
  const [adminModal, setAdminModal] = useState({
    open: false,
    loading: false,
    firm: null,
    details: [],
    addForm: { name: '', email: '' },
  });

  // Actions dropdown state
  const [openDropdownId, setOpenDropdownId] = useState(null);

  // Load firms
  useEffect(() => {
    loadFirms();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      const hasElementApi = typeof Element !== 'undefined';
      if (!hasElementApi || !(e?.target instanceof Element)) {
        setOpenDropdownId(null);
        return;
      }
      const clickedInsideDropdown = Boolean(
        typeof e.target.closest === 'function' &&
        e.target.closest('.firm-actions__dropdown-wrap')
      );
      if (!clickedInsideDropdown) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadFirms = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await superadminService.listFirms();
      
      // HTTP 304 means cached data is still valid - keep current state
      if (response?.status !== 304) {
        if (response?.success) {
          setFirms(sanitizeEntityList(response.data));
        } else {
          // Ensure UI can render with safe defaults even on API failure
          setFirms([]);
          setError('Failed to load firms');
          toast.error('Failed to load firms');
        }
      }
    } catch (error) {
      // Don't reset firms on error - preserve existing data
      setError('Failed to load firms');
      toast.error('Failed to load firms');
      console.error('Error loading firms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFirm = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.adminName.trim() || !formData.adminEmail.trim()) {
      toast.error('All fields are required');
      return;
    }
    
    try {
      setIsSubmitting(true);
      const response = await superadminService.createFirm(
        formData.name.trim(),
        formData.adminName.trim(),
        formData.adminEmail.trim()
      );

      if (!response) {
        throw new Error('Invalid response');
      }

      if (response.success) {
        toast.success('Firm created successfully. Admin credentials have been emailed.');
        setFormData({ name: '', adminName: '', adminEmail: '' });
        setShowCreateModal(false);
        await loadFirms();
      } else {
        throw new Error(response.message || 'Failed to create firm');
      }
    } catch (error) {
      console.error('Create firm failed:', error);
      toast.error(error.response?.data?.message || 'Failed to create firm');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleFirmStatus = async (firmId, currentStatus) => {
    try {
      let response;
      if (currentStatus === 'ACTIVE') {
        response = await superadminService.deactivateFirm(firmId);
      } else {
        response = await superadminService.activateFirm(firmId);
      }
      if (response.success) {
        const updatedFirm = response.data;
        toast.success(`Firm ${updatedFirm.status === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`);
        setFirms(prev => prev.map(f => f._id === updatedFirm._id ? { ...f, ...updatedFirm } : f));
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Activation failed');
    }
  };

  const handleResendAdminAccess = async () => {
    const firm = resendConfirm.firm;
    if (!firm || !hasValidId(firm._id)) {
      toast.error('Firm information is unavailable');
      return;
    }

    try {
      setIsResending(true);
      const response = await superadminService.resendAdminAccess(firm._id);
      if (response.success) {
        const actionLabel = response.action === 'INVITE_RESENT' ? 'Invite resent' : 'Password reset sent';
        toast.success(`${actionLabel} to ${response.emailMasked}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to resend admin access');
    } finally {
      setIsResending(false);
      setResendConfirm({ open: false, firm: null });
    }
  };

  const openAdminModal = async (firm) => {
      if (!firm || !hasValidId(firm._id)) {
        toast.error('Firm information is unavailable');
        return;
      }
      setAdminModal({
        open: true,
        loading: true,
        firm,
        details: [],
        addForm: { name: '', email: '' },
      });
    try {
      const response = await superadminService.listFirmAdmins(firm._id);
      if (response.success) {
        setAdminModal((prev) => ({
          ...prev,
          loading: false,
          details: sanitizeEntityList(response.data),
        }));
      }
    } catch (error) {
      setAdminModal((prev) => ({ ...prev, loading: false }));
      toast.error(error.response?.data?.message || 'Failed to load admin details');
    }
  };

  const handleForceReset = async (targetFirm, adminId) => {
    if (!targetFirm || !hasValidId(targetFirm._id)) {
      toast.error('Firm information is unavailable');
      return;
    }
    if (adminId !== undefined && !hasValidId(adminId)) {
      toast.error('Admin information is unavailable');
      return;
    }
    try {
      setIsForcingReset(true);
      const response = await superadminService.forceResetFirmAdmin(targetFirm._id, adminId);
      if (response.success) {
        toast.success(`Password reset forced for ${response.emailMasked}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to force password reset');
    } finally {
      setIsForcingReset(false);
    }
  };

  const handleSetAdminStatus = async (firm, adminId, nextStatus) => {
    if (!firm || !hasValidId(firm._id) || !hasValidId(adminId)) {
      toast.error('Admin information is unavailable');
      return;
    }
    try {
      setIsUpdatingAdminStatus(true);
      const response = await superadminService.updateFirmAdminStatus(firm._id, nextStatus, adminId);
      if (response.success) {
        toast.success(`Admin ${nextStatus === 'ACTIVE' ? 'enabled' : 'disabled'} successfully`);
        setAdminModal((prev) => ({
          ...prev,
          details: prev.details.map((admin) => (
            admin._id === adminId ? { ...admin, status: nextStatus } : admin
          )),
        }));
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update admin status');
    } finally {
      setIsUpdatingAdminStatus(false);
    }
  };

  const handleSetDefaultAdminStatus = async (firm, nextStatus) => {
    if (!firm || !hasValidId(firm._id)) {
      toast.error('Firm information is unavailable');
      return;
    }
    try {
      setIsUpdatingAdminStatus(true);
      const response = await superadminService.updateFirmAdminStatus(firm._id, nextStatus);
      if (response.success) {
        toast.success(`Admin ${nextStatus === 'ACTIVE' ? 'enabled' : 'disabled'} successfully`);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update admin status');
    } finally {
      setIsUpdatingAdminStatus(false);
    }
  };

  const handleAdminStatusChange = async (firm, adminId, currentStatus) => {
    const nextStatus = currentStatus === 'DISABLED' ? 'ACTIVE' : 'DISABLED';
    return handleSetAdminStatus(firm, adminId, nextStatus);
  };

  const handleCreateAdditionalAdmin = async () => {
    if (!adminModal.firm || !hasValidId(adminModal.firm._id)) {
      toast.error('Firm information is unavailable');
      return;
    }
    if (!adminModal.addForm.name.trim() || !adminModal.addForm.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminModal.addForm.email.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }
    try {
      setIsCreatingAdmin(true);
      const response = await superadminService.createFirmAdmin(adminModal.firm._id, {
        name: adminModal.addForm.name.trim(),
        email: adminModal.addForm.email.trim(),
      });
      if (response.success) {
        toast.success('Admin created successfully');
        await openAdminModal(adminModal.firm);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create admin');
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (adminId) => {
    if (!adminModal.firm || !hasValidId(adminModal.firm._id) || !hasValidId(adminId)) {
      toast.error('Admin information is unavailable');
      return;
    }
    try {
      setIsDeletingAdmin(true);
      const response = await superadminService.deleteFirmAdmin(adminModal.firm._id, adminId);
      if (response.success) {
        toast.success('Admin deleted successfully');
        setAdminModal((prev) => ({
          ...prev,
          details: prev.details.filter((admin) => admin._id !== adminId),
        }));
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete admin');
    } finally {
      setIsDeletingAdmin(false);
    }
  };

  if (loading) {
    return (
      <SuperAdminLayout>
        <Loading message="Loading firms..." />
      </SuperAdminLayout>
    );
  }

  if (error && (!firms || !Array.isArray(firms) || firms.length === 0)) {
    return (
      <SuperAdminLayout>
        <div className="page-container">
          <Card className="center-card">
            <h2>Unable to load firms</h2>
            <p className="text-secondary-dark">Please retry in a moment.</p>
            <Button onClick={loadFirms}>Retry</Button>
          </Card>
        </div>
      </SuperAdminLayout>
    );
  }

  if (!firms || !Array.isArray(firms)) {
    return (
      <SuperAdminLayout>
        <div className="page-container">
          <Card className="center-card">
            <h2>No firms found</h2>
            <p className="text-secondary-dark">There is no valid firms data to render yet.</p>
          </Card>
        </div>
      </SuperAdminLayout>
    );
  }

  const normalizedFirms = sanitizeEntityList(firms).map(normalizeFirm);
  const normalizedAdmins = sanitizeEntityList(adminModal.details).map(normalizeAdmin);
  const modalFirm = normalizeFirm(adminModal.firm, 0);

  return (
    <ErrorBoundary name="FirmsManagementPage">
      <SuperAdminLayout>
      <div className="page-container">
        <div className="firms-management">
          <div className="page-header">
            <div>
              <h1>Firms Management</h1>
              <p className="text-secondary">Admin-created firms</p>
            </div>
            <div className="page-header-actions">
              <Button variant="secondary" onClick={() => navigate('/app/superadmin')}>
                Platform Dashboard
              </Button>
              <Button onClick={() => setShowCreateModal(true)}>
                + Create Firm
              </Button>
            </div>
          </div>

        {/* Create Firm Modal */}
        {showCreateModal && (
          <div className="modal-overlay">
            <Card className="modal-card">
              <div className="modal-header">
                <h2>Create New Firm</h2>
                <button 
                  className="modal-close"
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({ name: '', adminName: '', adminEmail: '' });
                    setIsSubmitting(false);
                  }}
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleCreateFirm} className="modal-form space-y-4">
                <p className="text-sm text-gray-500">Fields marked with * are required.</p>
                <Input
                  label="Firm Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Enter firm name"
                />
                <Input
                  label="Primary Admin Name"
                  value={formData.adminName}
                  onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                  required
                  placeholder="Enter primary admin name"
                />
                <Input
                  label="Primary Admin Email"
                  type="email"
                  value={formData.adminEmail}
                  onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  required
                  placeholder="primary.admin@example.com"
                />
                <div className="modal-actions">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create Firm'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowCreateModal(false);
                      setFormData({ name: '', adminName: '', adminEmail: '' });
                      setIsSubmitting(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Resend Admin Access Confirmation */}
        <ConfirmDialog
          isOpen={resendConfirm.open}
          title="Resend Admin Access Email"
          message={`Send a new access email to the admin of "${safeText(resendConfirm.firm?.name)}"? This will invalidate any previously sent links.`}
          confirmText="Resend"
          cancelText="Cancel"
          loading={isResending}
          onConfirm={handleResendAdminAccess}
          onCancel={() => setResendConfirm({ open: false, firm: null })}
        />

        {/* View Admin Modal */}
        {adminModal.open && (
          <div className="modal-overlay">
            <Card className="modal-card">
              <div className="modal-header">
                 <h2>Admin Management</h2>
                 <button
                   className="modal-close"
                   onClick={() => setAdminModal({ open: false, loading: false, firm: null, details: [], addForm: { name: '', email: '' } })}
                 >
                   ×
                 </button>
               </div>
                {adminModal.loading ? (
                  <Loading message="Loading admin details..." />
                ) : (
                  <div className="admin-details">
                    <div className="admin-audit-grid">
                      <div className="admin-audit-card">
                        <h3>Admin Account</h3>
                        <p><strong>Email:</strong> {modalFirm.adminEmail}</p>
                        <p><strong>Email Verified:</strong> {formatYesNoUnknown(modalFirm.emailVerified)}</p>
                        <p><strong>Verification Method:</strong> {formatVerificationMethod(modalFirm.verificationMethod)}</p>
                        <p><strong>Verified At:</strong> {formatDate(modalFirm.emailVerifiedAt)}</p>
                      </div>
                      <div className="admin-audit-card">
                        <h3>Legal Consent</h3>
                        <p><strong>Terms Accepted:</strong> {formatTermsAccepted(modalFirm.termsAccepted)}</p>
                        <p><strong>Terms Version:</strong> {formatTermsVersion(modalFirm.termsVersion, modalFirm.termsAccepted)}</p>
                        <p><strong>Accepted At:</strong> {formatDate(modalFirm.termsAcceptedAt)}</p>
                      </div>
                      <div className="admin-audit-card">
                        <h3>Signup Metadata</h3>
                        <p><strong>Signup IP:</strong> {modalFirm.signupIP}</p>
                        <p><strong>User Agent:</strong> {modalFirm.signupUserAgent}</p>
                      </div>
                    </div>
                    <div className="w-full overflow-x-auto">
                      <table className="firms-table admin-table min-w-[1000px] w-full">
                       <thead>
                         <tr>
                           <th>Name</th>
                           <th>Email</th>
                           <th>Status</th>
                           <th>System</th>
                           <th>Last Login</th>
                           <th>Actions</th>
                         </tr>
                       </thead>
                       <tbody>
                         {normalizedAdmins.map((admin) => {
                           const isAdminDisabled = admin.status === 'DISABLED';
                           return (
                             <tr key={admin._id}>
                               <td>{admin.name}</td>
                               <td>{admin.emailMasked}</td>
                               <td>
                                 <span className={`status-badge status-badge--admin-${String(admin.status || '').toLowerCase()}`}>
                                   {admin.status}
                                 </span>
                               </td>
                               <td>{admin.isSystem ? 'Yes' : 'No'}</td>
                               <td>{formatDate(admin.lastLoginAt)}</td>
                               <td>
                                 <div className="admin-table__actions">
                                   <Button
                                     size="small"
                                     variant={isAdminDisabled ? 'primary' : 'danger'}
                                     onClick={() => handleAdminStatusChange(adminModal.firm, admin._id, admin.status)}
                                     disabled={isUpdatingAdminStatus}
                                   >
                                     {isAdminDisabled ? 'Enable' : 'Disable'}
                                   </Button>
                                   <Button
                                     size="small"
                                     variant="secondary"
                                     onClick={() => handleForceReset(adminModal.firm, admin._id)}
                                     disabled={isForcingReset}
                                   >
                                     Force Reset
                                   </Button>
                                   {!admin.isSystem && (
                                     <Button
                                       size="small"
                                       variant="danger"
                                       onClick={() => handleDeleteAdmin(admin._id)}
                                       disabled={isDeletingAdmin}
                                     >
                                       Delete
                                     </Button>
                                   )}
                                 </div>
                               </td>
                             </tr>
                           );
                         })}
                       </tbody>
                     </table>
                   </div>
                   <div className="admin-add-form">
                     <Input
                       label="Admin Name"
                       value={adminModal.addForm.name}
                       onChange={(e) => setAdminModal((prev) => ({
                         ...prev,
                         addForm: { ...prev.addForm, name: e.target.value },
                       }))}
                       placeholder="Enter admin name"
                     />
                     <Input
                       label="Admin Email"
                       type="email"
                       value={adminModal.addForm.email}
                       onChange={(e) => setAdminModal((prev) => ({
                         ...prev,
                         addForm: { ...prev.addForm, email: e.target.value },
                       }))}
                       placeholder="admin@example.com"
                     />
                     <Button onClick={handleCreateAdditionalAdmin} disabled={isCreatingAdmin}>
                       {isCreatingAdmin ? 'Adding...' : '+ Add Admin'}
                     </Button>
                   </div>
                   <div className="modal-actions">
                     <Button variant="secondary" onClick={() => openAdminModal(adminModal.firm)}>
                       Refresh
                     </Button>
                   </div>
                 </div>
               )}
             </Card>
           </div>
        )}

        {/* Firms Table */}
        {firms.length === 0 ? (
          <Card className="empty-state center-card">
            <div className="empty-state__icon">🏢</div>
            <h2>No firms exist yet</h2>
            <p>This is expected for a new platform. Create your firm or join an existing one.</p>
            <Button onClick={() => setShowCreateModal(true)}>
              + Create Firm
            </Button>
          </Card>
        ) : (
          <Card>
            <div className="w-full overflow-x-auto">
              <table className="firms-table min-w-[1000px] w-full">
                <thead>
                  <tr>
                     <th>Firm Name</th>
                     <th>Admin Email</th>
                     <th>Status</th>
                     <th>Firm Login URL</th>
                     <th>Email Verified</th>
                     <th>Verification Method</th>
                     <th>Verified At</th>
                     <th>Terms Accepted</th>
                     <th>Terms Version</th>
                     <th>Accepted At</th>
                     <th>Clients</th>
                     <th>Users</th>
                     <th>Created On</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {normalizedFirms.map((firm) => {
                    const statusInfo = getFirmStatusInfo(firm.status);
                    const { label: statusLabel, key: statusKey, isActive } = statusInfo;
                    const canActivate = statusInfo.normalizedStatus === 'INACTIVE' || statusInfo.normalizedStatus === 'SUSPENDED';
                    const origin = typeof window !== 'undefined' && window.location?.origin
                      ? window.location.origin
                      : '';
                    const loginUrl = firm.firmSlug && origin
                      ? `${origin}/${firm.firmSlug}/login`
                      : null;
                    return (
                      <tr key={firm._id}>
                        <td>
                          <div className="firm-name">
                            <div className="firm-name__primary">{firm.name}</div>
                            <div className="firm-name__secondary">{firm.firmId}</div>
                          </div>
                        </td>
                        <td>{firm.adminEmail || 'N/A'}</td>
                        <td>
                          <span className={`status-badge status-badge--${statusKey}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td>
                          {loginUrl ? (
                            <a 
                              href={loginUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="firm-login-url"
                              title="Open firm login page in new tab"
                            >
                              /{firm.firmSlug}/login
                            </a>
                          ) : (
                            <span className="text-secondary">N/A</span>
                          )}
                        </td>
                        <td>{formatYesNoUnknown(firm.emailVerified)}</td>
                        <td>{formatVerificationMethod(firm.verificationMethod)}</td>
                        <td>{formatDate(firm.emailVerifiedAt)}</td>
                        <td>{formatTermsAccepted(firm.termsAccepted)}</td>
                        <td>{formatTermsVersion(firm.termsVersion, firm.termsAccepted)}</td>
                        <td>{formatDate(firm.termsAcceptedAt)}</td>
                        <td>{firm.clientCount ?? 0}</td>
                        <td>{firm.userCount ?? 0}</td>
                        <td>{formatDate(firm.createdAt)}</td>
                        <td>
                          <div className="firm-actions">
                            {isActive ? (
                              <Button
                                size="small"
                                variant="danger"
                                onClick={() => handleToggleFirmStatus(firm._id, firm.status)}
                              >
                                Deactivate
                              </Button>
                            ) : (
                              <Button
                                size="small"
                                variant="success"
                                disabled={!canActivate}
                                onClick={() => handleToggleFirmStatus(firm._id, firm.status)}
                              >
                                Activate
                              </Button>
                            )}
                            <div className="firm-actions__dropdown-wrap">
                              <button
                                className="firm-actions__menu-btn"
                                title="More actions"
                                aria-label="More actions"
                                onClick={() => setOpenDropdownId(openDropdownId === firm._id ? null : firm._id)}
                              >
                                ⋮
                              </button>
                              {openDropdownId === firm._id && (
                                <div className="firm-actions__dropdown">
                                  <button
                                    className="firm-actions__dropdown-item"
                                    onClick={() => {
                                      setOpenDropdownId(null);
                                      openAdminModal(firm);
                                    }}
                                  >
                                     👤 Manage Admins
                                  </button>
                                  <button
                                    className="firm-actions__dropdown-item"
                                    onClick={() => {
                                      setOpenDropdownId(null);
                                      setResendConfirm({ open: true, firm });
                                    }}
                                  >
                                    ✉ Resend Admin Access Email
                                  </button>
                                  <button
                                    className="firm-actions__dropdown-item"
                                    onClick={async () => {
                                      setOpenDropdownId(null);
                                      await handleForceReset(firm);
                                    }}
                                  >
                                    🔒 Force Password Reset
                                  </button>
                                  <button
                                    className="firm-actions__dropdown-item"
                                    onClick={async () => {
                                      setOpenDropdownId(null);
                                      await handleSetDefaultAdminStatus(firm, 'DISABLED');
                                    }}
                                  >
                                    ⛔ Disable Admin
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
      </div>
      </SuperAdminLayout>
    </ErrorBoundary>
  );
};
