# Navigation and Terminology Model

## Purpose
Docketra now treats **Docket** as the single canonical work-item term in user-facing UI across navigation, command center destinations, page titles, and queue surfaces.

## Canonical module and queue names

### Primary navigation modules
- **Docket Workbench** (daily execution hub)
- **Dashboard**
- **Intake (CMS)**
- **Pipeline (CRM)**
- **Clients**
- **Reports**
- **Team & Access**
- **Settings**

### Canonical queue/surface names
- **Workbench** (shared pull queue)
- **My Worklist** (personal queue)
- **QC Workbench** (quality review queue)
- **All Dockets** (oversight list)

## Route model

### Canonical firm routes
- `/app/firm/:firmSlug/dockets`
- `/app/firm/:firmSlug/dockets/:caseId`
- `/app/firm/:firmSlug/dockets/create`

### Compatibility aliases (kept for backward compatibility)
- `/app/firm/:firmSlug/cases` → redirect to `/dockets`
- `/app/firm/:firmSlug/cases/:caseId` → redirect to `/dockets/:caseId`
- `/app/firm/:firmSlug/cases/create` → redirect to `/dockets/create`

Compatibility aliases must remain **non-primary** and should never be presented as destination links in user-facing navigation.

## Shared navigation config source
A single navigation model now drives:
- Sidebar sections and labels in `PlatformShell`
- Command center “Module destinations” entries
- Keyboard shortcut route destinations

Implementation source:
- `ui/src/constants/platformNavigation.js`

This avoids divergence across shell navigation and command center routes and keeps active-state behavior consistent.

## Terminology policy
- Prefer **docket / dockets** in user-visible copy.
- Keep legacy **case / cases** names only for compatibility aliases, internal identifiers, or backend contracts where renaming is unsafe in this change.
- Avoid re-introducing “Tasks” as a top-level work-item label for docket execution surfaces.
