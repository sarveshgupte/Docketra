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

export const useCasesListQuery = ({ isAdmin, hasQcAccess = false, enabled = true }) =>
  useQuery({
    queryKey: ['cases-list', isAdmin ? 'admin' : 'employee', hasQcAccess ? 'qc' : 'no-qc'],
    queryFn: async () => {
      let casesData = [];
      if (isAdmin) {
        const response = await caseApi.getCases();
        if (response.success) {
          casesData = getCaseListRecords(response);
        }
      } else if (hasQcAccess) {
        // Non-admin users with QC access: fetch both their regular worklist
        // and QC_PENDING cases, then merge deduplicating by caseId.
        const [qcResponse, worklistResponse] = await Promise.all([
          caseApi.getCases({ status: CASE_STATUS.QC_PENDING }),
          worklistApi.getEmployeeWorklist(),
        ]);
        const qcCases = qcResponse.success ? getCaseListRecords(qcResponse) : [];
        const worklistCases = worklistResponse.success ? (worklistResponse.data || []) : [];
        const seenIds = new Set();
        casesData = [...qcCases, ...worklistCases].filter((c) => {
          const id = c.caseId || c._id;
          if (!id || seenIds.has(String(id))) return false;
          seenIds.add(String(id));
          return true;
        });
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
