# Deterministic Docket Category Suggestions (Non-AI)

Docket creation now includes an assistive category/subcategory suggestion capability.

## Behavior
- Suggestions are computed deterministically from docket title/description text.
- Matching uses active firm-scoped category/subcategory names plus deterministic India-focused legal/compliance keywords (e.g., GST/GSTR/TDS/ITR, ROC/MCA/AOC-4/MGT-7, board resolutions, legal notices).
- Suggestions include confidence levels: `high`, `medium`, `low`.
- Suggestions are **assistive only**: users must explicitly click **Apply suggestion**.
- Manual category/subcategory changes are respected and never overwritten automatically.

## Privacy + Data Handling
- No external AI provider is called.
- No suggestion-specific persistence of title/description is performed.
- Suggestions are computed in request scope and returned immediately.

## Scope
- Tenant-safe: only categories/subcategories for the authenticated user firm are considered.
- Weak input returns an empty `suggestions` array.

## Future (Out of Scope)
A future optional BYOAI fallback can be added later, but this implementation is intentionally deterministic and non-AI.
