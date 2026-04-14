import { useQuery } from '@tanstack/react-query';
import { caseApi } from '../api/case.api';
import { worklistApi } from '../api/worklist.api';
import { categoryService } from '../services/categoryService';
import { getCaseListRecords } from '../utils/caseResponse';

const normalizeCases = (records = []) =>
  records.map((record) => ({
    ...record,
    caseId: record.caseId || record._id,
  }));

export const useCasesListQuery = ({ isAdmin, enabled = true }) =>
  useQuery({
    queryKey: ['cases-list', isAdmin ? 'admin' : 'employee'],
    queryFn: async () => {
      let casesData = [];
      if (isAdmin) {
        const response = await caseApi.getCases();
        if (response.success) {
          casesData = getCaseListRecords(response);
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
