/**
 * Detailed Reports Page
 * Tabular reports with filters and export functionality
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../../components/common/Layout';
import { EmptyState } from '../../components/ui/EmptyState';
import { FilterPanel } from '../../components/reports/FilterPanel';
import { ReportsTable } from '../../components/reports/ReportsTable';
import { ExportModal } from './ExportModal';
import { Loading } from '../../components/common/Loading';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';
import { reportsService } from '../../services/reports.service';
import { formatDateTime, formatRelativeTime } from '../../utils/formatDateTime';
import './DetailedReports.css';

export const DetailedReports = () => {
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [cases, setCases] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [exportHistory, setExportHistory] = useState([]);

  const [filters, setFilters] = useState({
    fromDate: '',
    toDate: '',
    status: '',
    category: '',
    page: 1,
    limit: 50,
  });

  const [exportModal, setExportModal] = useState({
    isOpen: false,
    type: null,
    loading: false,
  });

  useEffect(() => {
    loadCategories();
    loadExportHistory();
  }, []);

  const loadCategories = async () => {
    // For now, we'll use static categories
    // In a real app, you'd fetch from an API
    setCategories([
      'Client - New',
      'Client - Edit',
      'Tax Compliance',
      'Audit',
      'GST Filing',
      'Other',
    ]);
  };

  const loadExportHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await reportsService.getExportHistory({ limit: 25 });
      const items = response?.data?.data?.items || [];
      setExportHistory(items);
    } catch (err) {
      console.error('Failed to load export history', err);
      setExportHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleApplyFilters = async () => {
    if (!filters.fromDate || !filters.toDate) {
      setError('Please select both From Date and To Date');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await reportsService.getCasesByDate(filters);
      if (response.data.success) {
        setCases(response.data.data.cases);
        setPagination(response.data.data.pagination);
      }
    } catch (err) {
      console.error('Error loading cases:', err);
      if (!err.response) {
        setError('Unable to connect to server');
      } else if (err.response?.status === 404) {
        setCases([]);
        setPagination(null);
      } else if (err.response?.status === 401 || err.response?.status === 403) {
        setError('You do not have permission');
      } else if (err.response?.status >= 500) {
        setError('Something went wrong. Please try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setFilters({
      fromDate: '',
      toDate: '',
      status: '',
      category: '',
      page: 1,
      limit: 50,
    });
    setCases([]);
    setPagination(null);
    setError(null);
  };

  const handlePageChange = (newPage) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
    // Reload with new page
    handleApplyFilters();
  };

  const handleCaseClick = (caseId) => {
    navigate(`/app/firm/${firmSlug}/cases/${caseId}`);
  };

  const handleExport = (type) => {
    if (!filters.fromDate || !filters.toDate) {
      setError('Please apply filters before exporting');
      return;
    }

    setExportModal({
      isOpen: true,
      type,
      loading: false,
    });
  };

  const handleConfirmExport = async () => {
    setExportModal((prev) => ({ ...prev, loading: true }));

    try {
      const exportFilters = {
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        status: filters.status,
        category: filters.category,
      };

      const response =
        exportModal.type === 'csv'
          ? await reportsService.exportCSV(exportFilters)
          : await reportsService.exportExcel(exportFilters);

      // Create blob and download
      const blob = new Blob([response.data], {
        type:
          exportModal.type === 'csv'
            ? 'text/csv'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      link.download = `docketra-report-${dateStr}.${exportModal.type === 'csv' ? 'csv' : 'xlsx'}`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportModal({ isOpen: false, type: null, loading: false });
      loadExportHistory();
      
      // Show success message (you could add a toast here)
      console.log('Report exported successfully');
    } catch (err) {
      console.error('Error exporting:', err);
      setError('Failed to export report. Please try again.');
      setExportModal({ isOpen: false, type: null, loading: false });
    }
  };

  return (
    <Layout>
      <div className="detailed-reports">
        <div className="detailed-reports__header">
          <div>
            <h1>Detailed Reports</h1>
            <p className="text-secondary">Filter and export case data</p>
          </div>

          <div className="detailed-reports__export-buttons">
            <Button onClick={() => handleExport('csv')} disabled={cases.length === 0}>
              Export as CSV
            </Button>
            <Button variant="primary" onClick={() => handleExport('excel')} disabled={cases.length === 0}>
              Export as Excel
            </Button>
          </div>
        </div>

        {error && (
          <div className="detailed-reports__error">
            <p>{error}</p>
          </div>
        )}

        <FilterPanel
          filters={filters}
          onFilterChange={handleFilterChange}
          onApplyFilters={handleApplyFilters}
          onClearFilters={handleClearFilters}
          categories={categories}
        />

        {loading ? (
          <Loading message="Loading cases..." />
        ) : (
          cases.length === 0 && !error ? (
            <EmptyState
              title="No reports available yet"
              description="Apply filters or create activity to generate report data."
            />
          ) : (
            <ReportsTable
              cases={cases}
              onCaseClick={handleCaseClick}
              pagination={pagination}
              onPageChange={handlePageChange}
            />
          )
        )}

        <ExportModal
          isOpen={exportModal.isOpen}
          onClose={() => setExportModal({ isOpen: false, type: null, loading: false })}
          onConfirm={handleConfirmExport}
          exportType={exportModal.type}
          filters={filters}
          recordCount={pagination?.total || 0}
          loading={exportModal.loading}
        />

        <section className="detailed-reports__history">
          <div className="detailed-reports__history-header">
            <h2>Export History</h2>
            <Button variant="default" onClick={loadExportHistory} disabled={historyLoading}>
              {historyLoading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
          <p className="text-secondary">
            Detailed history of CSV/Excel exports with admin xID, timestamp and filter criteria.
          </p>

          {historyLoading ? (
            <Loading message="Loading export history..." />
          ) : exportHistory.length === 0 ? (
            <EmptyState
              title="No export history yet"
              description="Once admins export reports, each CSV/Excel action will appear here."
            />
          ) : (
            <div className="detailed-reports__history-table-wrap">
              <table className="neo-table">
                <thead>
                  <tr>
                    <th>Exported At</th>
                    <th>Format</th>
                    <th>Records</th>
                    <th>Admin xID</th>
                    <th>Admin</th>
                    <th>Filters</th>
                    <th>File</th>
                  </tr>
                </thead>
                <tbody>
                  {exportHistory.map((entry) => (
                    <tr key={entry._id}>
                      <td>
                        <div>{formatDateTime(entry.exportedAt)}</div>
                        <small className="text-secondary">{formatRelativeTime(entry.exportedAt)}</small>
                      </td>
                      <td>{String(entry.exportType || '').toUpperCase()}</td>
                      <td>{entry.totalRecords || 0}</td>
                      <td>{entry.exportedByXID || 'N/A'}</td>
                      <td>
                        <div>{entry.exportedByName || 'Unknown'}</div>
                        <small className="text-secondary">{entry.exportedByEmail || 'N/A'}</small>
                      </td>
                      <td>
                        <div>From: {entry.filters?.fromDate || 'N/A'}</div>
                        <div>To: {entry.filters?.toDate || 'N/A'}</div>
                        <div>Status: {entry.filters?.status || 'All'}</div>
                        <div>Category: {entry.filters?.category || 'All'}</div>
                      </td>
                      <td>{entry.filename || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
};
