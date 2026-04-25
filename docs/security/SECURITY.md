# Security Summary

## Current Security Status (Updated January 2026)

### ✅ Implemented Security Features

1. **Enterprise Access Control** (NEW)
   - Admin-only user provisioning
   - No self-registration allowed
   - xID remains the only login identifier
   - Email-based password setup (no default passwords)
   - Passwords never sent via email

2. **Email-Based Password Setup** (NEW)
   - Cryptographically secure token generation (32 bytes)
   - Token hashing before storage (SHA-256)
   - 24-hour token expiry
   - Users cannot log in until password is set
   - Secure password setup via email link

3. **Login Protection** (NEW)
   - Failed login attempt tracking
   - Account lockout after 5 failed attempts
   - 15-minute lockout duration
   - Admin can manually unlock accounts
   - Counters reset on successful login

4. **Audit Logging** (NEW)
   - All security-critical events logged
   - Login success/failure tracking
   - Password setup and changes
   - User creation and status changes
   - Account lock/unlock events
   - No secrets logged (append-only, immutable logs)

5. **User Access Control** (NEW)
   - Enable/disable user accounts
   - Active status checked at login and in middleware
   - Admin controls all access changes

6. **Input Validation**
   - Mongoose schema validation on all models
   - Email format validation (required for all users)
   - Required field validation
   - Numeric range validation (no negative values)
   - String length limits
   - Password complexity requirements (8+ chars, uppercase, lowercase, number, special char)

7. **Data Integrity**
   - Unique constraints (email, xID, case numbers)
   - Type validation
   - Enum constraints for status/role fields
   - Email uniqueness enforced

8. **Error Handling**
   - Sanitized error messages (no stack traces in production)
   - No sensitive data in error responses
   - Centralized error handling
   - Clear lockout messages to users

9. **Request Logging**
   - All requests logged with timestamp and IP
   - Request bodies logged (sensitive fields excluded)
   - Audit trail for debugging and security
   - Comprehensive authentication event logging

10. **CORS Configuration**
   - CORS enabled for API access
   - Can be restricted in production

### ⚠️ Known Security Limitations

#### 1. Missing Rate Limiting for API Endpoints (Medium Priority)

**Issue**: Non-authentication API endpoints are not rate-limited

**Impact**: Database operations endpoints could be vulnerable to:
- DoS attacks
- Resource exhaustion

**Status**: Authentication endpoints now have built-in login protection (5 attempts, 15-min lockout)

**Recommendation**: Add rate limiting to other API endpoints before production

**Solution**:
```bash
npm install express-rate-limit
```

```javascript
// In src/server.js
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);
```

**Affected Files**:
- src/routes/cases.js (6 endpoints)  
- src/routes/tasks.js (5 endpoints)

#### 2. Email Service in Console Mode (Low Priority)

**Issue**: Email service currently logs to console instead of sending real emails

**Impact**: Password setup emails are logged to console in development

**Recommendation**: Integrate with production email service (SendGrid, AWS SES, etc.) before deployment

**Solution**: Update `src/services/email.service.js` with actual email provider

#### 3. Missing Input Sanitization (Medium Priority)

**Issue**: Raw user input stored without sanitization

**Impact**: 
- Potential for NoSQL injection
- XSS if data displayed in frontend without escaping

**Recommendation**: Add input sanitization middleware

**Solution**:
```bash
npm install express-mongo-sanitize
npm install xss-clean
```

#### 4. Environment Variables (Low Priority)

**Issue**: .env file not created automatically

**Impact**: Server won't start without manual configuration

**Recommendation**: Already documented in setup guides

### 🔒 Production Deployment Checklist

Before deploying to production, implement:

1. **Email Service Integration** (Critical)
   - Integrate with SendGrid, AWS SES, or similar
   - Configure SMTP settings
   - Test email delivery
   - Set up email templates

2. **Rate Limiting for API Endpoints** (High)
   - Install express-rate-limit
   - Apply to non-auth API routes
   - Configure appropriate limits per endpoint type

3. **Input Sanitization** (High)
   - NoSQL injection prevention
   - XSS prevention
   - Validate and sanitize all inputs

4. **HTTPS** (Critical)
   - Enforce HTTPS in production
   - Use TLS certificates
   - Redirect HTTP to HTTPS

5. **Security Headers** (Medium)
   - Use helmet.js
   - Configure CSP, HSTS, etc.

6. **Secrets Management** (Critical)
   - Use environment variables
   - Never commit secrets
   - Rotate secrets regularly

7. **Database Security** (High)
   - Use connection string with authentication
   - Restrict database user permissions
   - Enable MongoDB authentication

8. **Logging & Monitoring** (Medium)
   - Production-grade logging
   - Error tracking (Sentry, etc.)
   - Security event monitoring

9. **Dependency Security** (Medium)
    - Regular npm audit
    - Keep dependencies updated
    - Remove unused dependencies

### 📝 Security Best Practices Currently Followed

1. ✅ **No default passwords** - Users set passwords via email link
2. ✅ **Passwords never emailed** - Only secure tokens sent
3. ✅ **Admin-only user creation** - No self-registration
4. ✅ **Login protection** - 5 attempts, 15-minute lockout
5. ✅ **Comprehensive audit logging** - All security events tracked
6. ✅ **Token security** - Cryptographic randomness, hashing, expiry
7. ✅ **Validation at schema level** - Mongoose validation
8. ✅ **Error messages don't leak sensitive info**
9. ✅ **Request logging for audit trail**
10. ✅ **.env for configuration** (not in git)
11. ✅ **Soft delete for users** (data retention)
12. ✅ **Immutable audit trail** (append-only logs)
13. ✅ **Password complexity requirements**
14. ✅ **Email uniqueness enforced**
15. ✅ **Account lockout on failed attempts**

### 🚀 Recommendation for Current State

**For Development/Internal Use**: Current security is **STRONG**
- Enterprise-grade access control
- Email-based password setup
- Comprehensive audit logging
- Login protection and lockout
- Admin-controlled user provisioning

**For Production/External Use**: Address remaining limitations
- Integrate real email service
- Add rate limiting to non-auth endpoints
- Follow production deployment checklist

### 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [MongoDB Security Checklist](https://docs.mongodb.com/manual/administration/security-checklist/)

---

**Last Updated**: January 2026  
**Security Review**: Enterprise access control implemented  
**Status**: Production-ready for internal deployment with email service integration

## April 2026 Session/CSRF hardening update

- Enforced same-origin CSRF checks for mutating HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`) when cookie-auth context is present, with explicit operational/internal exceptions.
- Standardized auth cookie options with production-safe defaults and optional deployment overrides:
  - `AUTH_COOKIE_SAMESITE`
  - `AUTH_COOKIE_DOMAIN`
- Hardened logout/session invalidation:
  - logout revokes refresh tokens,
  - refresh failure for invalid/revoked token clears auth cookies,
  - logout now actively disconnects authenticated notification sockets for that user.
- Frontend auth hardening:
  - clears React Query private cache on auth reset/logout,
  - broadcasts logout across tabs to prevent stale privileged views,
  - emits logout lifecycle event so websocket clients disconnect immediately.
- See detailed engineering note: `docs/security/session-csrf-hardening-2026-04.md`.

## April 2026 logging/redaction and diagnostics addendum

- Added centralized log redaction helpers for secrets/tokens/cookies/reset links/signed URLs in `src/utils/redaction.js`.
- Introduced mode-based sanitization:
  - `sanitizeForLogs`
  - `sanitizeForAudit`
  - `sanitizeForPublicDiagnostics`
- Standardized slow endpoint diagnostics fields (request/correlation IDs, path-only route, duration, safe flags, pagination) via `src/utils/slowLog.js`.
- Correlation improvements:
  - backend lifecycle logs include `correlationId`
  - frontend API diagnostics capture backend `x-request-id`
- Production logging safety:
  - no global console monkey-patching
  - `ui/src/utils/safeConsole.js` remains an explicit opt-in wrapper for development diagnostics
- Stack traces in structured logs are now disabled by default in production and can be enabled explicitly with `LOG_INCLUDE_STACK=true`.

### Addendum manual checks

1. Auth flows still function (login/logout/forgot-password).
2. Docket CRUD and reporting flows still function.
3. Slow endpoint diagnostics do not expose raw query strings.
4. Audit metadata preserves useful business labels while redacting secrets.
5. Production error responses remain user-safe and do not expose internal raw errors.
