# What's New Source

## 2026-05-01 — Tenant-boundary hardening (backend)

We tightened backend tenant-boundary checks for firm-owned storage/settings operations so workspace-scoped tenant identities are consistently mapped to ownership firm identities before sensitive config or audit writes are performed.


## 2026-05-01 — Auth/session reliability improvements

Improved auth routing reliability by separating login OTP verification from signup OTP verification and clearing stale firm workspace hints on superadmin login.
