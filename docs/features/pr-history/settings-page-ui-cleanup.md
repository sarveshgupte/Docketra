# Settings page UI cleanup (workspace hub)

## Summary

This follow-up UI pass cleans up `/app/firm/:firmSlug/settings` into a simple, symmetrical control hub while preserving existing routes and sidebar behavior.

## What changed

- Replaced the uneven settings card layout with a settings-specific 2x2 desktop grid (`settings-grid`) that stacks cleanly on tablet/mobile.
- Standardized each settings card to use equal-height flex columns (`settings-card`) so primary actions align at the bottom consistently.
- Simplified action hierarchy to one primary CTA per card and moved secondary actions into lighter related links.
- Updated card copy and labels for clearer scanning:
  - Firm profile
  - Work settings
  - Team & controls
  - Storage & AI

## Routes preserved

- Firm settings
- Work settings
- Team & Access/Admin
- Storage settings
- AI settings
- Audit reports

No route contracts were changed.

## Why

- Improve scanability and symmetry for admin users.
- Reduce button crowding and uneven action rows.
- Keep visual styling aligned with existing platform panels without changing global panel/grid primitives used by other pages.
