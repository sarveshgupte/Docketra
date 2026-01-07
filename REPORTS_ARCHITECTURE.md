# Reports & MIS Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          DOCKETRA REPORTS & MIS                      │
│                         (Read-Only Reporting Layer)                  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                            FRONTEND (React)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  /admin/reports (Reports Dashboard)                           │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │  │
│  │  │ Total      │  │ Pending    │  │ Top        │              │  │
│  │  │ Cases      │  │ Cases      │  │ Categories │              │  │
│  │  │ Card       │  │ Card       │  │ Card       │              │  │
│  │  └────────────┘  └────────────┘  └────────────┘              │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │  │
│  │  │ Top        │  │ Ageing     │  │ Top        │              │  │
│  │  │ Clients    │  │ Breakdown  │  │ Employees  │              │  │
│  │  │ Card       │  │ Card       │  │ Card       │              │  │
│  │  └────────────┘  └────────────┘  └────────────┘              │  │
│  │                 [View Detailed Reports Button]                │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  /admin/reports/detailed (Detailed Reports)                   │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │  Filter Panel (Inset Shadow)                            │  │  │
│  │  │  [From Date] [To Date] [Status] [Category]             │  │  │
│  │  │  [Apply Filters] [Clear Filters]                       │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │  Reports Table (Neomorphic Card)                        │  │  │
│  │  │  ┌────────────────────────────────────────────────────┐ │  │  │
│  │  │  │ CaseID | Name | Title | Status | Category | ...   │ │  │  │
│  │  │  ├────────────────────────────────────────────────────┤ │  │  │
│  │  │  │ DCK-01 | ...  | ...   | Open   | Tax      | ...   │ │  │  │
│  │  │  │ DCK-02 | ...  | ...   | Closed | Client   | ...   │ │  │  │
│  │  │  └────────────────────────────────────────────────────┘ │  │  │
│  │  │  [Previous] Page 1 of 5 [Next]                          │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │  [Export as CSV] [Export as Excel]                            │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Export Modal (Confirmation)                                  │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │  Export Docketra Report                                 │  │  │
│  │  │  You are about to export 150 records as CSV            │  │  │
│  │  │  Applied Filters:                                       │  │  │
│  │  │  • From Date: 2026-01-01                               │  │  │
│  │  │  • To Date: 2026-12-31                                 │  │  │
│  │  │  • Status: Open                                         │  │  │
│  │  │  [Cancel] [Confirm Export]                             │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
└───────────────────────────────────────────────────────────────────┬─┘
                                                                      │
                        ┌─────────────────────────────────────────────┘
                        │ HTTP/HTTPS (x-user-id header)
                        │ Admin Authentication Required
                        │
┌───────────────────────▼───────────────────────────────────────────┐
│                   BACKEND API (Express.js)                         │
├─────────────────────────────────────────────────────────────────┬─┤
│  Middleware Stack:                                              │ │
│  ┌──────────────────────────────────────────────────────────┐   │ │
│  │ 1. authenticate (validate xID)                            │   │ │
│  │ 2. requireAdmin (check role === 'Admin')                 │   │ │
│  └──────────────────────────────────────────────────────────┘   │ │
│                                                                  │ │
│  Report Routes (/api/reports/*):                                │ │
│  ┌──────────────────────────────────────────────────────────┐   │ │
│  │ GET /case-metrics                                         │   │ │
│  │   → getCaseMetrics()                                      │   │ │
│  │   → Aggregate by status/category/client/employee         │   │ │
│  │   → Returns: totalCases, byStatus, byCategory, ...       │   │ │
│  └──────────────────────────────────────────────────────────┘   │ │
│  ┌──────────────────────────────────────────────────────────┐   │ │
│  │ GET /pending-cases                                        │   │ │
│  │   → getPendingCasesReport()                              │   │ │
│  │   → Calculate ageing (today - pendingUntil)              │   │ │
│  │   → Bucket: 0-7, 8-30, 30+ days                          │   │ │
│  │   → Returns: totalPending, byAgeing, cases[], ...        │   │ │
│  └──────────────────────────────────────────────────────────┘   │ │
│  ┌──────────────────────────────────────────────────────────┐   │ │
│  │ GET /cases-by-date (fromDate, toDate required)           │   │ │
│  │   → getCasesByDateRange()                                │   │ │
│  │   → Filter by createdAt, status, category               │   │ │
│  │   → Paginate results (page, limit)                       │   │ │
│  │   → Returns: cases[], pagination{}                       │   │ │
│  └──────────────────────────────────────────────────────────┘   │ │
│  ┌──────────────────────────────────────────────────────────┐   │ │
│  │ GET /export/csv                                           │   │ │
│  │   → exportCasesCSV()                                      │   │ │
│  │   → Use json2csv parser                                   │   │ │
│  │   → Set Content-Type: text/csv                           │   │ │
│  │   → Returns: CSV file download                           │   │ │
│  └──────────────────────────────────────────────────────────┘   │ │
│  ┌──────────────────────────────────────────────────────────┐   │ │
│  │ GET /export/excel                                         │   │ │
│  │   → exportCasesExcel()                                    │   │ │
│  │   → Use exceljs workbook                                  │   │ │
│  │   → Set Content-Type: application/vnd.openxml...         │   │ │
│  │   → Returns: Excel (.xlsx) file download                 │   │ │
│  └──────────────────────────────────────────────────────────┘   │ │
│                                                                  │ │
└──────────────────────────────────────────────────────────────────┴─┘
                        │
                        │ Mongoose ODM
                        │ Read Operations ONLY
                        │
┌───────────────────────▼───────────────────────────────────────────┐
│                        MONGODB DATABASE                            │
├─────────────────────────────────────────────────────────────────┬─┤
│  Collections:                                                   │ │
│  ┌──────────────────────────────────────────────────────────┐   │ │
│  │ Cases                                                     │   │ │
│  │  - caseId, caseName, title, status, category            │   │ │
│  │  - clientId, assignedTo, createdAt, createdBy           │   │ │
│  │  - pendingUntil (for ageing calculation)                │   │ │
│  │  Indexes: status, category, clientId, assignedTo,       │   │ │
│  │           createdAt, assignedTo+status                   │   │ │
│  └──────────────────────────────────────────────────────────┘   │ │
│  ┌──────────────────────────────────────────────────────────┐   │ │
│  │ Clients                                                   │   │ │
│  │  - clientId, businessName, businessEmail, ...           │   │ │
│  │  Used for: Populating client names in reports           │   │ │
│  └──────────────────────────────────────────────────────────┘   │ │
│  ┌──────────────────────────────────────────────────────────┐   │ │
│  │ Users                                                     │   │ │
│  │  - xID, name, email, role                               │   │ │
│  │  Used for: Employee names and admin authentication      │   │ │
│  └──────────────────────────────────────────────────────────┘   │ │
│                                                                  │ │
│  Aggregation Pipelines:                                          │ │
│  • $match → $group → $sort (for metrics)                        │ │
│  • .find() + .lean() (for case lists)                           │ │
│  • .countDocuments() (for totals)                               │ │
│                                                                  │ │
└──────────────────────────────────────────────────────────────────┴─┘

┌─────────────────────────────────────────────────────────────────────┐
│                         SECURITY LAYERS                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Layer 1: UI Access Control                                          │
│  • ProtectedRoute with requireAdmin prop                             │
│  • Reports menu hidden for non-admin users                           │
│  • Direct URL navigation blocked                                     │
│                                                                       │
│  Layer 2: API Authentication                                         │
│  • authenticate middleware validates xID                             │
│  • Returns 401 if xID missing or invalid                             │
│                                                                       │
│  Layer 3: API Authorization                                          │
│  • requireAdmin middleware checks user.role === 'Admin'              │
│  • Returns 403 if user is not Admin                                  │
│                                                                       │
│  Layer 4: Read-Only Enforcement                                      │
│  • All endpoints use GET method                                      │
│  • Only read operations: .find(), .aggregate(), .countDocuments()   │
│  • No .save(), .update(), .delete() operations                      │
│  • Case view from reports has no action buttons                     │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          DATA FLOW                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  User Action: View Reports Dashboard                                 │
│  ────────────────────────────────────────────────                   │
│  1. Admin logs in → AuthContext stores user with role               │
│  2. Admin clicks "Reports & MIS" in Admin Panel                     │
│  3. Navigate to /admin/reports                                      │
│  4. ProtectedRoute checks user.role === 'Admin' → Allow             │
│  5. ReportsDashboard component mounts                               │
│  6. useEffect calls reportsService.getCaseMetrics()                 │
│  7. API request: GET /api/reports/case-metrics                      │
│     Headers: { 'x-user-id': 'X123456' }                            │
│  8. Backend: authenticate middleware validates xID                   │
│  9. Backend: requireAdmin middleware checks role                     │
│  10. Backend: getCaseMetrics() executes MongoDB aggregations        │
│  11. Backend: Returns JSON with metrics                             │
│  12. Frontend: Displays metrics in cards                            │
│                                                                       │
│  User Action: Export CSV                                             │
│  ────────────────────────────────────────────────                   │
│  1. User applies filters (fromDate, toDate, status, category)       │
│  2. User clicks "Export as CSV"                                     │
│  3. ExportModal opens with filter summary                           │
│  4. User clicks "Confirm Export"                                    │
│  5. API request: GET /api/reports/export/csv?fromDate=...           │
│     Headers: { 'x-user-id': 'X123456' }                            │
│     Response Type: blob                                              │
│  6. Backend: Filters cases, generates CSV with json2csv             │
│  7. Backend: Sets Content-Type and Content-Disposition headers      │
│  8. Frontend: Creates blob URL, triggers download                   │
│  9. Browser: Downloads docketra-report-YYYYMMDD.csv                 │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      DESIGN SYSTEM INTEGRATION                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Neomorphic Design Tokens (from PR #9):                             │
│  • --surface-base: #e0e5ec                                           │
│  • --surface-raised: #ecf0f3 (cards)                                 │
│  • --surface-inset: #d1d9e6 (filters)                                │
│  • --shadow-light: -8px -8px 16px rgba(255,255,255,0.8)            │
│  • --shadow-dark: 8px 8px 16px rgba(174,174,192,0.4)               │
│  • --accent-primary: #5c7cfa                                         │
│  • --accent-warning: #ffa94d (for 30+ days overdue)                 │
│                                                                       │
│  Reused Components:                                                  │
│  • Button (from common/Button.jsx)                                   │
│  • Card (from common/Card.jsx)                                       │
│  • Input (from common/Input.jsx)                                     │
│  • Select (from common/Select.jsx)                                   │
│  • Modal (from common/Modal.jsx)                                     │
│  • Badge (from common/Badge.jsx)                                     │
│  • Loading (from common/Loading.jsx)                                 │
│  • Layout (from common/Layout.jsx)                                   │
│                                                                       │
│  New Report-Specific Components:                                     │
│  • MetricCard - Dashboard metric display                             │
│  • FilterPanel - Inset shadow filter UI                              │
│  • ReportsTable - Neomorphic table with pagination                   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘

Legend:
────── Process Flow
━━━━━━ Data Flow
┌────┐ Component/Module
│    │ Container/Section
```

## Key Architectural Decisions

1. **Separation of Concerns**: Reports are isolated at `/api/reports/*` to avoid overloading transactional APIs
2. **Read-Only by Design**: No POST/PUT/PATCH/DELETE methods, only GET
3. **Admin-Only Access**: Double-layered security (UI + API)
4. **Aggregation at Database**: MongoDB pipelines for efficiency
5. **Client-Side Export Handling**: Browser downloads blob URLs
6. **Stateless**: No sessions, no WebSockets, no polling
7. **Pagination**: Prevents large result sets from overwhelming UI/API
8. **Design Consistency**: Reuses existing Docketra neomorphic components
