import React from 'react';
import { Navigate, Route, useParams } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { TASK_MANAGER_MVP_ENABLED, isPilotFirmRouteEnabled } from '../constants/pilotSurface';
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
  SuperadminFirmDetailPage,
  SuperadminAuditLogPage,
  SuperadminFirmHealthPage,
  SuperadminPlansPage,
  SuperadminPilotReadinessPage,
  SuperadminFeatureFlagsPage,
  SuperadminAiAssistantPage,
  ProfilePage,
  ProductUpdatesHistoryPage,
  ReportsDashboard,
  StorageSettingsPage,
  DataStorageMapPage,
  StorageOAuthSuccessPage,
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
  CompanyBrainPage,
  KnowledgeLibraryPage,
  PlatformSettingsPage,
  DocketraIntelligencePage,
} from './lazyPages';
import { RouteSuspenseOutlet } from './RouteSuspenseOutlet';
import { NotificationHistoryView } from '../../views/NotificationHistoryView';
import { DefaultRoute } from '../components/routing/DefaultRoute';

const LegacyCaseDetailRedirect = () => {
  const { caseId } = useParams();
  return <Navigate to={`../dockets/${caseId}`} replace />;
};

const PilotRouteGate = ({ subPath, children }) => {
  if (!TASK_MANAGER_MVP_ENABLED || isPilotFirmRouteEnabled(subPath)) return children;
  return <Navigate to="../worklist" replace />;
};

export const ProtectedRoutes = () => (
  <>
    <Route element={<RouteSuspenseOutlet />}>
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
        path="/app/superadmin/firms/:firmId"
        element={(
          <ProtectedRoute requireSuperadmin>
            <SuperadminFirmDetailPage />
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
        path="/app/superadmin/firm-health"
        element={(
          <ProtectedRoute requireSuperadmin>
            <SuperadminFirmHealthPage />
          </ProtectedRoute>
        )}
      />

      <Route
        path="/app/superadmin/plans"
        element={(
          <ProtectedRoute requireSuperadmin>
            <SuperadminPlansPage />
          </ProtectedRoute>
        )}
      />


      <Route
        path="/app/superadmin/feature-flags"
        element={(
          <ProtectedRoute requireSuperadmin>
            <SuperadminFeatureFlagsPage />
          </ProtectedRoute>
        )}
      />

      <Route
        path="/app/superadmin/pilot-readiness"
        element={(
          <ProtectedRoute requireSuperadmin>
            <SuperadminPilotReadinessPage />
          </ProtectedRoute>
        )}
      />

      <Route
        path="/app/superadmin/audit"
        element={(
          <ProtectedRoute requireSuperadmin>
            <SuperadminAuditLogPage />
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
        path="/superadmin/ai-assistant"
        element={<Navigate to="/app/superadmin/ai-assistant" replace />}
      />

      <Route
        path="/app/superadmin/ai-assistant"
        element={(
          <ProtectedRoute requireSuperadmin>
            <SuperadminAiAssistantPage />
          </ProtectedRoute>
        )}
      />
    </Route>

    <Route
      path="/storage/success"
      element={(
        <ProtectedRoute>
          <StorageOAuthSuccessPage />
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
            <ProtectedRoute>
              <Navigate to="../worklist" replace />
            </ProtectedRoute>
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
          path="workbaskets/:workbasketId"
          element={(
            <ProtectedRoute requireAssignedWorkbasket>
              <PlatformWorkbasketsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="docketra-intelligence"
          element={(
            <ProtectedRoute requireManagerOrAbove>
              <DocketraIntelligencePage />
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
          path="qc-workbaskets/:workbasketId"
          element={(
            <ProtectedRoute requireAssignedQcWorkbasket>
              <PlatformQcQueuePage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="compliance-control"
          element={(
            <ProtectedRoute>
              <Navigate to="../compliance-calendar" replace />
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
            <ProtectedRoute requireClientManage>
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
            <PilotRouteGate subPath="crm">
            <ProtectedRoute requireAdmin>
              <PlatformCrmPage />
            </ProtectedRoute>
            </PilotRouteGate>
          )}
        />
        <Route
          path="crm/clients"
          element={(
            <PilotRouteGate subPath="crm/clients">
            <ProtectedRoute requireAdmin>
              <CrmClientsPage />
            </ProtectedRoute>
            </PilotRouteGate>
          )}
        />
        <Route
          path="crm/clients/:crmClientId"
          element={(
            <PilotRouteGate subPath="crm/clients/:crmClientId">
            <ProtectedRoute requireAdmin>
              <CrmClientDetailPage />
            </ProtectedRoute>
            </PilotRouteGate>
          )}
        />
        <Route
          path="crm/leads"
          element={(
            <PilotRouteGate subPath="crm/leads">
            <ProtectedRoute requireAdmin>
              <LeadsPage />
            </ProtectedRoute>
            </PilotRouteGate>
          )}
        />
        <Route
          path="cms"
          element={(
            <PilotRouteGate subPath="cms">
            <ProtectedRoute requireAdmin>
              <PlatformCmsPage />
            </ProtectedRoute>
            </PilotRouteGate>
          )}
        />
        <Route
          path="company-brain"
          element={(
            <PilotRouteGate subPath="company-brain">
            <ProtectedRoute requireAdmin>
              <CompanyBrainPage />
            </ProtectedRoute>
            </PilotRouteGate>
          )}
        />
        <Route
          path="knowledge"
          element={(
            <PilotRouteGate subPath="knowledge">
            <ProtectedRoute requireAdmin>
              <KnowledgeLibraryPage />
            </ProtectedRoute>
            </PilotRouteGate>
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
            <PilotRouteGate subPath="updates">
            <ProtectedRoute>
              <ProductUpdatesHistoryPage />
            </ProtectedRoute>
            </PilotRouteGate>
          )}
        />
        <Route
          path="settings/firm"
          element={(
            <PilotRouteGate subPath="settings/firm">
              <ProtectedRoute requireAdmin>
                <FirmSettingsPage />
              </ProtectedRoute>
            </PilotRouteGate>
          )}
        />
        <Route
          path="settings/work"
          element={(
            <ProtectedRoute requireManagerOrAbove>
              <WorkSettingsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="settings"
          element={(
            <PilotRouteGate subPath="settings">
              <ProtectedRoute requireManagerOrAbove>
                <PlatformSettingsPage />
              </ProtectedRoute>
            </PilotRouteGate>
          )}
        />
        <Route
          path="storage-settings"
          element={(
            <PilotRouteGate subPath="storage-settings">
            <ProtectedRoute requireAdmin>
              <StorageSettingsPage />
            </ProtectedRoute>
            </PilotRouteGate>
          )}
        />
        <Route
          path="data-storage-map"
          element={(
            <PilotRouteGate subPath="data-storage-map">
            <ProtectedRoute requireAdmin>
              <DataStorageMapPage />
            </ProtectedRoute>
            </PilotRouteGate>
          )}
        />
        <Route
          path="ai-settings"
          element={(
            <PilotRouteGate subPath="ai-settings">
            <ProtectedRoute requireAdmin>
              <AiSettingsPage />
            </ProtectedRoute>
            </PilotRouteGate>
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
            <PilotRouteGate subPath="admin/reports">
            <ProtectedRoute requireAdmin>
              <PlatformReportsPage />
            </ProtectedRoute>
            </PilotRouteGate>
          )}
        />
        <Route
          path="admin/reports/detailed"
          element={(
            <PilotRouteGate subPath="admin/reports/detailed">
            <ProtectedRoute requireAdmin>
              <DetailedReports />
            </ProtectedRoute>
            </PilotRouteGate>
          )}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Route>
  </>
);
