# CUG & Live Environments Guide

Docketra operates two isolated web environments:

1. **Live (Production):** The customer-facing system used by real chartered accountants, company secretaries, and client companies.
2. **CUG (Closed User Group / Staging):** The internal testing environment used by developers and beta testers to validate new features before releasing them to live firms.

---

## Environment URLs & Architecture

| Resource | Live Environment (Production) | CUG Environment (Closed User Group) |
| :--- | :--- | :--- |
| **Frontend Webapp** | [docketra.in](https://docketra.in) | [docketra-cug.web.app](https://docketra-cug.web.app) *(or `cug.docketra.in`)* |
| **Backend API** | [api.docketra.in](https://api.docketra.in) | [docketra-api-cug](https://docketra-api-cug-1078507569854.us-central1.run.app) |
| **Git Deployment Branch** | `main` | `cug` |
| **Firebase Hosting Target** | `live` (`docketra-prod`) | `cug` (`docketra-cug`) |
| **Cloud Run Service** | `docketra-api` | `docketra-api-cug` |
| **CI/CD Pipeline** | `.github/workflows/deploy.yml` | `.github/workflows/deploy-cug.yml` |

---

## How to Test on CUG

1. Push your branch / changes to the `cug` branch:
   ```bash
   git checkout cug
   git merge my-feature-branch
   git push origin cug
   ```
2. GitHub Actions will automatically run CI release gates and deploy the frontend to `https://docketra-cug.web.app` and backend to Cloud Run service `docketra-api-cug`.
3. Open `https://docketra-cug.web.app` and test your new features with CUG test accounts.

---

## How to Push CUG to Live Once Approved

### Method 1: GitHub Pull Request (1-Click UI)
1. Open a Pull Request on GitHub: `cug` -> `main`.
2. When testing on CUG is approved, click **"Merge pull request"**.
3. GitHub Actions builds and deploys to the live `docketra.in` webapp.

### Method 2: Git Command Line
```bash
git checkout main
git merge cug
git push origin main
```
The push to `main` immediately triggers `.github/workflows/deploy.yml` and updates `https://docketra.in`.
