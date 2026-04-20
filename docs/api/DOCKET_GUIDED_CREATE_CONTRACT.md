# Guided Create Docket API Contract (`POST /api/dockets`)

This document captures the payload contract used by the guided create wizard (`GuidedDocketForm`), and enforced by `src/schemas/case.routes.schema.js`.

## Request body (guided flow)

### Required
- `title` (string, non-empty after trim)
- `categoryId` (Mongo ObjectId string)
- `subcategoryId` (string, non-empty)

### Optional
- `description` (string, can be empty `""` or omitted)
- `clientId` (`C000001` style ID; omitted for internal work)
- `isInternal` (boolean)
- `workType` (`client` | `internal`)
- `priority` (`low` | `medium` | `high` | `urgent`, case-insensitive input accepted and normalized)
- `assignedTo` (`X000001` style xID)
- `workbasketId` (Mongo ObjectId string)
- Existing compatibility fields remain supported by schema/service (`category`, `caseCategory`, `caseSubCategory`, `slaDueDate`, etc.)

## Normalization behavior

- `priority` accepts both legacy title-case and lowercase values, and is normalized to lowercase in the validated payload.
- Wizard payload builder (`ui/src/components/docket/createDocketPayload.js`) trims IDs/strings and uppercases `assignedTo`.
- `description` is treated as optional by both UI and backend validation.

## Validation behavior

- Validation is strict (`.strict()`): unknown keys are rejected.
- Validation errors return:
  - `success: false`
  - `message` (human-readable)
  - `error.code = VALIDATION_ERROR`
  - `error.details[]` with `location`, `path`, and `message`

## Regression coverage

- `tests/caseRoutesInternalWork.test.js`
  - exact guided payload shape parses
  - blank description accepted
  - lowercase priority accepted
  - `workbasketId` accepted
- `ui/tests/createDocketPayload.test.mjs`
  - payload canonicalization from wizard state
  - missing/stale ID checks
  - error-to-step mapping returns earliest mapped step or `null` when unmapped
