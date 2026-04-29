import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { caseApi } from '../api/case.api';
import { categoryService } from '../services/categoryService';
import { getCaseListRecords } from '../utils/caseResponse';
import { CASE_STATUS } from '../utils/constants';
import { WORK_TYPE, normalizeWorkTypeFilter } from '../utils/workType';

const normalizeCases = (records = []) =>
  records.map((record) => ({
    ...record,
    caseId: record.caseId || record._id,
  }));

export const useCasesListQuery = ({
  isAdmin,
  userRole = '',
  hasQcAccess = false,
  statusFilter = 'ALL',
  workTypeFilter = 'ALL',
  activeWorkbasketId = '',
  enabled = true,
}) =>
  // Roles in product terms: PRIMARY_ADMIN, ADMIN, MANAGER, USER.
  // "isAdmin" is a convenience boolean, but query keys should stay role-aware
  // and avoid generic "employee" wording.
  useQuery({
    queryKey: [
      'cases-list',
      isAdmin ? 'admin-scope' : 'non-admin-scope',
      String(userRole || '').toUpperCase() || 'UNKNOWN_ROLE',
      hasQcAccess ? 'qc' : 'no-qc',
      statusFilter || 'ALL',
      normalizeWorkTypeFilter(workTypeFilter),
      activeWorkbasketId || 'no-workbasket',
    ],
    queryFn: async () => {
      let casesData = [];
      const normalizedWorkTypeFilter = normalizeWorkTypeFilter(workTypeFilter);
      if (statusFilter === CASE_STATUS.QC_PENDING) {
        if (!hasQcAccess) {
          casesData = [];
        } else {
          const qcFilters = { status: CASE_STATUS.QC_PENDING };
          if (normalizedWorkTypeFilter !== WORK_TYPE.ALL) qcFilters.workType = normalizedWorkTypeFilter;
          if (activeWorkbasketId) qcFilters.workbasketId = activeWorkbasketId;
          const response = await caseApi.getCases(qcFilters);
          if (response.success) {
            casesData = getCaseListRecords(response);
          }
        }
      } else if (statusFilter === CASE_STATUS.RESOLVED || statusFilter === CASE_STATUS.FILED) {
        const response = await caseApi.getCases({
          status: statusFilter,
          ...(normalizedWorkTypeFilter !== WORK_TYPE.ALL ? { workType: normalizedWorkTypeFilter } : {}),
        });
        if (response.success) {
          casesData = getCaseListRecords(response);
        }
      } else {
        const filters = {};
        if (statusFilter !== 'ALL') {
          filters.status = statusFilter;
        }
        if (normalizedWorkTypeFilter !== WORK_TYPE.ALL) {
          filters.workType = normalizedWorkTypeFilter;
        }
        const response = await caseApi.getCases(filters);
        if (response.success) {
          casesData = getCaseListRecords(response);
        }
      }

      return { cases: normalizeCases(casesData) };
    },
    enabled: Boolean(enabled),
    placeholderData: keepPreviousData,
    staleTime: 90 * 1000,
    gcTime: 20 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

export const useCategoryCountQuery = ({ isAdmin, enabled = true }) =>
  useQuery({
    queryKey: ['reference-data', 'categories', isAdmin ? 'admin' : 'non-admin'],
    queryFn: async () => {
      if (!isAdmin) return 0;
      const categoriesResponse = await categoryService.getCategories(false);
      return categoriesResponse?.data?.length || 0;
    },
    enabled: Boolean(enabled && isAdmin),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
