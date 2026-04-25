/**
 * Admin Page
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PlatformShell } from '../components/platform/PlatformShell';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { TableSkeleton } from '../components/common/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/layout/PageHeader';
import { adminApi } from '../api/admin.api';
import { categoryService } from '../services/categoryService';
import { clientApi } from '../api/client.api';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { BulkUploadModal } from '../components/bulk/BulkUploadModal';
import { ActionConfirmModal } from '../components/common/ActionConfirmModal';
import { buildTemplateCsv } from '../constants/bulkUploadSchema';
import {
  EMPTY_ADMIN_STATS,
  TOAST_DEDUPLICATION_WINDOW_MS,
  EMPTY_FIELD_PLACEHOLDER,
  looksEncryptedToken,
  normalizeCategory,
  parseDelimitedLine,
  getApiErrorType,
  getNormalizedUserStatus,
  isPrimaryAdminUser,
} from './admin/adminPageUtils';
import { AdminUsersSection } from './admin/components/AdminUsersSection';
import { CreateUserModal } from './admin/components/CreateUserModal';
import { UserAccessModal } from './admin/components/UserAccessModal';
import { AdminClientsSection } from './admin/components/AdminClientsSection';
import { AdminCategoriesSection } from './admin/components/AdminCategoriesSection';
import { AdminBulkPasteModal } from './admin/components/AdminBulkPasteModal';
import { AdminCategoryModals } from './admin/components/AdminCategoryModals';
import { AdminClientModals } from './admin/components/AdminClientModals';
import { useAdminDataLoader } from './admin/hooks/useAdminDataLoader';
import './AdminPage.css';

const downloadBulkTemplate = (type) => {
  const blob = new Blob([buildTemplateCsv(type)], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${type}-bulk-template.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const StatusBadge = ({ status }) => {
  const normalizedStatus = String(status || '').toUpperCase();
  const map = {
    ACTIVE: 'Approved',
    INVITED: 'Pending',
    INACTIVE: 'Rejected',
    DISABLED: 'Rejected',
  };
  return <Badge status={map[normalizedStatus] || 'Pending'}>{normalizedStatus || EMPTY_FIELD_PLACEHOLDER}</Badge>;
};

export const AdminPage = () => {
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const { showToast } = useToast();
  const { user: loggedInUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isWorkSettingsContext = searchParams.get('context') === 'work-settings';
  const isPrimaryAdminActor = useMemo(() => {
    const normalizedRole = String(loggedInUser?.role || '').trim().toUpperCase();
    return normalizedRole === 'PRIMARY_ADMIN' || Boolean(loggedInUser?.isPrimaryAdmin);
  }, [loggedInUser]);
  const isManagerActor = useMemo(() => String(loggedInUser?.role || '').trim().toUpperCase() === 'MANAGER', [loggedInUser]);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    const requestedTab = searchParams.get('tab');
    return ['users', 'categories', 'clients'].includes(requestedTab) ? requestedTab : 'users';
  });
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [clients, setClients] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [bulkUploadType, setBulkUploadType] = useState('clients');
  const [bulkPasteMode, setBulkPasteMode] = useState('categories');
  const [bulkPasteInput, setBulkPasteInput] = useState('');
  const [bulkPasteInProgress, setBulkPasteInProgress] = useState(false);
  const [showChangeNameModal, setShowChangeNameModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedUserForAccess, setSelectedUserForAccess] = useState(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [savingUserAccess, setSavingUserAccess] = useState(false);
  const [actionLoadingByUser, setActionLoadingByUser] = useState({});
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const [userSectionMessage, setUserSectionMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statsEmpty, setStatsEmpty] = useState(false);
  const [statsFailed, setStatsFailed] = useState(false);
  const [tabError, setTabError] = useState(null);
  const toastLockRef = useRef({});
  const toastTimerRef = useRef({});
  
  // Admin stats (PR #41)
  const [adminStats, setAdminStats] = useState(EMPTY_ADMIN_STATS);
  const defaultClients = useMemo(
    () => clients.filter((client) => client.isDefaultClient || client.isSystemClient || client.isInternal),
    [clients]
  );
  const hasAdditionalClients = useMemo(
    () => clients.some((client) => !client.isDefaultClient && !client.isSystemClient && !client.isInternal),
    [clients]
  );

  // Create user form state (PR 32: xID is auto-generated, not user-provided)
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: '',
    department: '',
    teamIds: [],
    assignQcWorkbaskets: false,
  });
  
  // Category form state
  const [categoryForm, setCategoryForm] = useState({
    name: '',
  });
  
  // Subcategory form state
  const [subcategoryForm, setSubcategoryForm] = useState({
    name: '',
    workbasketId: '',
  });

  // Client form state
  const [clientForm, setClientForm] = useState({
    businessName: '',
    businessAddress: '',
    primaryContactNumber: '',
    secondaryContactNumber: '',
    businessEmail: '',
    PAN: '',
    GST: '',
    TAN: '',
    CIN: '',
    // Client Fact Sheet fields
    description: '',
    notes: '',
  });
  
  // Client Fact Sheet file upload state
  const [factSheetFiles, setFactSheetFiles] = useState([]);
  const [uploadingFactSheetFile, setUploadingFactSheetFile] = useState(false);
  
  // Change name form state
  const [changeNameForm, setChangeNameForm] = useState({
    newBusinessName: '',
    reason: '',
  });
  const [restrictedClientDraft, setRestrictedClientDraft] = useState([]);
  const [workbaskets, setWorkbaskets] = useState([]);
  const [selectedWorkbasketDraft, setSelectedWorkbasketDraft] = useState([]);
  const filteredUsers = useMemo(() => users, [users]);
  const filteredClientsList = useMemo(() => clients, [clients]);
  const workbasketNameById = useMemo(() => (
    new Map(
      (workbaskets || []).map((workbasket) => [String(workbasket?._id), String(workbasket?.name || '')]),
    )
  ), [workbaskets]);
  const primaryWorkbaskets = useMemo(
    () => (workbaskets || []).filter((wb) => String(wb?.type || 'PRIMARY').toUpperCase() !== 'QC'),
    [workbaskets],
  );
  const qcOnlyWorkbaskets = useMemo(
    () => (workbaskets || []).filter((wb) => String(wb?.type || '').toUpperCase() === 'QC'),
    [workbaskets],
  );
  const setUserActionLoading = (xID, isLoading) => {
    if (!xID) return;
    setActionLoadingByUser((prev) => ({
      ...prev,
      [xID]: isLoading,
    }));
  };

  const closePendingConfirmation = () => {
    setPendingConfirmation(null);
  };

  const openActionConfirmation = ({
    title,
    description,
    confirmText = 'Confirm',
    danger = false,
    loadingKey = null,
    onConfirm,
  }) => {
    setPendingConfirmation({
      title,
      description,
      confirmText,
      danger,
      loadingKey,
      onConfirm,
    });
  };

  const isConfirmActionLoading = Boolean(
    pendingConfirmation?.loadingKey && actionLoadingByUser[pendingConfirmation.loadingKey],
  );

  useEffect(() => {
    loadAdminStats();
    loadAdminData();
  }, [activeTab]);


  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    const allowedTabs = isWorkSettingsContext ? ['categories'] : ['users'];
    const fallbackTab = isWorkSettingsContext ? 'categories' : 'users';

    const nextTab = allowedTabs.includes(requestedTab) ? requestedTab : fallbackTab;
    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [searchParams, activeTab, isWorkSettingsContext]);

  useEffect(() => {
    return () => {
      Object.values(toastTimerRef.current).forEach((timerId) => {
        clearTimeout(timerId);
      });
    };
  }, []);

  const showGroupedLoadToast = (groupKey, message) => {
    if (toastLockRef.current[groupKey]) return;
    toastLockRef.current[groupKey] = true;
    showToast(message, 'error');
    toastTimerRef.current[groupKey] = setTimeout(() => {
      toastLockRef.current[groupKey] = false;
      delete toastTimerRef.current[groupKey];
    }, TOAST_DEDUPLICATION_WINDOW_MS);
  };

  const notifyLoadError = (error, groupKey) => {
    const errorType = getApiErrorType(error);
    if (errorType === 'empty') {
      return errorType;
    }

    if (errorType === 'permission') {
      showGroupedLoadToast(groupKey, 'You do not have permission');
    } else if (errorType === 'server' || errorType === 'unknown') {
      showGroupedLoadToast(groupKey, 'Something went wrong. Please try again.');
    } else if (errorType === 'network') {
      showGroupedLoadToast(groupKey, 'Unable to connect to server');
    }

    return errorType;
  };

  const ensureLoggedInAdminVisible = (loadedUsers = []) => {
    if (!loggedInUser || !loggedInUser.xID) {
      return loadedUsers;
    }

    const hasLoggedInUser = loadedUsers.some((user) => user?.xID === loggedInUser.xID);
    if (hasLoggedInUser) {
      return loadedUsers;
    }

    const fallbackAdminUser = {
      _id: loggedInUser.id || loggedInUser._id || loggedInUser.userId || loggedInUser.xID,
      id: loggedInUser.id || loggedInUser._id || loggedInUser.userId || loggedInUser.xID,
      xID: loggedInUser.xID,
      name: loggedInUser.name || loggedInUser.fullName || EMPTY_FIELD_PLACEHOLDER,
      email: loggedInUser.email || '',
      role: loggedInUser.role || 'ADMIN',
      status: loggedInUser.status || 'active',
      isActive: loggedInUser.status ? String(loggedInUser.status).toLowerCase() === 'active' : true,
      isSystem: Boolean(loggedInUser.isSystem),
      isPrimaryAdmin: Boolean(loggedInUser.isPrimaryAdmin || loggedInUser.isAdmin),
      passwordConfigured: true,
      restrictedClientIds: Array.isArray(loggedInUser.restrictedClientIds) ? loggedInUser.restrictedClientIds : [],
      firm: {
        name: loggedInUser.firmName || loggedInUser.firm?.name || null,
      },
    };

    return [fallbackAdminUser, ...loadedUsers];
  };

  const {
    fetchClients,
    fetchWorkbaskets,
    loadAdminStats,
    loadAdminData,
  } = useAdminDataLoader({
    activeTab,
    ensureLoggedInAdminVisible,
    notifyLoadError,
    setLoading,
    setTabError,
    setUsers,
    setCategories,
    setClients,
    setWorkbaskets,
    setAdminStats,
    setStatsEmpty,
    setStatsFailed,
  });

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (creatingUser) return;
    if (!isPrimaryAdminActor) {
      showToast('Only PRIMARY_ADMIN can modify hierarchy', 'error');
      return;
    }
    
    // PR 32: Only name and email are required (xID is auto-generated)
    if (!newUser.name || !newUser.email || !newUser.role || !Array.isArray(newUser.teamIds) || newUser.teamIds.length === 0) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    setCreatingUser(true);

    try {
      const response = await adminApi.createUser(newUser);
      
      if (response.success) {
        showToast(`User invited successfully! xID: ${response.data?.xID}.`, 'success');
        setUserSectionMessage(`User invite sent to ${newUser.email}.`);
        setShowCreateModal(false);
        setNewUser({
          name: '', email: '', role: '', department: '', teamIds: [], assignQcWorkbaskets: false,
        });
        await Promise.all([loadAdminStats(), loadAdminData()]);
      } else {
        showToast(response.message || 'Failed to create user', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to create user', 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleToggleUserStatus = async (user) => {
    if (!isPrimaryAdminActor) {
      showToast('Only PRIMARY_ADMIN can modify hierarchy', 'error');
      return;
    }
    if (isPrimaryAdminUser(user)) {
      showToast('Primary admin cannot be deactivated', 'error');
      return;
    }
    const normalizedStatus = getNormalizedUserStatus(user);
    const isInvited = normalizedStatus === 'invited';
    const shouldActivate = isInvited ? false : normalizedStatus !== 'active';
    const action = isInvited ? 'cancel invite for' : (shouldActivate ? 'activate' : 'deactivate');
    const confirmationMessage = isInvited
      ? `Cancel invite for ${user?.name || user?.email || 'this user'}?`
      : `Are you sure you want to ${shouldActivate ? 'activate' : 'deactivate'} ${user?.name || user?.email || 'this user'}?`;

    openActionConfirmation({
      title: isInvited ? 'Cancel Invite' : `${shouldActivate ? 'Activate' : 'Deactivate'} Employee`,
      description: confirmationMessage,
      confirmText: isInvited ? 'Cancel Invite' : (shouldActivate ? 'Activate' : 'Deactivate'),
      danger: !shouldActivate || isInvited,
      loadingKey: user.xID,
      onConfirm: async () => {
        try {
          setUserActionLoading(user.xID, true);
          const response = await adminApi.updateUserStatus(user.xID, shouldActivate);
          
          if (response.success) {
            showToast(isInvited ? 'Invite cancelled successfully' : `User ${action}d successfully`, 'success');
            setUserSectionMessage(`User ${user?.name || user?.email || user?.xID} ${shouldActivate ? 'activated' : (isInvited ? 'invite cancelled' : 'deactivated')} successfully.`);
            await Promise.all([loadAdminStats(), loadAdminData()]);
            closePendingConfirmation();
          } else {
            showToast(response.message || (isInvited ? 'Failed to cancel invite' : `Failed to ${action} user`), 'error');
          }
        } catch (error) {
          showToast(error.response?.data?.message || (isInvited ? 'Failed to cancel invite' : `Failed to ${action} user`), 'error');
        } finally {
          setUserActionLoading(user.xID, false);
        }
      },
    });
  };

  const handleResendSetupEmail = async (xID) => {
    try {
      setUserActionLoading(xID, true);
      const response = await adminApi.resendSetupEmail(xID);
      
      if (response.success) {
        showToast('Invite email sent successfully', 'success');
        setUserSectionMessage('Invite email sent successfully.');
        await loadAdminData();
      } else {
        showToast(response.message || 'Failed to send email', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to send email', 'error');
    } finally {
      setUserActionLoading(xID, false);
    }
  };

  const handleUnlockAccount = async (xID) => {
    openActionConfirmation({
      title: 'Unlock Account',
      description: 'Unlock this account now?',
      confirmText: 'Unlock',
      loadingKey: xID,
      onConfirm: async () => {
        try {
          setUserActionLoading(xID, true);
          const response = await adminApi.unlockAccount(xID);
          
          if (response.success) {
            showToast('Account unlocked successfully', 'success');
            setUserSectionMessage('Account unlocked successfully.');
            await loadAdminData();
            closePendingConfirmation();
          } else {
            showToast(response.message || 'Failed to unlock account', 'error');
          }
        } catch (error) {
          showToast(error.response?.data?.message || 'Failed to unlock account', 'error');
        } finally {
          setUserActionLoading(xID, false);
        }
      },
    });
  };

  const handleSendPasswordReset = async (user) => {
    openActionConfirmation({
      title: 'Send Password Reset',
      description: `Send a password reset link to ${user?.email || 'this user'}?`,
      confirmText: 'Send Reset Link',
      loadingKey: user?.xID,
      onConfirm: async () => {
        try {
          setUserActionLoading(user?.xID, true);
          const response = await adminApi.resetPassword(user.xID);
          if (response.success) {
            showToast(`Password reset link sent to ${user.email}`, 'success');
            setUserSectionMessage(`Password reset link sent to ${user.email}.`);
            await loadAdminData();
            closePendingConfirmation();
          } else {
            showToast(response.message || 'Failed to send password reset link', 'error');
          }
        } catch (error) {
          showToast(error.response?.data?.message || 'Failed to send password reset link', 'error');
        } finally {
          setUserActionLoading(user?.xID, false);
        }
      },
    });
  };

  const handleOpenAccessModal = async (user) => {
    try {
      await Promise.all([fetchClients(), fetchWorkbaskets()]);
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to load clients', 'error');
      return;
    }

    setSelectedUserForAccess(user);
    setRestrictedClientDraft(Array.isArray(user.restrictedClientIds) ? user.restrictedClientIds : []);
    setSelectedWorkbasketDraft(
      Array.isArray(user.teamIds) && user.teamIds.length > 0
        ? user.teamIds.map((id) => String(id))
        : (user.teamId ? [String(user.teamId)] : [])
    );
    setShowAccessModal(true);
  };

  const isClientAllowedForDraft = (clientId) => !restrictedClientDraft.includes(clientId);

  const handleToggleClientAccess = (clientId) => {
    setRestrictedClientDraft((prev) => (
      prev.includes(clientId)
        ? prev.filter((id) => id !== clientId)
        : [...prev, clientId]
    ));
  };

  const handleSaveUserAccess = async () => {
    if (!selectedUserForAccess) return;
    setSavingUserAccess(true);
    try {
      const [response, wbResponse] = await Promise.all([
        adminApi.updateRestrictedClients(selectedUserForAccess.xID, restrictedClientDraft),
        adminApi.updateUserWorkbaskets(selectedUserForAccess.xID, selectedWorkbasketDraft),
      ]);
      if (response.success && wbResponse.success) {
        showToast('User client docket access updated', 'success');
        setShowAccessModal(false);
        setSelectedUserForAccess(null);
        setSelectedWorkbasketDraft([]);
        await loadAdminData();
      } else {
        showToast(response.message || 'Failed to update user access', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to update user access', 'error');
    } finally {
      setSavingUserAccess(false);
    }
  };
  
  // Category Management Handlers
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    
    if (!categoryForm.name || !categoryForm.name.trim()) {
      showToast('Please enter a category name', 'error');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const response = await categoryService.createCategory(categoryForm.name.trim());
      
      if (response.success) {
        showToast('Category created successfully', 'success');
        setShowCategoryModal(false);
        setCategoryForm({ name: '' });
        loadAdminData();
      } else {
        showToast(response.message || 'Failed to create category', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to create category', 'error');
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleToggleCategoryStatus = async (category) => {
    const newStatus = !category.isActive;
    const action = newStatus ? 'enable' : 'disable';
    
    try {
      const response = await categoryService.toggleCategoryStatus(category._id, newStatus);
      
      if (response.success) {
        showToast(`Category ${action}d successfully`, 'success');
        loadAdminData();
      } else {
        showToast(response.message || `Failed to ${action} category`, 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || `Failed to ${action} category`, 'error');
    }
  };
  
  const handleAddSubcategory = async (e) => {
    e.preventDefault();
    
    if (!subcategoryForm.name || !subcategoryForm.name.trim()) {
      showToast('Please enter a subcategory name', 'error');
      return;
    }
    
    if (!selectedCategory) {
      showToast('No category selected', 'error');
      return;
    }
    if (!subcategoryForm.workbasketId) {
      showToast('Please select a workbasket', 'error');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const response = await categoryService.addSubcategory(
        selectedCategory._id,
        subcategoryForm.name.trim(),
        subcategoryForm.workbasketId,
      );
      
      if (response.success) {
        showToast('Subcategory added successfully', 'success');
        setShowSubcategoryModal(false);
        setSubcategoryForm({ name: '', workbasketId: '' });
        setSelectedCategory(null);
        loadAdminData();
      } else {
        showToast(response.message || 'Failed to add subcategory', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to add subcategory', 'error');
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleToggleSubcategoryStatus = async (category, subcategory) => {
    const newStatus = !subcategory.isActive;
    const action = newStatus ? 'enable' : 'disable';
    
    try {
      const response = await categoryService.toggleSubcategoryStatus(
        category._id,
        subcategory.id,
        newStatus
      );
      
      if (response.success) {
        showToast(`Subcategory ${action}d successfully`, 'success');
        loadAdminData();
      } else {
        showToast(response.message || `Failed to ${action} subcategory`, 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || `Failed to ${action} subcategory`, 'error');
    }
  };

  const handleDeleteCategory = async (category) => {
    if (!confirm(`Are you sure you want to delete category "${category.name}"? This is a soft delete - the category will be hidden from dropdowns but historical cases will remain valid.`)) {
      return;
    }
    
    try {
      const response = await categoryService.deleteCategory(category._id);
      
      if (response.success) {
        showToast('Category deleted successfully', 'success');
        loadAdminData();
      } else {
        showToast(response.message || 'Failed to delete category', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to delete category', 'error');
    }
  };

  const handleDeleteSubcategory = async (category, subcategory) => {
    if (!confirm(`Are you sure you want to delete subcategory "${subcategory.name}"? This is a soft delete - the subcategory will be hidden from dropdowns but historical cases will remain valid.`)) {
      return;
    }
    
    try {
      const response = await categoryService.deleteSubcategory(category._id, subcategory.id);
      
      if (response.success) {
        showToast('Subcategory deleted successfully', 'success');
        loadAdminData();
      } else {
        showToast(response.message || 'Failed to delete subcategory', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to delete subcategory', 'error');
    }
  };

  const handleOpenBulkPaste = (mode) => {
    setBulkPasteMode(mode);
    setBulkPasteInput('');
    setShowBulkPasteModal(true);
  };

  const handleOpenBulkUpload = (type) => {
    setBulkUploadType(type);
    setShowBulkUploadModal(true);
  };

  const handleBulkPasteSubmit = async (event) => {
    event.preventDefault();
    const rows = bulkPasteInput
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (rows.length === 0) {
      showToast('Paste at least one row before saving.', 'error');
      return;
    }

    setBulkPasteInProgress(true);
    let createdCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    try {
      if (bulkPasteMode === 'categories') {
        const existingCategoryNames = new Set(categories.map((entry) => entry.name.trim().toLowerCase()));

        for (const row of rows) {
          const [rawName] = parseDelimitedLine(row);
          const name = rawName?.trim();
          if (!name) {
            skippedCount += 1;
            continue;
          }
          const key = name.toLowerCase();
          if (existingCategoryNames.has(key)) {
            skippedCount += 1;
            continue;
          }

          try {
            await categoryService.createCategory(name);
            existingCategoryNames.add(key);
            createdCount += 1;
          } catch {
            failedCount += 1;
          }
        }
      }

      if (bulkPasteMode === 'subcategories') {
        const categoryIndex = new Map(
          categories.map((entry) => [entry.name.trim().toLowerCase(), entry])
        );
        const subcategoryIndex = new Map(
          categories.map((entry) => [
            entry.name.trim().toLowerCase(),
            new Set((entry.subcategories || []).map((sub) => sub.name.trim().toLowerCase())),
          ])
        );

        for (const row of rows) {
          const [rawCategoryName, rawSubcategoryName, rawWorkbasket] = parseDelimitedLine(row);
          const categoryName = rawCategoryName?.trim();
          const subcategoryName = rawSubcategoryName?.trim();
          const workbasketValue = rawWorkbasket?.trim();

          if (!categoryName || !subcategoryName || !workbasketValue) {
            skippedCount += 1;
            continue;
          }
          const normalizedWorkbasket = workbasketValue.toLowerCase();
          const matchedWorkbasket = workbaskets.find((workbasket) => {
            const byId = String(workbasket._id) === workbasketValue;
            const byName = String(workbasket.name || '').trim().toLowerCase() === normalizedWorkbasket;
            return byId || byName;
          });
          if (!matchedWorkbasket) {
            failedCount += 1;
            continue;
          }

          const categoryKey = categoryName.toLowerCase();
          let category = categoryIndex.get(categoryKey);

          if (!category) {
            try {
              await categoryService.createCategory(categoryName);
              const refreshed = await categoryService.getAdminCategories(false);
              const refreshedCategories = Array.isArray(refreshed?.data) ? refreshed.data.map(normalizeCategory).filter(Boolean) : [];
              refreshedCategories.forEach((entry) => {
                categoryIndex.set(entry.name.trim().toLowerCase(), entry);
                subcategoryIndex.set(
                  entry.name.trim().toLowerCase(),
                  new Set((entry.subcategories || []).map((sub) => sub.name.trim().toLowerCase()))
                );
              });
              category = categoryIndex.get(categoryKey);
            } catch {
              failedCount += 1;
              continue;
            }
          }

          const knownSubcategories = subcategoryIndex.get(categoryKey) || new Set();
          const subcategoryKey = subcategoryName.toLowerCase();
          if (knownSubcategories.has(subcategoryKey)) {
            skippedCount += 1;
            continue;
          }

          try {
            await categoryService.addSubcategory(category._id, subcategoryName, String(matchedWorkbasket._id));
            knownSubcategories.add(subcategoryKey);
            subcategoryIndex.set(categoryKey, knownSubcategories);
            createdCount += 1;
          } catch {
            failedCount += 1;
          }
        }
      }

      if (bulkPasteMode === 'clients') {
        const existingClientNames = new Set(clients.map((entry) => String(entry.businessName || '').trim().toLowerCase()));
        const rowsWithoutHeader = rows.filter((row, index) => {
          if (index !== 0) return true;
          const [firstCell] = parseDelimitedLine(row);
          return String(firstCell || '').trim().toLowerCase() !== 'businessname';
        });

        for (const row of rowsWithoutHeader) {
          const parsed = parseDelimitedLine(row);
          const isNewOrder = String(parsed[1] || '').includes('@');
          const [
            businessName,
            businessEmail,
            primaryContactNumber,
            businessAddress,
            PAN,
            CIN,
            TAN,
            GST,
            secondaryContactNumber,
          ] = isNewOrder
            ? parsed
            : [
              parsed[0],
              parsed[3],
              parsed[2],
              parsed[1],
              parsed[5],
              parsed[8],
              parsed[7],
              parsed[6],
              parsed[4],
            ];
          const requiredValues = [businessName, primaryContactNumber, businessEmail].map((value) => value?.trim());
          const [trimmedName, trimmedPrimary, trimmedEmail] = requiredValues;

          if (!trimmedName || !trimmedPrimary || !trimmedEmail) {
            skippedCount += 1;
            continue;
          }

          const clientKey = trimmedName.toLowerCase();
          if (existingClientNames.has(clientKey)) {
            skippedCount += 1;
            continue;
          }

          try {
            await clientApi.createClient({
              businessName: trimmedName,
              primaryContactNumber: trimmedPrimary,
              businessEmail: trimmedEmail,
              ...(businessAddress?.trim() && { businessAddress: businessAddress.trim() }),
              ...(secondaryContactNumber?.trim() && { secondaryContactNumber: secondaryContactNumber.trim() }),
              ...(PAN?.trim() && { PAN: PAN.trim() }),
              ...(GST?.trim() && { GST: GST.trim() }),
              ...(TAN?.trim() && { TAN: TAN.trim() }),
              ...(CIN?.trim() && { CIN: CIN.trim() }),
            });
            existingClientNames.add(clientKey);
            createdCount += 1;
          } catch {
            failedCount += 1;
          }
        }
      }

      await loadAdminData();
      showToast(`Bulk save complete: ${createdCount} created, ${skippedCount} skipped, ${failedCount} failed.`, failedCount > 0 ? 'warning' : 'success');
      if (createdCount > 0) {
        setShowBulkPasteModal(false);
        setBulkPasteInput('');
      }
    } finally {
      setBulkPasteInProgress(false);
    }
  };

  // Client Management Handlers
  const handleCreateClient = async (e) => {
    e.preventDefault();
    
    if (!clientForm.businessName || !clientForm.primaryContactNumber || !clientForm.businessEmail) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Explicit payload construction - DO NOT spread form state
      const payload = {
        businessName: clientForm.businessName,
        businessEmail: clientForm.businessEmail,
        primaryContactNumber: clientForm.primaryContactNumber,
        ...(clientForm.businessAddress && { businessAddress: clientForm.businessAddress }),
        ...(clientForm.secondaryContactNumber && { secondaryContactNumber: clientForm.secondaryContactNumber }),
        ...(clientForm.PAN && { PAN: clientForm.PAN }),
        ...(clientForm.TAN && { TAN: clientForm.TAN }),
        ...(clientForm.GST && { GST: clientForm.GST }),
        ...(clientForm.CIN && { CIN: clientForm.CIN }),
      };
      
      // Frontend safety assertion - detect deprecated fields
      if ('latitude' in payload || 'longitude' in payload || 'businessPhone' in payload) {
        throw new Error('Deprecated fields detected in client payload');
      }
      
      const response = await clientApi.createClient(payload);
      
      if (response.success) {
        showToast(`Client created successfully! Client ID: ${response.data?.clientId}`, 'success');
        await fetchClients();
        setShowClientModal(false);
        setClientForm({
          businessName: '',
          businessAddress: '',
          primaryContactNumber: '',
          secondaryContactNumber: '',
          businessEmail: '',
          PAN: '',
          GST: '',
          TAN: '',
          CIN: '',
        });
        loadAdminData();
      } else {
        showToast(response.message || 'Failed to create client', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || error.message || 'Failed to create client', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClient = async (client) => {
    setSelectedClient(client);
    setClientForm({
      businessName: client.businessName,
      businessAddress: client.businessAddress,
      primaryContactNumber: client.primaryContactNumber || '',
      secondaryContactNumber: client.secondaryContactNumber || '',
      businessEmail: client.businessEmail,
      PAN: client.PAN || '',
      GST: client.GST || '',
      TAN: client.TAN || '',
      CIN: client.CIN || '',
      description: client.clientFactSheet?.description || '',
      notes: client.clientFactSheet?.notes || '',
    });
    // Load existing files
    setFactSheetFiles(client.clientFactSheet?.files || []);
    setShowClientModal(true);
  };

  const handleUpdateClient = async (e) => {
    e.preventDefault();
    
    if (!selectedClient) {
      showToast('No client selected', 'error');
      return;
    }
    
    // Only allow updating email and contact numbers
    if (!clientForm.primaryContactNumber || !clientForm.businessEmail) {
      showToast('Primary contact number and business email are required', 'error');
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Only send editable fields to backend
      const updateData = {
        businessEmail: clientForm.businessEmail,
        primaryContactNumber: clientForm.primaryContactNumber,
        secondaryContactNumber: clientForm.secondaryContactNumber,
      };

      if (selectedClient.isDefaultClient || selectedClient.isSystemClient || selectedClient.isInternal) {
        updateData.businessName = clientForm.businessName;
        updateData.businessAddress = clientForm.businessAddress;
      }
      
      const response = await clientApi.updateClient(selectedClient.clientId, updateData);
      
      if (response.success) {
        // Also update fact sheet if description or notes changed
        if (clientForm.description || clientForm.notes) {
          await clientApi.updateClientFactSheet(
            selectedClient.clientId,
            clientForm.description,
            clientForm.notes
          );
        }
        
        showToast('Client updated successfully', 'success');
        setShowClientModal(false);
        setSelectedClient(null);
        setClientForm({
          businessName: '',
          businessAddress: '',
          primaryContactNumber: '',
          secondaryContactNumber: '',
          businessEmail: '',
          PAN: '',
          GST: '',
          TAN: '',
          CIN: '',
          description: '',
          notes: '',
        });
        setFactSheetFiles([]);
        loadAdminData();
      } else {
        showToast(response.message || 'Failed to update client', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to update client', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleClientStatus = async (client) => {
    // Use canonical status field (ACTIVE/INACTIVE)
    const isCurrentlyActive = client.status === 'ACTIVE';
    const newStatus = !isCurrentlyActive;
    const action = newStatus ? 'activate' : 'deactivate';
    
    try {
      const response = await clientApi.toggleClientStatus(client.clientId, newStatus);
      
      if (response.success) {
        showToast(`Client ${action}d successfully`, 'success');
        loadAdminData();
      } else {
        showToast(response.message || `Failed to ${action} client`, 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || `Failed to ${action} client`, 'error');
    }
  };

  // Client Fact Sheet File Handlers
  const handleUploadFactSheetFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClient) return;

    setUploadingFactSheetFile(true);
    try {
      const response = await clientApi.uploadFactSheetFile(selectedClient.clientId, file);
      
      if (response.success) {
        showToast('File uploaded successfully', 'success');
        // Add file to list
        setFactSheetFiles([...factSheetFiles, response.data]);
        // Clear file input
        e.target.value = '';
      } else {
        showToast(response.message || 'Failed to upload file', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to upload file', 'error');
    } finally {
      setUploadingFactSheetFile(false);
    }
  };

  const handleDeleteFactSheetFile = async (fileId) => {
    if (!selectedClient) return;
    
    if (!confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      const response = await clientApi.deleteFactSheetFile(selectedClient.clientId, fileId);
      
      if (response.success) {
        showToast('File deleted successfully', 'success');
        // Remove file from list
        setFactSheetFiles(factSheetFiles.filter(f => f.fileId !== fileId));
      } else {
        showToast(response.message || 'Failed to delete file', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to delete file', 'error');
    }
  };

  const handleOpenChangeNameModal = (client) => {
    setSelectedClient(client);
    setChangeNameForm({
      newBusinessName: '',
      reason: '',
    });
    setShowChangeNameModal(true);
  };

  const handleChangeLegalName = async (e) => {
    e.preventDefault();
    
    if (!selectedClient) {
      showToast('No client selected', 'error');
      return;
    }
    
    if (!changeNameForm.newBusinessName || !changeNameForm.newBusinessName.trim()) {
      showToast('New business name is required', 'error');
      return;
    }
    
    if (!changeNameForm.reason || !changeNameForm.reason.trim()) {
      showToast('Reason for name change is required for audit compliance', 'error');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const response = await clientApi.changeLegalName(
        selectedClient.clientId,
        changeNameForm.newBusinessName.trim(),
        changeNameForm.reason.trim()
      );
      
      if (response.success) {
        showToast('Client legal name changed successfully', 'success');
        setShowChangeNameModal(false);
        setSelectedClient(null);
        setChangeNameForm({
          newBusinessName: '',
          reason: '',
        });
        loadAdminData();
      } else {
        showToast(response.message || 'Failed to change client name', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to change client name', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseClientModal = () => {
    setShowClientModal(false);
    setSelectedClient(null);
    setClientForm({
      businessName: '',
      businessAddress: '',
      primaryContactNumber: '',
      secondaryContactNumber: '',
      businessEmail: '',
      PAN: '',
      GST: '',
      TAN: '',
      CIN: '',
      description: '',
      notes: '',
    });
    setFactSheetFiles([]);
  };
  
  const handleCloseChangeNameModal = () => {
    setShowChangeNameModal(false);
    setSelectedClient(null);
    setChangeNameForm({
      newBusinessName: '',
      reason: '',
    });
  };

  const handleEditUser = (user) => {
    handleOpenAccessModal(user);
  };

  if (loading) {
    return (
      <PlatformShell moduleLabel="Operations" title="Team" subtitle="Manage users, permissions, and security actions for your firm.">
        <TableSkeleton rows={7} />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell
      moduleLabel={isWorkSettingsContext ? "Settings" : "Operations"}
      title={isWorkSettingsContext ? "Category Management" : "Team"}
      subtitle={isWorkSettingsContext ? "Create and manage docket categories and subcategories." : "Manage users, access control, and security actions."}
    >
      <div className="admin">
        <PageHeader
          title={isWorkSettingsContext ? 'Category Management' : 'Team Management'}
          description={isWorkSettingsContext
            ? 'Create and manage docket categories and subcategories.'
            : 'Manage users, access control, and security actions'}
        />

        <div className="admin__tabs">
          {!isWorkSettingsContext && (
            <Button
              variant={activeTab === 'users' ? 'primary' : 'default'}
              onClick={() => { setActiveTab('users'); setSearchParams({ tab: 'users' }); }}
            >
              User Management ({statsFailed ? '--' : adminStats.totalUsers})
            </Button>
          )}
          {isWorkSettingsContext && (
            <Button
              variant={activeTab === 'categories' ? 'primary' : 'default'}
              onClick={() => {
                setActiveTab('categories');
                setSearchParams({ tab: 'categories', context: 'work-settings' });
              }}
            >
              Categories ({statsFailed ? '--' : adminStats.totalCategories})
            </Button>
          )}
        </div>

        {statsEmpty && (
          <Card>
            <EmptyState
              title="No statistics available yet"
              description="Data will appear once activity begins."
            />
          </Card>
        )}

        {activeTab === 'users' && (
          <AdminUsersSection
            users={filteredUsers}
            canCreateUsers={isPrimaryAdminActor}
            onBulkUpload={() => handleOpenBulkUpload('team')}
            onDownloadTemplate={() => downloadBulkTemplate('team')}
            onCreateUser={() => setShowCreateModal(true)}
            onEditUser={handleEditUser}
            onResendInvite={handleResendSetupEmail}
            onToggleUserStatus={handleToggleUserStatus}
            onUnlock={handleUnlockAccount}
            onResetPassword={handleSendPasswordReset}
            actionLoadingByUser={actionLoadingByUser}
            sectionMessage={userSectionMessage}
          />
        )}

        {activeTab === 'clients' && (
          <AdminClientsSection
            clients={filteredClientsList}
            hasAdditionalClients={hasAdditionalClients}
            defaultClients={defaultClients}
            tabError={tabError}
            onRetry={loadAdminData}
            onBulkUpload={() => handleOpenBulkUpload('clients')}
            onDownloadTemplate={() => downloadBulkTemplate('clients')}
            onBulkPaste={() => handleOpenBulkPaste('clients')}
            onCreateClient={() => {
              setSelectedClient(null);
              setClientForm({
                businessName: '',
                businessAddress: '',
                primaryContactNumber: '',
                secondaryContactNumber: '',
                businessEmail: '',
                PAN: '',
                GST: '',
                TAN: '',
                CIN: '',
              });
              setShowClientModal(true);
            }}
            onEditClient={handleEditClient}
            StatusBadge={StatusBadge}
          />
        )}

        {activeTab === 'categories' && (
          <AdminCategoriesSection
            categories={categories}
            workbasketNameById={workbasketNameById}
            onBulkUpload={() => handleOpenBulkUpload('categories')}
            onDownloadTemplate={() => downloadBulkTemplate('categories')}
            onCreateCategory={() => setShowCategoryModal(true)}
            onAddSubcategory={(category) => {
              setSelectedCategory(category);
              setShowSubcategoryModal(true);
            }}
            onToggleCategoryStatus={handleToggleCategoryStatus}
            onDeleteCategory={handleDeleteCategory}
            onToggleSubcategoryStatus={handleToggleSubcategoryStatus}
            onDeleteSubcategory={handleDeleteSubcategory}
            StatusBadge={StatusBadge}
          />
        )}

      </div>

      {/* Create User Modal */}
      <BulkUploadModal
        isOpen={showBulkUploadModal}
        onClose={() => setShowBulkUploadModal(false)}
        type={bulkUploadType}
        title={`Bulk Upload ${bulkUploadType === 'team' ? 'Team' : bulkUploadType.charAt(0).toUpperCase() + bulkUploadType.slice(1)}`}
        onImported={loadAdminData}
        showToast={(message, level) => showToast(message, level === 'error' ? 'error' : 'success')}
      />

      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateUser}
        newUser={newUser}
        setNewUser={setNewUser}
        creatingUser={creatingUser}
        primaryWorkbaskets={primaryWorkbaskets}
        qcOnlyWorkbaskets={qcOnlyWorkbaskets}
      />

      <UserAccessModal
        isOpen={showAccessModal}
        onClose={() => {
          setShowAccessModal(false);
          setSelectedUserForAccess(null);
          setRestrictedClientDraft([]);
          setSelectedWorkbasketDraft([]);
        }}
        selectedUser={selectedUserForAccess}
        primaryWorkbaskets={primaryWorkbaskets}
        qcOnlyWorkbaskets={qcOnlyWorkbaskets}
        selectedWorkbasketDraft={selectedWorkbasketDraft}
        setSelectedWorkbasketDraft={setSelectedWorkbasketDraft}
        clients={clients}
        restrictedClientDraft={restrictedClientDraft}
        isClientAllowedForDraft={isClientAllowedForDraft}
        onToggleClientAccess={handleToggleClientAccess}
        onSave={handleSaveUserAccess}
        saving={savingUserAccess}
      />

      <ActionConfirmModal
        isOpen={Boolean(pendingConfirmation)}
        title={pendingConfirmation?.title}
        description={pendingConfirmation?.description}
        confirmText={pendingConfirmation?.confirmText}
        danger={pendingConfirmation?.danger}
        loading={isConfirmActionLoading}
        onCancel={closePendingConfirmation}
        onConfirm={() => pendingConfirmation?.onConfirm?.()}
      />
      
      <AdminBulkPasteModal
        isOpen={showBulkPasteModal}
        onClose={() => setShowBulkPasteModal(false)}
        mode={bulkPasteMode}
        input={bulkPasteInput}
        onInputChange={setBulkPasteInput}
        onSubmit={handleBulkPasteSubmit}
        inProgress={bulkPasteInProgress}
      />

      <AdminCategoryModals
        showCategoryModal={showCategoryModal}
        setShowCategoryModal={setShowCategoryModal}
        categoryForm={categoryForm}
        setCategoryForm={setCategoryForm}
        onCreateCategory={handleCreateCategory}
        submitting={submitting}
        showSubcategoryModal={showSubcategoryModal}
        setShowSubcategoryModal={setShowSubcategoryModal}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        subcategoryForm={subcategoryForm}
        setSubcategoryForm={setSubcategoryForm}
        onAddSubcategory={handleAddSubcategory}
        workbaskets={workbaskets}
      />

      <AdminClientModals
        showClientModal={showClientModal}
        handleCloseClientModal={handleCloseClientModal}
        selectedClient={selectedClient}
        handleUpdateClient={handleUpdateClient}
        handleCreateClient={handleCreateClient}
        clientForm={clientForm}
        setClientForm={setClientForm}
        uploadingFactSheetFile={uploadingFactSheetFile}
        handleUploadFactSheetFile={handleUploadFactSheetFile}
        factSheetFiles={factSheetFiles}
        handleDeleteFactSheetFile={handleDeleteFactSheetFile}
        submitting={submitting}
        showChangeNameModal={showChangeNameModal}
        handleCloseChangeNameModal={handleCloseChangeNameModal}
        handleChangeLegalName={handleChangeLegalName}
        changeNameForm={changeNameForm}
        setChangeNameForm={setChangeNameForm}
      />
    </PlatformShell>
  );
};
