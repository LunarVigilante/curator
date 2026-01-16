## 2025-02-18 - SSRF in Image Proxy
**Vulnerability:** The `src/app/api/image-proxy/route.ts` endpoint accepts an arbitrary `url` query parameter and fetches it using the server-side `fetch` API without validation. This allows an attacker to make the server send requests to internal services (localhost), private IP ranges, or cloud metadata services (e.g., AWS 169.254.169.254), leading to potential information disclosure or internal network scanning.

**Learning:** When implementing proxy endpoints in Next.js (or any backend), trust no input. The `fetch` API will happily access local or private network resources if directed to do so. Simple URL parsing is not enough if DNS resolution points to a private IP (DNS Rebinding), but basic hostname/IP blocking provides a significant layer of defense.

**Prevention:** Always validate the target URL against a strict allowlist (if possible) or a comprehensive blocklist. Ensure the protocol is HTTP/HTTPS. Block access to `localhost`, `127.0.0.1`, `0.0.0.0`, `[::]`, and link-local addresses like `169.254.169.254`.
