import React from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { FirmLayout } from '../components/routing/FirmLayout';
import { RouteErrorBoundary } from '../components/routing/RouteErrorBoundary';
import {
  AdminPage,
  CaseDetailPage,
  CasesPage,
  ClientWorkspacePage,
  ComplianceCalendarPage,
  ClientsPage,
  CreateCasePage,
  DashboardPage,
  DetailedReports,
  FirmSettingsPage,
  FirmsManagement,
  NotFoundPage,
  PlatformDashboard,
  ProfilePage,
  ReportsDashboard,
  StorageSettingsPage,
  WorkbasketPage,
  WorkSettingsPage,
  WorklistPage,
} from './lazyPages';
import { RouteSuspenseOutlet } from './RouteSuspenseOutlet';

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

    <Route path="/app/firm/:firmSlug" element={<FirmLayout />}>
      <Route element={<RouteSuspenseOutlet />}>
        <Route
          path="dashboard"
          element={(
            <RouteErrorBoundary title="Unable to load dashboard" message="Please retry or return to your previous page.">
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            </RouteErrorBoundary>
          )}
        />
        <Route
          path="worklist"
          element={(
            <ProtectedRoute>
              <WorklistPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="my-worklist"
          element={(
            <ProtectedRoute>
              <WorklistPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="global-worklist"
          element={(
            <ProtectedRoute>
              <WorkbasketPage />
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
          path="cases/:caseId"
          element={(
            <ProtectedRoute>
              <CaseDetailPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="cases"
          element={(
            <RouteErrorBoundary title="Unable to load cases" message="Cases could not be loaded right now. Please retry.">
              <ProtectedRoute>
                <CasesPage />
              </ProtectedRoute>
            </RouteErrorBoundary>
          )}
        />
        <Route
          path="cases/create"
          element={(
            <ProtectedRoute>
              <CreateCasePage />
            </ProtectedRoute>
          )}
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
          path="storage-settings"
          element={(
            <ProtectedRoute requireAdmin>
              <StorageSettingsPage />
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
          path="admin/reports"
          element={(
            <ProtectedRoute requireAdmin>
              <ReportsDashboard />
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
