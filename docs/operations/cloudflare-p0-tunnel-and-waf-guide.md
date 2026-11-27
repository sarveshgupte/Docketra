# Cloudflare Zero Trust Tunnel & Edge WAF Operations Guide

This guide describes how to configure, deploy, and verify Cloudflare Zero Trust Access, Tunnel (`cloudflared`), and Edge WAF for `docketsHQ.com`.

---

## 1. Architectural Overview

```
                      [ Client Browser / Admin User ]
                                     |
                                     v
                   +-----------------------------------+
                   |     Cloudflare Global Edge        |
                   |   - Edge WAF & Rate Limiting      |
                   |   - Bot Management & Challenge    |
                   |   - Turnstile Token Verification  |
                   |   - Zero Trust Access (IdP / MFA) |
                   +-----------------------------------+
                                     |
                                     | Encrypted Tunnel (Outbound only, NO open ports)
                                     v
                   +-----------------------------------+
                   |     cloudflared Tunnel Daemon     |
                   |   - Runs on Server / Docker host  |
                   +-----------------------------------+
                                     |
                 +-------------------+-------------------+
                 |                                       |
                 v                                       v
      [ Frontend Web UI ]                    [ Backend API Server ]
      http://127.0.0.1:3000                   http://127.0.0.1:5000
                                             - cloudflareAccessGuard
                                             - CF-Connecting-IP & CF-Ray
                                             - Forensic Audit & Rate Limits
```

---

## 2. Cloudflare Tunnel Setup (`cloudflared`)

### Step 1: Install cloudflared
On your host server (Ubuntu/Debian or Docker):
```bash
# Ubuntu/Debian
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared
```

### Step 2: Authenticate and Create Tunnel
```bash
cloudflared tunnel login
cloudflared tunnel create dockets-prod-tunnel
```
Note the generated Tunnel UUID.

### Step 3: Configure Ingress Rules
Copy `cloudflared/config.example.yml` to `/etc/cloudflared/config.yml` and insert your Tunnel UUID:
```bash
sudo cp cloudflared/config.example.yml /etc/cloudflared/config.yml
# Update tunnel UUID and credentials path in /etc/cloudflared/config.yml
```

### Step 4: Route DNS to Tunnel
```bash
cloudflared tunnel route dns dockets-prod-tunnel docketshq.com
cloudflared tunnel route dns dockets-prod-tunnel api.docketshq.com
```

### Step 5: Start Tunnel Service
```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
```

---

## 3. Zero Trust Access (Protecting Superadmin)

Cloudflare Access adds an enterprise Identity Provider (Google Workspace, Okta, or Email OTP) in front of the Superadmin console and API.

1. In the **Cloudflare One / Zero Trust Dashboard**:
   - Navigate to **Access** > **Applications** > **Add an application** > **Self-hosted**.
   - Application Name: `Docketra Superadmin API`
   - Application Domain: `api.docketshq.com`
   - Path: `/api/superadmin*`
2. **Assign Policy**:
   - Policy Name: `Superadmin Corporate Identity`
   - Action: `Allow`
   - Include Rule: `Emails` ending in `@docketshq.com` or explicit addresses (e.g., `admin@docketshq.com`).
3. **CORS / Headers Settings**:
   - In the application settings, enable **HTTP Requests** pass-through for `Cf-Access-Authenticated-User-Email` and `Cf-Access-Jwt-Assertion`.

---

## 4. Backend Configuration

Add the following environment flags in `.env` (or Kubernetes / Cloud Run / VM environment):

```ini
# Enable Zero Trust enforcement on backend
CLOUDFLARE_ACCESS_ENABLED=true
CLOUDFLARE_ACCESS_REQUIRED=true
CLOUDFLARE_ACCESS_ALLOWED_EMAILS=admin@docketshq.com,superadmin@docketshq.com
```

When enabled:
- `cloudflareAccessGuard` intercepts every `/api/superadmin/*` and `/api/sa/*` route.
- If the Cloudflare identity email header is absent, it rejects fail-closed with `403 CLOUDFLARE_ACCESS_REQUIRED`.
- If an email header is present, it validates against `CLOUDFLARE_ACCESS_ALLOWED_EMAILS`.
- Normalized client IP extraction prioritizes `CF-Connecting-IP`, preventing IP spoofing across rate limiters and audit trails.
- `CF-Ray` is parsed and returned on responses for distributed trace correlation.

---

## 5. Edge WAF & Rate Limiting Deployment

Import or configure rules from `cloudflared/cloudflare-waf-rules.json`:

1. **Auth Rate Limit**: 10 req/min/IP on `/api/auth/*` (mitigation: 5 min block).
2. **Signup Rate Limit**: 5 req/10 min/IP on `/api/public/signup` (mitigation: Managed Challenge).
3. **Password Reset Limit**: 5 req/15 min/IP on `/api/auth/forgot-password`.
4. **Bot Fight Mode**: Managed challenge on any threat score > 30 for `/api/*`.

---

## 6. Verification & Health Checks

### Check Origin Cloaking
Ensure no ports (3000, 5000) are publicly exposed to the internet. Traffic should ONLY flow through Cloudflare Tunnel.

### Test Superadmin Guard via CLI
```bash
# Missing Cloudflare Access header -> Rejected with 403
curl -i -X GET https://api.docketshq.com/api/superadmin/stats

# Expected response:
# HTTP/1.1 403 Forbidden
# {"success":false,"code":"CLOUDFLARE_ACCESS_REQUIRED","message":"Cloudflare Zero Trust Access authentication is required for this endpoint."}

# Authorized Access Identity Header
curl -i -X GET https://api.docketshq.com/api/superadmin/stats \
  -H "cf-access-authenticated-user-email: admin@docketshq.com" \
  -H "Cookie: ...auth_cookie..."
```
