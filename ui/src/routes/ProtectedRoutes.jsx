import React from 'react';
import { Navigate, Route, useParams } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { FirmLayout } from '../components/routing/FirmLayout';
import { RouteErrorBoundary } from '../components/routing/RouteErrorBoundary';
import {
  AdminPage,
  AuditLogsPage,
  AiSettingsPage,
  CaseDetailPage,
  CasesPage,
  ClientWorkspacePage,
  ComplianceCalendarPage,
  ClientsPage,
  CreateCasePage,
  CrmClientsPage,
  CrmClientDetailPage,
  DashboardPage,
  DetailedReports,
  FirmSettingsPage,
  HierarchyPage,
  FirmsManagement,
  LeadsPage,
  NotFoundPage,
  PlatformDashboard,
  SuperadminOnboardingInsightsPage,
  SuperadminFirmOnboardingDetailPage,
  SuperadminDiagnosticsPage,
  ProfilePage,
  ProductUpdatesHistoryPage,
  ReportsDashboard,
  StorageSettingsPage,
  WorkbasketPage,
  WorkSettingsPage,
  WorklistPage,
  PlatformDashboardPage,
  PlatformWorkbasketsPage,
  PlatformWorklistPage,
  PlatformQcQueuePage,
  PlatformReportsPage,
  PlatformCrmPage,
  PlatformCmsPage,
  PlatformTaskManagerPage,
  PlatformSettingsPage,
} from './lazyPages';
import { RouteSuspenseOutlet } from './RouteSuspenseOutlet';
import { NotificationHistoryView } from '../../views/NotificationHistoryView';
import { DefaultRoute } from '../components/routing/DefaultRoute';

const LegacyCaseDetailRedirect = () => {
  const { caseId } = useParams();
  return <Navigate to={`../dockets/${caseId}`} replace />;
};

export const ProtectedRoutes = () => (
  <>
    <Route
      path="/app/superadmin"
      element={(
        <ProtectedRoute requireSuperadmin>
          <PlatformDashboard />
        </ProtectedRoute>
      )}
    />

    <Route
      path="/app/superadmin/firms"
      element={(
        <ProtectedRoute requireSuperadmin>
          <FirmsManagement />
        </ProtectedRoute>
      )}
    />


    <Route
      path="/app/superadmin/diagnostics"
      element={(
        <ProtectedRoute requireSuperadmin>
          <SuperadminDiagnosticsPage />
        </ProtectedRoute>
      )}
    />

    <Route
      path="/app/superadmin/onboarding-insights"
      element={(
        <ProtectedRoute requireSuperadmin>
          <SuperadminOnboardingInsightsPage />
        </ProtectedRoute>
      )}
    />


    <Route
      path="/app/superadmin/onboarding-insights/:firmId"
      element={(
        <ProtectedRoute requireSuperadmin>
          <SuperadminFirmOnboardingDetailPage />
        </ProtectedRoute>
      )}
    />


    <Route
      path="/app/dashboard"
      element={(
        <ProtectedRoute>
          <DefaultRoute />
        </ProtectedRoute>
      )}
    />

    <Route path="/app/firm/:firmSlug" element={<FirmLayout />}>
      <Route element={<RouteSuspenseOutlet />}>
        <Route
          path="dashboard"
          element={(
            <RouteErrorBoundary title="Unable to load dashboard" message="Please retry or return to your previous page.">
              <ProtectedRoute>
                <PlatformDashboardPage />
              </ProtectedRoute>
            </RouteErrorBoundary>
          )}
        />
        <Route
          path="notifications"
          element={(
            <ProtectedRoute>
              <NotificationHistoryView />
            </ProtectedRoute>
          )}
        />
        <Route
          path="worklist"
          element={(
            <ProtectedRoute>
              <PlatformWorklistPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="my-worklist"
          element={(
            <ProtectedRoute>
              <PlatformWorklistPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="global-worklist"
          element={(
            <ProtectedRoute>
              <PlatformWorkbasketsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="qc-queue"
          element={(
            <ProtectedRoute>
              <PlatformQcQueuePage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="compliance-calendar"
          element={(
            <ProtectedRoute>
              <ComplianceCalendarPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="clients"
          element={(
            <ProtectedRoute>
              <ClientsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="clients/:clientId"
          element={(
            <ProtectedRoute>
              <ClientWorkspacePage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="clients/:clientId/cfs"
          element={(
            <ProtectedRoute>
              <ClientWorkspacePage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="clients/:clientId/compliance"
          element={(
            <ProtectedRoute>
              <ClientWorkspacePage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="clients/:clientId/documents"
          element={(
            <ProtectedRoute>
              <ClientWorkspacePage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="clients/:clientId/dockets"
          element={(
            <ProtectedRoute>
              <ClientWorkspacePage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="clients/:clientId/activity"
          element={(
            <ProtectedRoute>
              <ClientWorkspacePage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="crm"
          element={(
            <ProtectedRoute requireAdmin>
              <PlatformCrmPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="crm/clients"
          element={(
            <ProtectedRoute requireAdmin>
              <CrmClientsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="crm/clients/:crmClientId"
          element={(
            <ProtectedRoute requireAdmin>
              <CrmClientDetailPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="crm/leads"
          element={(
            <ProtectedRoute requireAdmin>
              <LeadsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="cms"
          element={(
            <ProtectedRoute requireAdmin>
              <PlatformCmsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="task-manager"
          element={(
            <ProtectedRoute>
              <PlatformTaskManagerPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="dockets/:caseId"
          element={(
            <RouteErrorBoundary title="Unable to load docket" message="Docket actions are temporarily unavailable. Please retry from the dockets list.">
              <ProtectedRoute>
                <CaseDetailPage />
              </ProtectedRoute>
            </RouteErrorBoundary>
          )}
        />
        <Route
          path="dockets"
          element={(
            <ProtectedRoute>
              <CasesPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="dockets/create"
          element={(
            <ProtectedRoute>
              <CreateCasePage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="cases/:caseId"
          element={<LegacyCaseDetailRedirect />}
        />
        <Route
          path="cases"
          element={<Navigate to="../dockets" replace />}
        />
        <Route
          path="cases/create"
          element={<Navigate to="../dockets/create" replace />}
        />
        <Route
          path="profile"
          element={(
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="updates"
          element={(
            <ProtectedRoute>
              <ProductUpdatesHistoryPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="settings/firm"
          element={(
            <ProtectedRoute requireAdmin>
              <FirmSettingsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="settings/work"
          element={(
            <ProtectedRoute requireAdmin>
              <WorkSettingsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="settings"
          element={(
            <ProtectedRoute requireAdmin>
              <PlatformSettingsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="storage-settings"
          element={(
            <ProtectedRoute requireAdmin>
              <StorageSettingsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="ai-settings"
          element={(
            <ProtectedRoute requireAdmin>
              <AiSettingsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="admin"
          element={(
            <ProtectedRoute requireAdmin>
              <AdminPage />
            </ProtectedRoute>
          )}
        />

        <Route
          path="admin/hierarchy"
          element={(
            <ProtectedRoute requireAdmin>
              <HierarchyPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="admin/audit-logs"
          element={(
            <ProtectedRoute requireAdmin>
              <AuditLogsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="admin/reports"
          element={(
            <ProtectedRoute requireAdmin>
              <PlatformReportsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="admin/reports/detailed"
          element={(
            <ProtectedRoute requireAdmin>
              <DetailedReports />
            </ProtectedRoute>
          )}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Route>
  </>
);
