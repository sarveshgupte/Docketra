/**
 * Admin Page
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Textarea } from '../components/common/Textarea';
import { Select } from '../components/common/Select';
import { FormLabel } from '../components/common/FormLabel';
import { Modal } from '../components/common/Modal';
import { Loading } from '../components/common/Loading';
import { TableSkeleton } from '../components/common/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/layout/PageHeader';
import { adminApi } from '../api/admin.api';
import { categoryService } from '../services/categoryService';
import { clientApi } from '../api/client.api';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../utils/formatters';
import './AdminPage.css';

const EMPTY_ADMIN_STATS = {
  totalUsers: 0,
  totalClients: 0,
  totalCategories: 0,
  pendingApprovals: 0,
};

const TOAST_DEDUPLICATION_WINDOW_MS = 1500;
const EMPTY_FIELD_PLACEHOLDER = '—';

const looksEncryptedToken = (value) => (
  typeof value === 'string' && value.includes(':')
);

const normalizeSubcategory = (subcategory) => {
  if (!subcategory || typeof subcategory !== 'object') return null;
  return {
    ...subcategory,
    id: subcategory.id || subcategory._id || null,
    name: typeof subcategory.name === 'string' ? subcategory.name : '',
    isActive: Boolean(subcategory.isActive),
  };
};

const normalizeCategory = (category) => {
  if (!category || typeof category !== 'object') return null;
  const rawSubcategories = Array.isArray(category.subcategories) ? category.subcategories : [];
  return {
    ...category,
    _id: category._id || category.id || null,
    name: typeof category.name === 'string' ? category.name : '',
    isActive: Boolean(category.isActive),
    subcategories: rawSubcategories.map(normalizeSubcategory).filter(Boolean),
  };
};

const parseDelimitedLine = (line = '') => {
  if (line.includes('\t')) {
    return line.split('\t').map((value) => value.trim());
  }
  return line.split(',').map((value) => value.trim());
};

const getApiErrorType = (error) => {
  if (!error?.response) return 'network';

  const status = error.response.status;
  if (status === 404) return 'empty';
  if (status === 401 || status === 403) return 'permission';
  if (status >= 500) return 'server';
  return 'unknown';
};

const getUserStatusBadge = (user) => {
  const status = String(user?.status || '').toLowerCase();
  if (status === 'invited') {
    return { tone: 'Pending', label: 'Invited' };
  }
  if (status === 'active' || user?.isActive) {
    return { tone: 'Approved', label: 'Active' };
  }
  if (status === 'disabled') {
    return { tone: 'Rejected', label: 'Cancelled' };
  }
  return { tone: 'Rejected', label: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Inactive' };
};

const getRoleBadgePresentation = (user) => {
  const normalizedRole = String(user?.role || '').trim().toUpperCase();
  const isPrimaryOrSystemAdmin = user?.isPrimaryAdmin || user?.isSystem;

  if (isPrimaryOrSystemAdmin || normalizedRole === 'ADMIN') {
    return { tone: 'InProgress', label: isPrimaryOrSystemAdmin ? 'Admin (Primary)' : 'Admin' };
  }

  if (['STAFF', 'EMPLOYEE', 'USER'].includes(normalizedRole)) {
    return { tone: 'Pending', label: 'User' };
  }

  return { tone: 'Pending', label: normalizedRole ? normalizedRole.charAt(0) + normalizedRole.slice(1).toLowerCase() : 'User' };
};

export const AdminPage = () => {
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const { showToast } = useToast();
  const { user: loggedInUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isWorkSettingsContext = searchParams.get('context') === 'work-settings';
  
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
  const [bulkPasteMode, setBulkPasteMode] = useState('categories');
  const [bulkPasteInput, setBulkPasteInput] = useState('');
  const [bulkPasteInProgress, setBulkPasteInProgress] = useState(false);
  const [showChangeNameModal, setShowChangeNameModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedUserForAccess, setSelectedUserForAccess] = useState(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [savingUserAccess, setSavingUserAccess] = useState(false);
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
  });
  
  // Category form state
  const [categoryForm, setCategoryForm] = useState({
    name: '',
  });
  
  // Subcategory form state
  const [subcategoryForm, setSubcategoryForm] = useState({
    name: '',
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

  const loadAdminStats = async () => {
    try {
      const response = await adminApi.getAdminStats();
      const data = response?.success ? response.data : null;
      if (data) {
        setAdminStats(data);
        setStatsEmpty(false);
        setStatsFailed(false);
      } else {
        setAdminStats(EMPTY_ADMIN_STATS);
        setStatsEmpty(true);
        setStatsFailed(false);
      }
    } catch (error) {
      console.error('Failed to load admin stats:', error);
      setStatsFailed(true);
      const errorType = notifyLoadError(error, 'admin-load');
      if (errorType === 'empty') {
        setAdminStats(EMPTY_ADMIN_STATS);
        setStatsEmpty(true);
      }
    }
  };

  const fetchClients = async () => {
    const response = await adminApi.listClients({ activeOnly: false });
    setClients(response?.success ? (response.data || []) : []);
    return response;
  };

  const loadAdminData = async () => {
    setLoading(true);
    setTabError(null);
    try {
      if (activeTab === 'users') {
        const response = await adminApi.getUsers();
        const apiUsers = response?.success ? (response.data || []) : [];
        setUsers(ensureLoggedInAdminVisible(apiUsers));
      } else if (activeTab === 'categories') {
        const response = await categoryService.getAdminCategories(false); // Get all categories including inactive
        const normalizedCategories = (response?.success ? (response.data || []) : [])
          .map(normalizeCategory)
          .filter(Boolean);
        setCategories(normalizedCategories);
      } else if (activeTab === 'clients') {
        await fetchClients();
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
      const errorType = notifyLoadError(error, 'admin-load');
      if (activeTab === 'clients' && errorType !== 'empty') {
        setTabError({
          tab: 'clients',
          message: errorType === 'network'
            ? 'Failed to load clients. Check your connection and retry.'
            : 'Failed to load clients.',
        });
      }
      if (errorType === 'empty') {
        if (activeTab === 'users') {
          setUsers([]);
        } else if (activeTab === 'categories') {
          setCategories([]);
        } else if (activeTab === 'clients') {
          setClients([]);
          setTabError(null);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    
    // PR 32: Only name and email are required (xID is auto-generated)
    if (!newUser.name || !newUser.email || !newUser.role) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    setCreatingUser(true);

    try {
      const response = await adminApi.createUser(newUser);
      
      if (response.success) {
        showToast(`User invited successfully! xID: ${response.data?.xID}.`, 'success');
        setShowCreateModal(false);
        setNewUser({ name: '', email: '', role: '' });
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
    const isInvited = user.status === 'invited';
    const shouldActivate = isInvited ? false : user.status !== 'active';
    const action = isInvited ? 'cancel invite for' : (shouldActivate ? 'activate' : 'deactivate');

    try {
      const response = await adminApi.updateUserStatus(user.xID, shouldActivate);
      
      if (response.success) {
        showToast(isInvited ? 'Invite cancelled successfully' : `User ${action}d successfully`, 'success');
        await Promise.all([loadAdminStats(), loadAdminData()]);
      } else {
        showToast(response.message || (isInvited ? 'Failed to cancel invite' : `Failed to ${action} user`), 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || (isInvited ? 'Failed to cancel invite' : `Failed to ${action} user`), 'error');
    }
  };

  const handleResendSetupEmail = async (xID) => {
    try {
      const response = await adminApi.resendSetupEmail(xID);
      
      if (response.success) {
        showToast('Invite email sent successfully', 'success');
        await loadAdminData();
      } else {
        showToast(response.message || 'Failed to send email', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to send email', 'error');
    }
  };

  const handleUnlockAccount = async (xID) => {
    try {
      const response = await adminApi.unlockAccount(xID);
      
      if (response.success) {
        showToast('Account unlocked successfully', 'success');
        await loadAdminData();
      } else {
        showToast(response.message || 'Failed to unlock account', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to unlock account', 'error');
    }
  };

  const handleSendPasswordReset = async (user) => {
    try {
      const response = await adminApi.resetPassword(user.xID);
      if (response.success) {
        showToast(`Password reset link sent to ${user.email}`, 'success');
        await loadAdminData();
      } else {
        showToast(response.message || 'Failed to send password reset link', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to send password reset link', 'error');
    }
  };

  const handleOpenAccessModal = (user) => {
    setSelectedUserForAccess(user);
    setRestrictedClientDraft(Array.isArray(user.restrictedClientIds) ? user.restrictedClientIds : []);
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
      const response = await adminApi.updateRestrictedClients(selectedUserForAccess.xID, restrictedClientDraft);
      if (response.success) {
        showToast('User client docket access updated', 'success');
        setShowAccessModal(false);
        setSelectedUserForAccess(null);
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
    
    setSubmitting(true);
    
    try {
      const response = await categoryService.addSubcategory(
        selectedCategory._id,
        subcategoryForm.name.trim()
      );
      
      if (response.success) {
        showToast('Subcategory added successfully', 'success');
        setShowSubcategoryModal(false);
        setSubcategoryForm({ name: '' });
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
          const [rawCategoryName, rawSubcategoryName] = parseDelimitedLine(row);
          const categoryName = rawCategoryName?.trim();
          const subcategoryName = rawSubcategoryName?.trim();

          if (!categoryName || !subcategoryName) {
            skippedCount += 1;
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
            await categoryService.addSubcategory(category._id, subcategoryName);
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
          const [businessName, businessAddress, primaryContactNumber, businessEmail, secondaryContactNumber, PAN, GST, TAN, CIN] = parseDelimitedLine(row);
          const requiredValues = [businessName, businessAddress, primaryContactNumber, businessEmail].map((value) => value?.trim());
          const [trimmedName, trimmedAddress, trimmedPrimary, trimmedEmail] = requiredValues;

          if (!trimmedName || !trimmedAddress || !trimmedPrimary || !trimmedEmail) {
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
              businessAddress: trimmedAddress,
              primaryContactNumber: trimmedPrimary,
              businessEmail: trimmedEmail,
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
    
    if (!clientForm.businessName || !clientForm.businessAddress || 
        !clientForm.primaryContactNumber || !clientForm.businessEmail) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Explicit payload construction - DO NOT spread form state
      const payload = {
        businessName: clientForm.businessName,
        businessAddress: clientForm.businessAddress,
        businessEmail: clientForm.businessEmail,
        primaryContactNumber: clientForm.primaryContactNumber,
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

  if (loading) {
    return (
      <Layout>
        <TableSkeleton rows={7} />
      </Layout>
    );
  }

  return (
    <Layout>
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
          <Card>
            <div className="admin__section-header">
              <h2 className="neo-section__header">User Management</h2>
              <Button
                variant="primary"
                onClick={() => setShowCreateModal(true)}
              >
                + Create User
              </Button>
            </div>
            
            {users.length === 0 ? (
              <EmptyState
                title="No users added yet"
                description="Invite your team to start collaborating."
              />
            ) : (
              <table className="neo-table">
                <thead>
                  <tr>
                    <th>xID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Firm</th>
                    <th>Client Docket Access</th>
                    <th>Status</th>
                    <th>Password Set</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const isPrimaryOrSystemAdmin = user.isPrimaryAdmin || user.isSystem;
                    const userStatus = getUserStatusBadge(user);
                    const roleBadge = getRoleBadgePresentation(user);
                    const isInvited = user.status === 'invited';
                    return (
                    <tr key={user.xID}>
                      <td>{user.xID}</td>
                      <td>{user.name || EMPTY_FIELD_PLACEHOLDER}</td>
                      <td>{user.email}</td>
                      <td>
                        <Badge status={roleBadge.tone}>{roleBadge.label}</Badge>
                      </td>
                      <td>{user.firm?.name || 'N/A'}</td>
                      <td>
                        <Badge status={(user.restrictedClientIds || []).length === 0 ? 'Approved' : 'Pending'}>
                          {(user.restrictedClientIds || []).length === 0 ? 'Full Access (Default)' : `Restricted (${(user.restrictedClientIds || []).length})`}
                        </Badge>
                      </td>
                      <td>
                        <Badge status={userStatus.tone}>
                          {userStatus.label}
                        </Badge>
                      </td>
                      <td>
                        <Badge status={user.passwordConfigured ? 'Approved' : 'Pending'}>
                          {user.passwordConfigured ? 'Yes' : 'No'}
                        </Badge>
                      </td>
                      <td className="admin__actions">
                        {isPrimaryOrSystemAdmin ? (
                          <span className="admin__primary-label">Primary Admin</span>
                        ) : (
                          <Button
                            size="small"
                            variant={isInvited || user.isActive ? 'danger' : 'success'}
                            onClick={() => handleToggleUserStatus(user)}
                          >
                            {isInvited ? 'Cancel Invite' : (user.isActive ? 'Deactivate' : 'Activate')}
                          </Button>
                        )}
                        {isInvited && (
                          <Button
                            size="small"
                            variant="default"
                            onClick={() => handleResendSetupEmail(user.xID)}
                          >
                            Resend Invite
                          </Button>
                        )}
                        {!isPrimaryOrSystemAdmin && (
                          <Button
                            size="small"
                            variant="default"
                            onClick={() => handleOpenAccessModal(user)}
                          >
                            Client Access
                          </Button>
                        )}
                        {!isPrimaryOrSystemAdmin && (
                          <Button
                            size="small"
                            variant="warning"
                            onClick={() => handleSendPasswordReset(user)}
                          >
                            Send Reset Link
                          </Button>
                        )}
                        {user.lockUntil && new Date(user.lockUntil) > new Date() && (
                          <Button
                            size="small"
                            variant="warning"
                            onClick={() => handleUnlockAccount(user.xID)}
                          >
                            Unlock
                          </Button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        )}

        {activeTab === 'clients' && (
          <Card>
            <div className="admin__section-header">
              <h2 className="neo-section__header">Client Management</h2>
              <div className="admin__section-actions">
                <Button variant="default" onClick={() => handleOpenBulkPaste('clients')}>
                  Bulk Paste
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
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
                >
                  + Create Client
                </Button>
              </div>
            </div>
            
            {tabError?.tab === 'clients' ? (
              <EmptyState
                title={tabError.message}
                description="The admin panel is still available. Retry loading clients without leaving this page."
                actionLabel="Retry"
                onAction={loadAdminData}
              />
            ) : clients.length === 0 ? (
              <EmptyState
                title="No clients created yet"
                description="Create your first client to begin managing cases."
              />
            ) : (
              <>
                {!hasAdditionalClients && defaultClients.length > 0 && (
                  <p className="text-secondary" style={{ marginBottom: '16px' }}>
                    Your firm is set up as the default internal client. Add more clients when you are ready.
                  </p>
                )}
                <div className="admin__clients-table-wrap">
                  <table className="neo-table admin__clients-table">
                    <thead>
                      <tr>
                        <th className="admin__col-id">Client ID</th>
                        <th className="admin__col-business">Business Name</th>
                        <th className="admin__col-email">Email</th>
                        <th className="admin__col-status">Status</th>
                        <th className="admin__col-created">Created</th>
                        <th className="admin__col-actions">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map((client) => {
                        const isProtectedClient = client.isDefaultClient || client.isSystemClient || client.isInternal;
                        return (
                          <tr key={client.clientId}>
                            <td className="admin__cell-truncate" title={client.clientId}>
                              {client.clientId}
                              {isProtectedClient && (
                                <span style={{ marginLeft: '8px' }}>
                                  <Badge status="Approved">Default</Badge>
                                </span>
                              )}
                            </td>
                            <td className="admin__cell-business" title={client.businessName}>{client.businessName}</td>
                            <td className="admin__cell-truncate" title={client.businessEmail || EMPTY_FIELD_PLACEHOLDER}>
                              {looksEncryptedToken(client.businessEmail) ? EMPTY_FIELD_PLACEHOLDER : (client.businessEmail || EMPTY_FIELD_PLACEHOLDER)}
                            </td>
                            <td>
                              <Badge status={client.status === 'ACTIVE' ? 'Approved' : 'Rejected'}>
                                {client.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                              </Badge>
                            </td>
                            <td>{formatDate(client.createdAt)}</td>
                            <td className="admin__actions admin__actions--compact">
                              <Button
                                size="small"
                                variant="default"
                                onClick={() => handleEditClient(client)}
                                disabled={false}
                              >
                                Edit
                              </Button>
                              <Button
                                size="small"
                                variant="default"
                                onClick={() => navigate(`/app/firm/${firmSlug}/clients/${client.clientId}/cfs`)}
                              >
                                Fact Sheet
                              </Button>
                              {!isProtectedClient && (
                                <Button
                                  size="small"
                                  variant={client.status === 'ACTIVE' ? 'danger' : 'success'}
                                  onClick={() => handleToggleClientStatus(client)}
                                >
                                  {client.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>
        )}

        {activeTab === 'categories' && (
          <Card>
            <div className="admin__section-header">
              <h2 className="neo-section__header">Category Management</h2>
              <div className="admin__section-actions">
                <Button variant="default" onClick={() => handleOpenBulkPaste('categories')}>
                  Bulk Categories
                </Button>
                <Button variant="default" onClick={() => handleOpenBulkPaste('subcategories')}>
                  Bulk Subcategories
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setShowCategoryModal(true)}
                >
                  + Create Category
                </Button>
              </div>
            </div>
            
            {categories.length === 0 ? (
              <EmptyState
                title="No categories created yet"
                description="Use categories to organize your cases."
              />
            ) : (
              <div className="categories-list">
                {categories.map((category) => (
                  <Card key={category._id} className="category-card">
                    <div className="category-header">
                      <div>
                        <h3>{category.name}</h3>
                        <Badge status={category.isActive ? 'Approved' : 'Rejected'}>
                          {category.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="category-actions">
                        <Button
                          size="small"
                          variant="default"
                          onClick={() => {
                            setSelectedCategory(category);
                            setShowSubcategoryModal(true);
                          }}
                        >
                          + Add Subcategory
                        </Button>
                        <Button
                          size="small"
                          variant={category.isActive ? 'danger' : 'success'}
                          onClick={() => handleToggleCategoryStatus(category)}
                        >
                          {category.isActive ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          size="small"
                          variant="danger"
                          onClick={() => handleDeleteCategory(category)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                    
                    {category.subcategories && category.subcategories.length > 0 && (
                      <div className="subcategories-list">
                        <h4>Subcategories:</h4>
                        <table className="neo-table">
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {category.subcategories.map((sub) => (
                              <tr key={sub.id}>
                                <td>{sub.name}</td>
                                <td>
                                  <Badge status={sub.isActive ? 'Approved' : 'Rejected'}>
                                    {sub.isActive ? 'Active' : 'Inactive'}
                                  </Badge>
                                </td>
                                <td>
                                  <Button
                                    size="small"
                                    variant={sub.isActive ? 'danger' : 'success'}
                                    onClick={() => handleToggleSubcategoryStatus(category, sub)}
                                  >
                                    {sub.isActive ? 'Disable' : 'Enable'}
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="danger"
                                    onClick={() => handleDeleteSubcategory(category, sub)}
                                  >
                                    Delete
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </Card>
        )}

      </div>

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New User"
      >
        <form onSubmit={handleCreateUser} className="admin__create-form">
          <div className="neo-form-group">
            <label className="neo-label">xID (Auto-Generated)</label>
            <div className="neo-info-text">
              Employee ID will be automatically generated (e.g., X000001)
            </div>
          </div>

          <Input
            label="Name"
            type="text"
            value={newUser.name}
            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            placeholder="John Doe"
            required
          />

          <Input
            label="Email"
            type="email"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            placeholder="john.doe@company.com"
            required
          />

          <Select
            label="Role"
            value={newUser.role}
            onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            options={[
              { value: '', label: 'Select Role', disabled: true },
              { value: 'Employee', label: 'User' },
              { value: 'Admin', label: 'Admin' },
            ]}
            required
          />

          <div className="admin__form-actions">
            <Button
              type="button"
              variant="default"
              onClick={() => setShowCreateModal(false)}
              disabled={creatingUser}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={creatingUser}
            >
              {creatingUser ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showAccessModal}
        onClose={() => {
          setShowAccessModal(false);
          setSelectedUserForAccess(null);
          setRestrictedClientDraft([]);
        }}
        title={`Client Access Control${selectedUserForAccess ? ` — ${selectedUserForAccess.name}` : ''}`}
      >
        <div className="admin__create-form">
          <div className="neo-info-text">
            Select which clients this user can access. Checked clients are allowed; unchecked clients are blocked.
          </div>

          <div className="admin__access-summary">
            {clients.length === 0 ? (
              <Badge status="Pending">No Clients Found</Badge>
            ) : (restrictedClientDraft || []).length === 0 ? (
              <Badge status="Approved">All Clients Allowed</Badge>
            ) : (
              <Badge status="Pending">
                {clients.length - (restrictedClientDraft || []).length} of {clients.length} clients allowed
              </Badge>
            )}
          </div>

          <div className="admin__client-access-list">
            {clients.length === 0 ? (
              <div className="neo-info-text">No clients available yet.</div>
            ) : (
              clients.map((client) => (
                <label key={client.clientId} className="admin__client-access-item">
                  <input
                    type="checkbox"
                    checked={isClientAllowedForDraft(client.clientId)}
                    onChange={() => handleToggleClientAccess(client.clientId)}
                  />
                  <span>
                    <strong>{client.businessName}</strong> ({client.clientId})
                  </span>
                  <Badge status={isClientAllowedForDraft(client.clientId) ? 'Approved' : 'Rejected'}>
                    {isClientAllowedForDraft(client.clientId) ? 'Allowed' : 'Blocked'}
                  </Badge>
                </label>
              ))
            )}
          </div>

          <div className="admin__form-actions">
            <Button
              type="button"
              variant="default"
              onClick={() => {
                setShowAccessModal(false);
                setSelectedUserForAccess(null);
                setRestrictedClientDraft([]);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={savingUserAccess}
              onClick={handleSaveUserAccess}
            >
              {savingUserAccess ? 'Saving...' : 'Save Access'}
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Create Category Modal */}
      <Modal
        isOpen={showBulkPasteModal}
        onClose={() => {
          if (bulkPasteInProgress) return;
          setShowBulkPasteModal(false);
        }}
        title={bulkPasteMode === 'clients' ? 'Bulk Paste Clients' : bulkPasteMode === 'subcategories' ? 'Bulk Paste Subcategories' : 'Bulk Paste Categories'}
      >
        <form onSubmit={handleBulkPasteSubmit} className="admin__create-form">
          <div className="neo-info-text">
            {bulkPasteMode === 'clients'
              ? 'Paste rows from Excel/Sheets. Columns: BusinessName, BusinessAddress, PrimaryContactNumber, BusinessEmail, SecondaryContactNumber, PAN, GST, TAN, CIN.'
              : bulkPasteMode === 'subcategories'
                ? 'Paste 2 columns: CategoryName and SubcategoryName. If a category does not exist, it is created first.'
                : 'Paste one category name per line (or first column). Duplicate names are skipped.'}
          </div>
          <Textarea
            label="Paste Data"
            rows={10}
            value={bulkPasteInput}
            onChange={(event) => setBulkPasteInput(event.target.value)}
            placeholder={bulkPasteMode === 'clients'
              ? 'Acme Pvt Ltd\tMumbai\t9876543210\tops@acme.com'
              : bulkPasteMode === 'subcategories'
                ? 'Tax\tGST Filing'
                : 'Tax'}
            required
          />
          <div className="neo-form-actions">
            <Button type="button" variant="default" onClick={() => setShowBulkPasteModal(false)} disabled={bulkPasteInProgress}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={bulkPasteInProgress}>
              {bulkPasteInProgress ? 'Saving...' : 'Save Bulk Data'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Category Modal */}
      <Modal
        isOpen={showCategoryModal}
        onClose={() => {
          setShowCategoryModal(false);
          setCategoryForm({ name: '' });
        }}
        title="Create New Category"
      >
        <form onSubmit={handleCreateCategory} className="admin__create-form">
          <Input
            label="Category Name"
            name="name"
            value={categoryForm.name}
            onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
            placeholder="Enter category name"
            required
          />

          <div className="neo-form-actions">
            <Button
              type="button"
              variant="default"
              onClick={() => {
                setShowCategoryModal(false);
                setCategoryForm({ name: '' });
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>
      
      {/* Add Subcategory Modal */}
      <Modal
        isOpen={showSubcategoryModal}
        onClose={() => {
          setShowSubcategoryModal(false);
          setSubcategoryForm({ name: '' });
          setSelectedCategory(null);
        }}
        title={`Add Subcategory to ${selectedCategory?.name || ''}`}
      >
        <form onSubmit={handleAddSubcategory} className="admin__create-form">
          <Input
            label="Subcategory Name"
            name="name"
            value={subcategoryForm.name}
            onChange={(e) => setSubcategoryForm({ ...subcategoryForm, name: e.target.value })}
            placeholder="Enter subcategory name"
            required
          />

          <div className="neo-form-actions">
            <Button
              type="button"
              variant="default"
              onClick={() => {
                setShowSubcategoryModal(false);
                setSubcategoryForm({ name: '' });
                setSelectedCategory(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
            >
              {submitting ? 'Adding...' : 'Add Subcategory'}
            </Button>
          </div>
        </form>
      </Modal>
      
      {/* Client Modal (Create/Edit) */}
      <Modal
        isOpen={showClientModal}
        onClose={handleCloseClientModal}
        title={selectedClient ? 'Edit Client' : 'Create New Client'}
      >
        <form onSubmit={selectedClient ? handleUpdateClient : handleCreateClient} className="admin__create-form">
          {selectedClient && (
            <div className="neo-form-group">
              <label className="neo-label">Client ID</label>
              <div className="neo-info-text">{selectedClient.clientId} (Immutable)</div>
            </div>
          )}

          <Input
            label="Business Name"
            name="businessName"
            value={clientForm.businessName}
            onChange={(e) => setClientForm({ ...clientForm, businessName: e.target.value })}
            placeholder="Enter business name"
            required
            disabled={!!selectedClient}
            title={selectedClient ? 'Business name cannot be edited inline. Use "Change Legal Name" action.' : ''}
          />
          
          {selectedClient && (
            <div className="client-field-hint">
              To change business name, use the "Change Legal Name" button for audit compliance
            </div>
          )}

          <Input
            label="Business Address"
            name="businessAddress"
            value={clientForm.businessAddress}
            onChange={(e) => setClientForm({ ...clientForm, businessAddress: e.target.value })}
            placeholder="Enter business address"
            required={!selectedClient}
            disabled={!!selectedClient}
            title={selectedClient ? 'Address cannot be changed after creation' : ''}
          />

          <Input
            label="Primary Contact Number"
            name="primaryContactNumber"
            type="tel"
            value={clientForm.primaryContactNumber}
            onChange={(e) => setClientForm({ ...clientForm, primaryContactNumber: e.target.value })}
            placeholder="Enter primary contact number"
            required
          />

          <Input
            label="Secondary Contact Number"
            name="secondaryContactNumber"
            type="tel"
            value={clientForm.secondaryContactNumber}
            onChange={(e) => setClientForm({ ...clientForm, secondaryContactNumber: e.target.value })}
            placeholder="Enter secondary contact number (optional)"
          />

          <Input
            label="Business Email"
            name="businessEmail"
            type="email"
            value={clientForm.businessEmail}
            onChange={(e) => setClientForm({ ...clientForm, businessEmail: e.target.value })}
            placeholder="Enter business email"
            required
          />

          <Input
            label="PAN"
            name="PAN"
            value={clientForm.PAN}
            onChange={(e) => setClientForm({ ...clientForm, PAN: e.target.value })}
            placeholder="Enter PAN (optional)"
            disabled={!!selectedClient}
            title={selectedClient ? 'PAN is immutable and cannot be changed' : ''}
          />

          <Input
            label="TAN"
            name="TAN"
            value={clientForm.TAN}
            onChange={(e) => setClientForm({ ...clientForm, TAN: e.target.value })}
            placeholder="Enter TAN (optional)"
            disabled={!!selectedClient}
            title={selectedClient ? 'TAN is immutable and cannot be changed' : ''}
          />

          <Input
            label="CIN"
            name="CIN"
            value={clientForm.CIN}
            onChange={(e) => setClientForm({ ...clientForm, CIN: e.target.value })}
            placeholder="Enter CIN (optional)"
            disabled={!!selectedClient}
            title={selectedClient ? 'CIN is immutable and cannot be changed' : ''}
          />

          <Input
            label="GST"
            name="GST"
            value={clientForm.GST}
            onChange={(e) => setClientForm({ ...clientForm, GST: e.target.value })}
            placeholder="Enter GST (optional)"
            disabled={!!selectedClient}
            title={selectedClient ? 'GST cannot be changed after creation' : ''}
          />

          {/* Client Fact Sheet Section - PR: Client Fact Sheet Foundation */}
          {selectedClient && (
            <>
              <div style={{ marginTop: '2rem', marginBottom: '1rem', borderTop: '2px solid #e0e0e0', paddingTop: '1rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Client Fact Sheet</h3>
              </div>

              <Textarea
                label="Description"
                value={clientForm.description}
                onChange={(e) => setClientForm({ ...clientForm, description: e.target.value })}
                placeholder="Add a description for this client (visible to all case-accessible users)"
                rows={4}
              />

              <Textarea
                label="Internal Notes"
                value={clientForm.notes}
                onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
                placeholder="Add internal notes (visible to all case-accessible users)"
                rows={4}
              />

              <div style={{ marginTop: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Files
                </label>
                <input
                  type="file"
                  onChange={handleUploadFactSheetFile}
                  disabled={uploadingFactSheetFile}
                  style={{ marginBottom: '1rem' }}
                />
                {uploadingFactSheetFile && <p style={{ fontSize: '0.9rem', color: '#666' }}>Uploading...</p>}
                
                {factSheetFiles && factSheetFiles.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    {factSheetFiles.map((file) => (
                      <div
                        key={file.fileId}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem',
                          background: '#f5f5f5',
                          borderRadius: '4px',
                          marginBottom: '0.5rem',
                        }}
                      >
                        <span style={{ fontSize: '0.9rem' }}>📄 {file.fileName}</span>
                        <Button
                          variant="default"
                          onClick={() => handleDeleteFactSheetFile(file.fileId)}
                          style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
                        >
                          Delete
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="neo-form-actions">
            <Button
              type="button"
              variant="default"
              onClick={handleCloseClientModal}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
            >
              {submitting ? (selectedClient ? 'Updating...' : 'Creating...') : (selectedClient ? 'Update Client' : 'Create Client')}
            </Button>
          </div>
        </form>
      </Modal>
      
      {/* Change Legal Name Modal */}
      <Modal
        isOpen={showChangeNameModal}
        onClose={handleCloseChangeNameModal}
        title="Change Client Legal Name"
      >
        <form onSubmit={handleChangeLegalName} className="admin__create-form">
          {selectedClient && (
            <>
              <div className="neo-form-group">
                <label className="neo-label">Client ID</label>
                <div className="neo-info-text">{selectedClient.clientId}</div>
              </div>
              
              <div className="neo-form-group">
                <label className="neo-label">Current Business Name</label>
                <div className="neo-info-text client-current-name">{selectedClient.businessName}</div>
              </div>
            </>
          )}
          
          <div className="client-warning-box">
            <strong>⚠️ Important:</strong> Changing a client's legal name is a significant action. 
            This change will be permanently recorded in the audit trail with your user ID and the reason provided.
          </div>

          <Input
            label="New Business Name"
            name="newBusinessName"
            value={changeNameForm.newBusinessName}
            onChange={(e) => setChangeNameForm({ ...changeNameForm, newBusinessName: e.target.value })}
            placeholder="Enter new business name"
            required
          />

          <div className="neo-form-group">
            <FormLabel label="Reason for Name Change" required />
            <textarea
              name="reason"
              value={changeNameForm.reason}
              onChange={(e) => setChangeNameForm({ ...changeNameForm, reason: e.target.value })}
              placeholder="Enter reason for legal name change (e.g., merger, rebranding, legal restructuring)"
              required
              rows="4"
              className="client-reason-textarea"
            />
          </div>

          <div className="neo-form-actions">
            <Button
              type="button"
              variant="default"
              onClick={handleCloseChangeNameModal}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="warning"
              disabled={submitting}
            >
              {submitting ? 'Changing Name...' : 'Confirm Name Change'}
            </Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
};
