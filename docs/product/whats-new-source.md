# What's New Source

## 2026-05-01 — Tenant-boundary hardening (backend)

We tightened backend tenant-boundary checks for firm-owned storage/settings operations so workspace-scoped tenant identities are consistently mapped to ownership firm identities before sensitive config or audit writes are performed.

