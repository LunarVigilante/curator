## 2024-07-22 - Sensitive Data Exposure in Decryption Error Logging
**Vulnerability:** The decryption function in `src/lib/encryption.ts` was logging the full error object to the console upon a decryption failure.
**Learning:** This exposed sensitive stack trace information and cryptographic details, violating the 'fail securely' principle. Production logs could capture this, providing attackers with internal system details.
**Prevention:** Error handlers for cryptographic functions must always log generic, uninformative messages to the public log stream. Detailed errors should only be available in a secure, audited debugging environment.
