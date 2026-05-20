# Admin and Work Settings layout cleanup

## Summary
- Removed duplicate `PageHeader` rendering in `AdminPage` when the page is already hosted inside `PlatformShell`.
- Moved Refresh ownership to `PlatformShell` page actions to keep title/subtitle ownership in one place.
- Refined category action controls into compact grouped actions and separated destructive actions.
- Preserved related employee/user requirement controls in category and subcategory create/edit modals.
- Replaced remaining utility/Tailwind-style modal layout classes with `AdminPage.css` classes to reduce layout drift.

## Guardrails added
- `PlatformShell` owns top-level page heading contract for admin/work settings surfaces.
- Category and subcategory rows use standardized action-group classes in `AdminPage.css`.
- Category requirement helper copy remains in all create/edit paths.
