/**
 * Firms Management Page
 * SuperAdmin view for managing firms
 */

import React, { useState, useEffect } from 'react';
import { superadminService } from '../services/superadminService';
import { SuperAdminLayout } from '../components/common/SuperAdminLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Loading } from '../components/common/Loading';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useToast } from '../hooks/useToast';
import { formatDate, getFirmStatusInfo } from '../utils/formatters';
import './FirmsManagement.css';

export const FirmsManagement = () => {
  const toast = useToast();
  
  const [loading, setLoading] = useState(true);
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
  const [adminModal, setAdminModal] = useState({
    open: false,
    loading: false,
    firm: null,
    details: null,
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
      if (!e.target.closest('.firm-actions__dropdown-wrap')) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadFirms = async () => {
    try {
      setLoading(true);
      const response = await superadminService.listFirms();
      
      // HTTP 304 means cached data is still valid - keep current state
      if (response?.status !== 304) {
        if (response?.success) {
          setFirms(Array.isArray(response.data) ? response.data : []);
        } else {
          // Ensure UI can render with safe defaults even on API failure
          setFirms([]);
          toast.error('Failed to load firms');
        }
      }
    } catch (error) {
      // Don't reset firms on error - preserve existing data
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
      
      if (response.success) {
        toast.success('Firm created successfully. Admin credentials have been emailed.');
        setFormData({ name: '', adminName: '', adminEmail: '' });
        setShowCreateModal(false);
        await loadFirms();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create firm');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleFirmStatus = async (firmId, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    
    try {
      const response = await superadminService.updateFirmStatus(firmId, newStatus);
      if (response.success) {
        toast.success(`Firm ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`);
        loadFirms();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update firm status');
    }
  };

  const handleResendAdminAccess = async () => {
    const firm = resendConfirm.firm;
    if (!firm) return;

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
    setAdminModal({
      open: true,
      loading: true,
      firm,
      details: null,
    });
    try {
      const response = await superadminService.getFirmAdmin(firm._id);
      if (response.success) {
        setAdminModal((prev) => ({
          ...prev,
          loading: false,
          details: response.data,
        }));
      }
    } catch (error) {
      setAdminModal((prev) => ({ ...prev, loading: false }));
      toast.error(error.response?.data?.message || 'Failed to load admin details');
    }
  };

  const handleForceReset = async (targetFirm) => {
    try {
      setIsForcingReset(true);
      const response = await superadminService.forceResetFirmAdmin(targetFirm._id);
      if (response.success) {
        toast.success(`Password reset forced for ${response.emailMasked}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to force password reset');
    } finally {
      setIsForcingReset(false);
    }
  };

  const handleSetAdminStatus = async (firm, nextStatus) => {
    try {
      setIsUpdatingAdminStatus(true);
      const response = await superadminService.updateFirmAdminStatus(firm._id, nextStatus);
      if (response.success) {
        toast.success(`Admin ${nextStatus === 'ACTIVE' ? 'enabled' : 'disabled'} successfully`);
        setAdminModal((prev) => ({
          ...prev,
          details: prev.details ? { ...prev.details, status: nextStatus } : prev.details,
        }));
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update admin status');
    } finally {
      setIsUpdatingAdminStatus(false);
    }
  };

  const handleAdminStatusChange = async (firm, currentStatus) => {
    const nextStatus = currentStatus === 'DISABLED' ? 'ACTIVE' : 'DISABLED';
    return handleSetAdminStatus(firm, nextStatus);
  };

  if (loading) {
    return (
      <SuperAdminLayout>
        <Loading message="Loading firms..." />
      </SuperAdminLayout>
    );
  }

  const adminDetails = adminModal.details;
  const isAdminDisabled = adminDetails?.status === 'DISABLED';

  return (
    <SuperAdminLayout>
      <div className="firms-management">
        <div className="firms-management__header">
          <div>
            <h1>Firms Management</h1>
            <p className="text-secondary">Manage firms and their lifecycle on the platform</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            + Create Firm
          </Button>
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
              <form onSubmit={handleCreateFirm} className="modal-form">
                <Input
                  label="Firm Name *"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Enter firm name"
                />
                <Input
                  label="Admin Name *"
                  value={formData.adminName}
                  onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                  required
                  placeholder="Enter admin name"
                />
                <Input
                  label="Admin Email *"
                  type="email"
                  value={formData.adminEmail}
                  onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  required
                  placeholder="admin@example.com"
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
          message={`Send a new access email to the admin of "${resendConfirm.firm?.name}"? This will invalidate any previously sent links.`}
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
                <h2>Firm Admin Details</h2>
                <button
                  className="modal-close"
                  onClick={() => setAdminModal({ open: false, loading: false, firm: null, details: null })}
                >
                  ×
                </button>
              </div>
              {adminModal.loading ? (
                <Loading message="Loading admin details..." />
              ) : adminDetails ? (
                <div className="admin-details">
                  <div className="admin-details__row"><strong>Admin Name:</strong> {adminDetails.name}</div>
                  <div className="admin-details__row"><strong>Masked Email:</strong> {adminDetails.emailMasked}</div>
                  <div className="admin-details__row"><strong>xID:</strong> {adminDetails.xID}</div>
                  <div className="admin-details__row">
                    <strong>Status:</strong>{' '}
                    <span className={`status-badge status-badge--admin-${String(adminDetails.status || '').toLowerCase()}`}>
                      {adminDetails.status}
                    </span>
                  </div>
                  <div className="admin-details__row"><strong>Last Login:</strong> {formatDate(adminDetails.lastLoginAt)}</div>
                  <div className="admin-details__row"><strong>Invite Sent:</strong> {formatDate(adminDetails.inviteSentAt)}</div>
                  <div className="admin-details__row"><strong>Password Set:</strong> {formatDate(adminDetails.passwordSetAt)}</div>
                  <div className="admin-details__row"><strong>Lock Status:</strong> {adminDetails.isLocked ? 'Locked' : 'Not Locked'}</div>
                  <div className="modal-actions">
                    <Button
                      variant={isAdminDisabled ? 'primary' : 'danger'}
                      onClick={() => handleAdminStatusChange(adminModal.firm, adminDetails.status)}
                      disabled={isUpdatingAdminStatus}
                    >
                      {isUpdatingAdminStatus
                        ? 'Updating...'
                        : (isAdminDisabled ? 'Enable Admin' : 'Disable Admin')}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleForceReset(adminModal.firm)}
                      disabled={isForcingReset}
                    >
                      {isForcingReset ? 'Forcing Reset...' : 'Force Reset'}
                    </Button>
                  </div>
                </div>
              ) : (
                <p>Admin details unavailable.</p>
              )}
            </Card>
          </div>
        )}

        {/* Firms Table */}
        {firms.length === 0 ? (
          <Card className="empty-state">
            <div className="empty-state__icon">🏢</div>
            <h2>No firms exist yet</h2>
            <p>This is expected for a new platform. Create your first firm to begin.</p>
            <Button onClick={() => setShowCreateModal(true)}>
              + Create Firm
            </Button>
          </Card>
        ) : (
          <Card>
            <div className="table-container">
              <table className="firms-table">
                <thead>
                  <tr>
                    <th>Firm Name</th>
                    <th>Status</th>
                    <th>Firm Login URL</th>
                    <th>Clients</th>
                    <th>Users</th>
                    <th>Created On</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {firms.map(firm => {
                    const { label: statusLabel, key: statusKey, isActive } = getFirmStatusInfo(firm.status);
                    const loginUrl = firm.firmSlug
                      ? `${window.location.origin}/f/${firm.firmSlug}/login`
                      : null;
                    return (
                      <tr key={firm._id}>
                        <td>
                          <div className="firm-name">
                            <div className="firm-name__primary">{firm.name}</div>
                            <div className="firm-name__secondary">{firm.firmId}</div>
                          </div>
                        </td>
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
                              /f/{firm.firmSlug}/login
                            </a>
                          ) : (
                            <span className="text-secondary">N/A</span>
                          )}
                        </td>
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
                                    👤 View Admin
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
                                      await handleSetAdminStatus(firm, 'DISABLED');
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
    </SuperAdminLayout>
  );
};
