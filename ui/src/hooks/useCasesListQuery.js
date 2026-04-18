import { useQuery } from '@tanstack/react-query';
import { caseApi } from '../api/case.api';
import { worklistApi } from '../api/worklist.api';
import { categoryService } from '../services/categoryService';
import { getCaseListRecords } from '../utils/caseResponse';
import { CASE_STATUS } from '../utils/constants';

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
      workTypeFilter || 'ALL',
      activeWorkbasketId || 'no-workbasket',
    ],
    queryFn: async () => {
      let casesData = [];
      if (isAdmin) {
        const response = await caseApi.getCases(
          workTypeFilter !== 'ALL' ? { workType: workTypeFilter } : {}
        );
        if (response.success) {
          casesData = getCaseListRecords(response);
        }
      } else if (statusFilter === CASE_STATUS.QC_PENDING) {
        if (!hasQcAccess) {
          casesData = [];
        } else {
          const qcFilters = { status: CASE_STATUS.QC_PENDING };
          if (workTypeFilter !== 'ALL') qcFilters.workType = workTypeFilter;
          if (activeWorkbasketId) qcFilters.workbasketId = activeWorkbasketId;
          const response = await caseApi.getCases(qcFilters);
          if (response.success) {
            casesData = getCaseListRecords(response);
          }
        }
      } else if (statusFilter === CASE_STATUS.RESOLVED || statusFilter === CASE_STATUS.FILED) {
        const response = await caseApi.getCases({
          status: statusFilter,
          ...(workTypeFilter !== 'ALL' ? { workType: workTypeFilter } : {}),
        });
        if (response.success) {
          casesData = getCaseListRecords(response);
        }
      } else if (workTypeFilter !== 'ALL') {
        const response = await caseApi.getCases({ workType: workTypeFilter });
        if (response.success) {
          casesData = getCaseListRecords(response).filter((item) => {
            if (statusFilter === 'ALL') return true;
            return item.status === statusFilter;
          });
        }
      } else {
        const response = await worklistApi.getEmployeeWorklist();
        if (response.success) {
          casesData = response.data || [];
        }
      }

      let categoryCount = 0;
      if (isAdmin) {
        const categoriesResponse = await categoryService.getCategories(false);
        categoryCount = categoriesResponse?.data?.length || 0;
      }

      return { cases: normalizeCases(casesData), categoryCount };
    },
    enabled: Boolean(enabled),
  });
