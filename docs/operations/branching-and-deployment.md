# Git Branching, Push & Promotion Policy

This document formalizes Docketra's environment branch policy, push rules, and promotion criteria across the `cug` (Closed User Group) and `main` (Production) branches.

---

## 1. Core Principles & Invariants

1. **`main` to `cug` Invariant**:
   - Everything on `main` must always exist on `cug`.
   - `cug` is continuously kept up-to-date with `main` to prevent drift between production and the closed user group testing environment.

2. **Default Push Target is `cug`**:
   - All newly developed features, refinements, fixes, and experimental changes must be pushed to `cug` by default.
   - Work is never pushed directly to `main` unless the operator has specifically requested a production release.

3. **Strict Review Gate for `main`**:
   - Everything on `cug` must undergo verification, testing, and operator review.
   - Changes on `cug` are **ONLY** moved or merged to `main` when the operator explicitly gives the instruction to do so (e.g. "push to main", "promote cug to main", "move to main").

4. **Mandatory Confirmation Before Any Push**:
   - Agents must **ALWAYS** ask the user for explicit confirmation before executing any `git push` command, whether the target is `cug` or `main`.
   - Autonomous pushes without operator confirmation are strictly prohibited.

---

## 2. Standard Branch Progression Workflow

```
[ Local Working Tree ]
       │
       ▼ (Pass Release Gates: ci:release-gate:pure)
       │
       ▼ (Ask Operator for Confirmation)
       │
[ Push to `cug` (Default) ] ───► Deployed to CUG Staging Environment
       │
       ▼ (Manual Review, Verification, Testing)
       │
       ▼ (Operator Explicit Approval: "Move to main")
       │
       ▼ (Ask Operator for Confirmation)
       │
[ Push / Fast-Forward `main` ] ───► Deployed to Production Environment
       │
       ▼ (Sync `cug` with `main` if any hotfixes originated on main)
[ `cug` kept 100% in sync ]
```

---

## 3. Checklist Before Pushing

Before asking the user to push to `cug` or `main`:

1. Run and pass `npm run docs:check`.
2. Run and pass `npm run ci:release-gate:pure`.
3. For DB-dependent changes, run `npm run ci:release-gate:integration`.
4. Run `npm run ci:backend:deploy-safety` and `npm run security:secrets`.
5. Clearly specify the target branch (`cug` or `main`) and summarize the commit when asking the user for confirmation.
