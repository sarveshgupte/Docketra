# SuperAdmin AI Assistant

## Purpose
The **SuperAdmin AI Assistant** is a private, platform-owner-only reasoning copilot designed to help the solo founder prioritize the product roadmap, debug backend/frontend architectures, write marketing and positioning copy, and structure user onboarding campaigns. 

It is designed strictly as an internal administrative aid and is **not customer-facing**.

---

## Access Model & Routes

### Frontend Interface
* **Secure Layout Route:** `/app/superadmin/ai-assistant`
* **Redirect Route:** `/superadmin/ai-assistant`
* **Visibility:** Only visible in the SuperAdmin dashboard navigation sidebar.
* **Route Guards:** Guarded by the React `<ProtectedRoute requireSuperadmin>` component. Standard firm administrators (`ADMIN`) and regular employees (`USER`) are immediately redirected with a warning toast.

### Backend REST API
* **Endpoint:** `POST /api/superadmin/ai-assistant/chat`
* **Limiter:** Governed by `superadminLimiter` to prevent brute force or Denial of Service attacks.
* **Authorization Guard:** Protected by the fail-closed `requireSuperadmin` middleware check. Any request lacking a valid platform SuperAdmin session receives a `403 Forbidden` response.
* **Input Schema Validation:** Request bodies are strictly checked via Zod:
  - `mode`: Must be exactly `'Product Advisor'`, `'Developer Advisor'`, or `'Marketing Advisor'`.
  - `message`: Trimmed, non-empty, and capped at a maximum of `4000` characters.

---

## Gemini Provider Configuration

The backend connects directly to Google's Gemini REST API. No frontend keys or direct client-side requests are allowed.

### Environment Variables
To enable the assistant, configure the following values in your `.env` file:

```bash
# Required - API key for Google Gemini model calls
GEMINI_API_KEY=your_gemini_api_key_here

# Optional - Defaults to the cheap, generous free-tier model "gemini-1.5-flash"
GEMINI_MODEL=gemini-1.5-flash
```

---

## Advisor Modes & System Prompts

Each selectable mode loads a customized system instruction sheet dynamically in the backend:

1. **Product Advisor**
   - **Focus:** Refines user workflows, cuts MVP scope to focus on launch readiness, maps customer value, and drives early onboarding retention.
   - **Philosophy:** Highly critical of overengineering; advocates for low-complexity, high-impact features.

2. **Developer Advisor**
   - **Focus:** Diagnoses codebase bugs, maps safe incremental PRs, advises on unit/integration testing strategies, and structures deployment configs.
   - **Philosophy:** Advocates for strict defense-in-depth boundaries. Never suggests weakening security or authentication guards.

3. **Marketing Advisor**
   - **Focus:** Drafts website copy, cold email campaigns, LinkedIn posts, and early customer discovery scripts.
   - **Philosophy:** Optimizes positioning targeting boutique **Indian professional service firms** (CS, CA, and law firms).

---

## Security Boundaries & Safe Logging

### 1. Data Sandboxing
* The assistant is **fully decoupled** from the tenant/customer MongoDB databases.
* No client records, case logs, tasks, attachments, or emails are ever sent to the external Gemini APIs.
* The assistant operates exclusively on the static context provided in the backend system prompts and the SuperAdmin’s explicit message prompt.

### 2. Zero Autonomy (Safe Advice Drafts Only)
* The assistant has **no execution rights**.
* It cannot call external APIs, generate Github PRs, send real-world emails, modify tenant plans, or trigger mutations in production databases.
* All generated outputs are visually badged as "AI Drafts / Advice Only" inside the SuperAdmin shell.

### 3. Redacted Logging
* All model invocation errors are parsed defensively.
* Prompt text, system instructions, and raw API keys are stripped before logging to prevent credential leakage in support trace logs.

---

## Future Roadmap
- **Session Persistence:** Securely save SuperAdmin-only chat threads in an isolated platform-level database schema (excluding all tenant databases).
- **Diagnostics Context (Read-Only):** Safely expose anonymous, tenant-safe support diagnostics logs to the Developer Advisor to help trace system slow-points or OTP delivery failures without exposing any client database content.
