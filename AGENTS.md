# AGENTS.md

Minimal repo-specific agent notes based on committed scripts and package workflows.

## Commands

- Use `node scripts/run-node-tests.js KEY=value ... -- tests/example.test.js [...]` when a test run needs inline env overrides. This replaces older shell-specific `sh -c` command chains and works from Windows PowerShell.
- Use `npm run docs:check` before opening or updating a PR when docs or markdown links changed.
- Use `npm run ci:backend:routes` for the backend route contract gate (schema coverage + mount order).
- Use `npm run validate:env:production`, `npm run validate:env:production:fixture`, and `npm run validate:env:test` for backend env contract checks.
- Use `npm run ci:backend:security` for the backend security gate and `npm run ci:backend:deploy-safety` for the production-shaped deploy safety wrapper.
- Use `npm run ci:release-gate:pure` as the default merge/release blocker, and `npm run ci:release-gate:integration` when a change touches DB-dependent backend behavior.
- Use `npm run test:secret-scanning:contract` and `npm run security:secrets` before merge when touching secret-handling or CI gate behavior.
- Use `npm run ci:install` when you need the deterministic root + `ui/` install flow that matches CI and the current Render deployment docs.

## Workflows

- CI release gates are documented in `docs/operations/ci-release-gates.md` and `.github/workflows/ci.yml`; the workflow runs backend and frontend release-gate jobs in parallel, and both must pass for merge readiness.
- Release-gate usage is documented in `docs/operations/release-gate.md`; use `ci:release-gate:pure` as the merge/release blocker and `test:pilot-readiness` as the pre-manual-QA operator command.
- Secret scanning runs through `scripts/run-secret-scan.js`, which prefers a local `gitleaks` binary, then the pinned Docker image in GitHub Actions, then a pinned platform download.
- Deploy-safety checks run through `scripts/run-deploy-safety-gate.js`, which supplies production-shaped placeholder env values without requiring real secrets.
- For full local parity with the backend CI job, run `npm run ci:backend:deploy-safety` and `npm run security:secrets` in addition to `npm run ci:release-gate:pure`; those extra gates are enforced in `.github/workflows/ci.yml`.

## TODO

- Add more agent workflow notes only after they are established in committed repo scripts or docs.

## UI/UX Design Instructions

Before performing frontend work, review and apply relevant skills from:

- .agents/skills/impeccable
- .github/skills/impeccable (run `node .github/skills/impeccable/scripts/context.mjs` once per UI session; if it reports `NO_PRODUCT_MD`, follow `reference/init.md` before redesign work)
- .agents/skills/emil-design-eng
- .agents/skills/design-taste-frontend
- .agents/skills/design-taste-frontend-v1
- .agents/skills/high-end-visual-design
- .agents/skills/redesign-existing-projects
- .agents/skills/stitch-design-taste

Docketra is a premium B2B SaaS platform for:

- Company Secretaries
- Chartered Accountants
- Compliance Firms
- Legal Practices

Design goals:

- Professional
- Information-dense
- Trustworthy
- Operational
- Premium
- Accessible

Reference quality bar:

- Linear
- Attio
- Stripe Dashboard
- Mercury
- Vercel Dashboard

Avoid:

- Consumer-app styling
- Excessive gradients
- Decorative animations
- Marketing-site aesthetics

Preserve:

- Existing functionality
- API contracts
- Authentication flows
- Existing tests

For UI work:
- Audit before redesigning.
- Prefer shared components.
- Improve hierarchy, spacing, typography, forms, tables, loading states, and empty states.
- Keep PRs focused and reviewable.
