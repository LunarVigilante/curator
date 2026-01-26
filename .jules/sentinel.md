## 2024-07-22 - Sensitive Data Exposure in Decryption Error Logging
**Vulnerability:** The decryption function in `src/lib/encryption.ts` was logging the full error object to the console upon a decryption failure.
**Learning:** This exposed sensitive stack trace information and cryptographic details, violating the 'fail securely' principle. Production logs could capture this, providing attackers with internal system details.
**Prevention:** Error handlers for cryptographic functions must always log generic, uninformative messages to the public log stream. Detailed errors should only be available in a secure, audited debugging environment.

## 2026-01-26 - SSRF via Redirects in Import Adapters
**Vulnerability:** Import adapters validated the initial URL but used the default `fetch` behavior which follows redirects. This allowed attackers to provide a safe URL that redirects to an unsafe internal URL (SSRF).
**Learning:** URL validation must occur at every hop of a redirect chain. `fetch` follows redirects by default without re-validating.
**Prevention:** Use `redirect: 'manual'` or `redirect: 'error'` in `fetch`. Created `safeFetch` helper to securely handle redirects by validating the `Location` header against `isSafeUrl` before following.
