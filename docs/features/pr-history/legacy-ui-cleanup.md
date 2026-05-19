# PR 6 — Legacy UI cleanup

## Scope
- Migrate active platform settings pages off duplicate page headers and shell-level utility wrappers.
- Remove confirmed-unused dashboard CSS selectors after route/import verification.
- Add static guardrails test to prevent duplicate headers and wrapper drift from returning.

## Legacy UI inventory
| File | Pattern found | Action |
|---|---|---|
| `ui/src/pages/WorkSettingsPage.jsx` | Duplicate `PageHeader` inside `PlatformShell`; `min-h-screen`/`max-w-*`/`px-*`/`py-*` wrapper shell | Migrated to `platform-page section-group`; removed duplicate header |
| `ui/src/pages/AiSettingsPage.jsx` | `min-h-screen`/`max-w-*`/`px-*`/`py-*` wrapper shell | Migrated to `platform-page section-group` |
| `ui/src/components/platform/platform.css` | Dead dashboard selectors: `dashboard-next-step-title`, `dashboard-next-step-list`, `dashboard-activity-list .empty-state` | Removed as dead CSS after usage search |
| `ui/src/pages/FirmSettingsPage.jsx` | Legacy framing remains in active page | Kept intentionally (deferred): broader page should be migrated in focused follow-up PR to avoid half-migration |

## Safety checks
- Route constants, route paths, and auth wrappers unchanged.
- No backend/API behavior changed.
- Added `ui/tests/legacyUiCleanup.test.mjs` allowlist with explicit deferral reason for `FirmSettingsPage`.
