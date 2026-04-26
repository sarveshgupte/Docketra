# BYOS/BYOAI Settings UX Note (April 26, 2026)

## Purpose
Document trust and privacy messaging shown in Docketra settings surfaces after the settings detail consistency pass.

## Trust/privacy messages currently shown

### Storage settings (BYOS)
- Data ownership summary states that Docketra acts as a control plane and firm/client data should remain in configured firm storage according to the ownership model.
- Storage provider section explicitly states:
  - firm-connected storage is the BYOS trust mode,
  - firm/client document bytes remain in firm-provided storage when configured,
  - Docketra-managed storage remains default fallback,
  - provider changes require OTP verification.
- Current storage mode panel reiterates the distinction between firm-owned storage and fallback mode.

### AI settings (BYOAI)
- BYOAI trust note states AI access is optional.
- Copy clarifies Docketra operation does not require BYOAI to remain functional.
- Provider settings are framed as firm-controlled connection settings for eligible features only.
- Existing-key visibility constraints remain explicit (“existing keys are never shown”).

## Connection status location
- **Storage:**
  - Ownership summary card includes connection status.
  - Provider details include read-only status and connected metadata.
- **AI:**
  - Provider configuration includes a read-only connection status field.

## What was improved in this pass
- Unified page-level and section-level hierarchy across settings detail pages.
- Consolidated success/error/info notices into predictable status stacks.
- Improved action-row grouping and responsive wrapping for safer admin scanning.
- Improved destructive action clarity (e.g., disconnect/delete treated as explicit risk actions).
- Removed visible legacy `neo` card usage from Work Settings.

## What remains unchanged (intentional)
- No changes to BYOS or BYOAI backend behavior.
- No changes to provider APIs, payloads, storage behavior, OAuth, auth/RBAC, or tenant boundaries.
- No changes to setting defaults.
- No warnings/privacy notes/consent-related guardrails were removed.

## Risks / follow-ups
- Follow-up should add shared settings section primitives so future updates remain consistent by default.
- A dedicated accessibility QA pass should validate keyboard navigation order and announcement quality on all settings detail routes.
