# WAF & Edge Security Integration Plan

## Trust Proxy
- API sets `app.set('trust proxy', 1)` so Express resolves real client IP from `X-Forwarded-For`.
- Mandatory when deployed behind Cloudflare, AWS ALB, or Nginx.

## Cloudflare
- Enable **WAF managed rules** and **Bot Fight Mode**.
- Forward `CF-Connecting-IP` and standard `X-Forwarded-For`.
- Add Cloudflare rate limiting fallback:
  - `/api/auth/*`: 5 req/15m/IP
  - `/api/*`: 100 req/15m/IP

## AWS WAF
- Attach WAF Web ACL to ALB / API Gateway.
- Add rate-based rule at 2,000 req/5 min/IP as outer safety net.
- Add managed rule groups:
  - AWSManagedRulesCommonRuleSet
  - AWSManagedRulesKnownBadInputsRuleSet

## Nginx fallback
```nginx
limit_req_zone $binary_remote_addr zone=api_global:10m rate=100r/15m;
limit_req_zone $binary_remote_addr zone=api_auth:10m rate=5r/15m;

location /api/auth/ {
  limit_req zone=api_auth burst=5 nodelay;
}

location /api/ {
  limit_req zone=api_global burst=30 nodelay;
}
```

## Operational guidance
- Keep Redis-based app throttles as primary control.
- Keep edge WAF limits slightly higher to avoid duplicate blocking.
- Ship WAF logs to SIEM and correlate with application forensic audit entries.
