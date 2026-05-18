import { useCallback, useEffect, useMemo, useState } from 'react';
import { caseApi } from '../../api/case.api';
import { categoryService } from '../../services/categoryService';
import { extractErrorMessage } from '../../services/apiResponse';
import { ROUTES } from '../../constants/routes';

export const useDocketClone = ({ caseId, firmSlug, returnTo, canCloneDocket, navigate, showSuccess, showError, showWarning, setActionConfirmation, setActionError }) => {
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [cloneCategoryId, setCloneCategoryId] = useState('');
  const [cloneSubcategoryId, setCloneSubcategoryId] = useState('');
  const [cloningCase, setCloningCase] = useState(false);
  const [categoryCatalog, setCategoryCatalog] = useState([]);
  const [loadingCloneCatalog, setLoadingCloneCatalog] = useState(false);

  useEffect(() => {
    if (!cloneModalOpen || !canCloneDocket) return;
    let ignore = false;
    const loadCategories = async () => {
      setLoadingCloneCatalog(true);
      try {
        const response = await categoryService.getCategories(true);
        if (!ignore) setCategoryCatalog(response?.data || []);
      } catch (_error) {
        if (!ignore) {
          setCategoryCatalog([]);
          showError('Unable to load categories for cloning.');
        }
      } finally {
        if (!ignore) setLoadingCloneCatalog(false);
      }
    };
    loadCategories();
    return () => { ignore = true; };
  }, [canCloneDocket, cloneModalOpen, showError]);

  const selectedCloneCategory = useMemo(() => categoryCatalog.find((entry) => entry._id === cloneCategoryId), [categoryCatalog, cloneCategoryId]);
  const cloneSubcategories = useMemo(() => (selectedCloneCategory?.subcategories || []).filter((entry) => entry?.isActive !== false), [selectedCloneCategory]);

  const handleCloneDocket = useCallback(async () => {
    if (!cloneCategoryId || !cloneSubcategoryId) {
      showWarning('Select category and subcategory before cloning.');
      return;
    }
    setCloningCase(true);
    try {
      const response = await caseApi.cloneCase(caseId, { categoryId: cloneCategoryId, subcategoryId: cloneSubcategoryId });
      const clonedId = response?.data?.caseId || response?.data?.docketId || response?.caseId || response?.docketId || 'new docket';
      const message = `Docket cloned successfully: ${clonedId}. It has been moved to the Workbasket.`;
      showSuccess(message);
      setActionConfirmation(message);
      setCloneModalOpen(false);
      setCloneCategoryId('');
      setCloneSubcategoryId('');
      setActionError(null);
      if (clonedId && clonedId !== 'new docket') navigate(ROUTES.CASE_DETAIL(firmSlug, clonedId), { state: { returnTo } });
    } catch (error) {
      const message = extractErrorMessage(error, 'Failed to clone docket. Please try again.');
      showError(message);
      setActionError({ message, retry: handleCloneDocket });
    } finally {
      setCloningCase(false);
    }
  }, [caseId, cloneCategoryId, cloneSubcategoryId, firmSlug, navigate, returnTo, setActionConfirmation, setActionError, showError, showSuccess, showWarning]);

  return { cloneModalOpen, setCloneModalOpen, cloneCategoryId, setCloneCategoryId, cloneSubcategoryId, setCloneSubcategoryId, cloningCase, loadingCloneCatalog, categoryCatalog, selectedCloneCategory, cloneSubcategories, handleCloneDocket };
};
