# AGENTS.md

Minimal repo-specific agent notes based on committed scripts and package workflows.

## Commands

- Use `node scripts/run-node-tests.js KEY=value ... -- tests/example.test.js [...]` when a test run needs inline env overrides. This replaces older shell-specific `sh -c` command chains and works from Windows PowerShell.
- Use `npm run validate:env:production`, `npm run validate:env:production:fixture`, and `npm run validate:env:test` for backend env contract checks.
- Use `npm run ci:backend:security` for the backend security gate and `npm run ci:backend:deploy-safety` for the production-shaped deploy safety wrapper.
- Use `npm run test:secret-scanning:contract` and `npm run security:secrets` before merge when touching secret-handling or CI gate behavior.

## Workflows

- Secret scanning runs through `scripts/run-secret-scan.js`, which prefers a local `gitleaks` binary, then the pinned Docker image in GitHub Actions, then a pinned platform download.
- Deploy-safety checks run through `scripts/run-deploy-safety-gate.js`, which supplies production-shaped placeholder env values without requiring real secrets.

## TODO

- Add more agent workflow notes only after they are established in committed repo scripts or docs.
