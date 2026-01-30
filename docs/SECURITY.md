# Security Policy

## Reporting a Vulnerability

We take the security of Curator seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

<<<<<<< HEAD
**Email:** security@curator.app (replace with your actual security contact)
=======
**Email:** contact@epoche.dev
>>>>>>> 01839eabdfee0806ce680f33018afe84833551be

**Include:**
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Your contact information (optional)

### Response Timeline

| Action | Timeframe |
|--------|-----------|
| Initial acknowledgment | 48 hours |
| Severity assessment | 5 business days |
| Status update | Every 7 days |
| Resolution target | 90 days (critical: 30 days) |

### Scope

In scope:
- curator.app (production)
- *.vercel.app (preview deployments)
- API endpoints (`/api/v1/*`)
- Authentication flows

Out of scope:
- Third-party services (Supabase, Vercel)
- Social engineering attacks
- Denial of service testing

---

## Reasonable Security Measures

Curator implements the following security controls as required by CCPA/CPRA "reasonable security" standards:

### Authentication & Access Control
- ✅ Supabase Auth with secure session management
- ✅ Multi-factor authentication (MFA) available
- ✅ Row-Level Security (RLS) on all database tables
- ✅ Role-based access control (Admin/User)
- ✅ Rate limiting (60 req/min authenticated, 10 req/min anonymous)

### Encryption
- ✅ TLS 1.3 for all data in transit
- ✅ AES-256 encryption at rest (Supabase)
- ✅ HttpOnly, Secure, SameSite cookies

### Infrastructure
- ✅ Vercel Edge Network with DDoS protection
- ✅ Content Security Policy (CSP) headers
- ✅ HSTS with preload
- ✅ Automated vulnerability scanning (CodeQL, npm audit)

### Monitoring
- ✅ Axiom structured logging
- ✅ Sentry error tracking
- ✅ Rate limit violation alerts

---

## Breach Notification Procedure

In compliance with California SB 446 (2026), Curator maintains the following breach notification procedure:

### Definition of Breach
Unauthorized acquisition of unencrypted personal information that compromises the security, confidentiality, or integrity of personal data maintained by Curator.

### Notification Timeline

| Action | Deadline |
|--------|----------|
| Internal detection | Immediate |
| Contain breach | 24 hours |
| Notify affected users | 30 days |
| Notify CA Attorney General | 30 days (if >500 CA residents) |

### Notification Content
As required by CA Civil Code § 1798.82:
1. Nature of the breach
2. Types of information compromised
3. Timeline of the breach
4. Steps taken to address the breach
5. Contact information for questions

### Record Retention
Breach documentation retained for 5 years.

---

## Automated Decision-Making Technology (ADMT)

Curator uses AI-powered features for:
- Metadata enrichment (descriptions, tags)
- Content recommendations
- Search relevance ranking

### Your Rights
Under CPRA, you have the right to:
- Opt out of automated decision-making
- Request human review of AI-generated content
- Access information about the logic involved

To exercise these rights, contact: privacy@curator.app

---

## Contact

- **Security issues:** security@curator.app
- **Privacy requests:** privacy@curator.app
- **General inquiries:** support@curator.app

Last updated: January 2026
