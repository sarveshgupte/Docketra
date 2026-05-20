# Create Docket UX hardening

## Summary

This change polishes the Create Docket guided workflow to align with PlatformShell design patterns while preserving existing creation behavior and routing semantics.

## What changed

- Removed remaining inline spacing/layout styles from `GuidedDocketForm` and replaced them with reusable class-based styling.
- Replaced utility-heavy alert/status blocks with reusable guided docket notice and panel classes.
- Introduced a compact, reusable class-based step indicator with clear current/completed/pending states and `aria-current="step"` on the active step.
- Reduced setup guidance noise by making the setup checklist collapsible and default-collapsed when prerequisites are satisfied.
- Kept first-docket guidance concise while preserving key onboarding context.
- Hardened submit validation so final submit also validates step 3 requirements (including required Related employee/user) before API submit.

## Behavioral guarantees preserved

- Category suggestion and apply flow remain unchanged.
- Category/subcategory to workbasket auto-mapping remains unchanged.
- Required related employee/user behavior remains unchanged except for earlier pre-submit validation.
- Assignee and related employee/user remain independent fields with separate semantics.
- Idempotency key behavior remains unchanged.

## Regression coverage

- Added static regression assertions for:
  - removal of inline stepper/suggestion layout styles,
  - presence of stepper class contracts,
  - setup checklist collapse controls,
  - step-3 validation guard in final submit.
- Existing payload contract tests remain unchanged and continue to validate payload normalization/shape.
