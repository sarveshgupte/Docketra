# Browser Route + Action Inventory

This smoke test provides a browser-level route/action inventory gate for the Docketra UI. It is intentionally conservative in this first version.

## What it checks

- Superadmin and firm workspace routes render at browser level.
- Route-level status signals per role (superadmin, primary admin, standard user, anonymous).
- Main content render signal and blank-root detection.
- Duplicate shell/layout signal.
- Access-denied / not-found text detection.
- Console errors and unhandled page errors.
- Visible action inventory for buttons/links, including non-blocking warnings for likely placeholders (`href="#"`, empty href, missing button type).
- Mobile viewport smoke signals for firm dashboard and superadmin dashboard pages.

## Output

Machine-readable output is written to:

- `ui/test-results/route-action-inventory.json`

## Run locally

From repo root:

```bash
cd ui
npm install --include=dev
npm run test:browser-route-inventory
```

Dependency/setup notes:

- The inventory script imports `playwright` from `ui` devDependencies.
- If browser binaries are not present on the machine, run `npx playwright install` from `ui`.

## Failure vs warning behavior

Current blocking failures are limited to hard reliability breakages:

- Blank root render
- Console errors
- Unhandled page errors
- Route content not rendering where page is not clearly access-denied/not-found

Non-blocking warnings (recorded in inventory only):

- Potentially dead/placeholder visible actions
- Placeholder links (`#`, empty href)
- Suspicious button metadata findings

## How to use in future PRs

1. Run inventory before route/nav/action changes.
2. Compare JSON findings by route + role.
3. Fix only confirmed UX defects (broken route, duplicate shell, dead action) in targeted PRs.
4. Keep this inventory script stable and deterministic; avoid destructive interactions.

This audit test is a safety net and does not replace feature-specific tests.
