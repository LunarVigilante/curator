# Security Testing Playbook

## Overview

This playbook provides guidance for monthly security testing of the Curator application. All tests should be performed in a staging environment.

---

## Schedule

| Week | Focus Area |
|------|------------|
| 1 | Authentication & Authorization |
| 2 | API Security & Rate Limiting |
| 3 | Input Validation & Injection |
| 4 | Infrastructure & Configuration |

---

## 1. Authentication Testing

### 1.1 Session Management
- [ ] Verify session expires after 24 hours of inactivity
- [ ] Confirm logout invalidates session token
- [ ] Test concurrent login from multiple devices

### 1.2 Password Reset
- [ ] Attempt reset with non-existent email (should not reveal existence)
- [ ] Verify reset link expires after 1 hour
- [ ] Test rate limiting on reset endpoint (max 5/hour)

### 1.3 Supabase Auth
```bash
# Test invalid JWT
curl -H "Authorization: Bearer invalid_token" \
  https://your-app.vercel.app/api/v1/user/profile
```

---

## 2. Authorization (IDOR) Testing

### 2.1 Direct Object Reference
Test that users cannot access other users' resources:

```bash
# Attempt to access another user's category
curl -H "Authorization: Bearer $YOUR_TOKEN" \
  https://your-app.vercel.app/api/v1/categories/OTHER_USER_CATEGORY_ID
```

### 2.2 RLS Policy Verification
Run in Supabase SQL Editor:
```sql
-- Verify RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

### 2.3 Admin Route Protection
- [ ] Access /admin/* routes as non-admin user
- [ ] Attempt to call admin-only APIs with regular user token

---

## 3. API Security

### 3.1 Rate Limiting
```bash
# Test rate limit (should fail after 60 requests)
for i in {1..70}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    https://your-app.vercel.app/api/v1/health
done | sort | uniq -c
```

### 3.2 Input Validation
Test Zod validation with malformed payloads:
```bash
curl -X POST https://your-app.vercel.app/api/v1/items \
  -H "Content-Type: application/json" \
  -d '{"name": "<script>alert(1)</script>"}'
```

### 3.3 CORS Verification
```bash
# Should be blocked (not in allowed origins)
curl -H "Origin: https://malicious-site.com" \
  https://your-app.vercel.app/api/v1/health
```

---

## 4. Injection Testing

### 4.1 SQL Injection
Test Supabase parameterization:
```bash
curl "https://your-app.vercel.app/api/v1/search?q='; DROP TABLE items;--"
```

### 4.2 XSS Testing
Input these payloads in search/name fields:
- `<script>alert('XSS')</script>`
- `"><img src=x onerror=alert(1)>`
- `javascript:alert(1)`

### 4.3 Command Injection
Test URL parameters:
- `; ls -la`
- `| cat /etc/passwd`
- `$(whoami)`

---

## 5. Infrastructure Review

### 5.1 Security Headers
```bash
curl -I https://your-app.vercel.app | grep -E "^(Strict|X-|Content-Security)"
```

Expected headers:
- `Strict-Transport-Security: max-age=31536000`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Content-Security-Policy: ...`

### 5.2 SSL/TLS
```bash
# Check certificate and protocols
openssl s_client -connect your-app.vercel.app:443 -tls1_2
```

### 5.3 Secret Rotation Checklist
- [ ] Rotate Supabase service role key (quarterly)
- [ ] Rotate Upstash Redis token (quarterly)
- [ ] Rotate OpenAI/Gemini API keys (quarterly)
- [ ] Update GitHub secrets after rotation

---

## 6. Axiom Log Review

### Suspicious Activity Queries

```kusto
# 5XX errors in last 24h
['vercel-logs']
| where status >= 500
| summarize count() by path, bin(_time, 1h)

# Failed auth attempts
['vercel-logs']
| where status in (401, 403)
| summarize count() by source_ip
| where count_ > 10

# Unusual paths (scanners/bots)
['vercel-logs']
| where path contains ".php" or path contains "wp-admin" or path contains ".env"
```

---

## 7. Incident Response

If a vulnerability is found:

1. **Document** - Screenshot, timestamp, reproduction steps
2. **Assess** - Severity (Critical/High/Medium/Low)
3. **Contain** - Disable feature if critical
4. **Fix** - Create PR with fix
5. **Verify** - Re-test after deployment
6. **Report** - Update this playbook with lessons learned

---

## Monthly Report Template

```markdown
# Security Testing Report - [Month Year]

## Summary
- Tests performed: X
- Issues found: X
- Critical: X | High: X | Medium: X | Low: X

## Findings
1. [Issue Title]
   - Severity: High
   - Status: Fixed
   - PR: #123

## Recommendations
- [Future improvements]
```
