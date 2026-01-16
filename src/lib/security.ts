/**
 * Security utility functions
 */

/**
 * Validates if a URL is safe to fetch server-side.
 * Blocks non-http protocols and private/internal IP ranges.
 *
 * NOTE: This does not prevent DNS rebinding attacks where a domain resolves to a private IP
 * after the check. For critical high-security environments, use a custom HTTP agent
 * that validates IPs at the socket level.
 */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // 1. Protocol check
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // 2. Blocklist for hostnames
    if (hostname === 'localhost') return false;
    if (hostname === '[::1]') return false;

    // 3. Blocklist for IPs
    // Check if hostname looks like an IPv4 address
    const isIpV4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);

    if (isIpV4) {
      // 127.0.0.0/8 - Loopback
      if (hostname.startsWith('127.')) return false;

      // 169.254.0.0/16 - Link-local / Cloud Metadata
      if (hostname.startsWith('169.254.')) return false;

      // 10.0.0.0/8 - Private Class A
      if (hostname.startsWith('10.')) return false;

      // 192.168.0.0/16 - Private Class C
      if (hostname.startsWith('192.168.')) return false;

      // 172.16.0.0/12 - Private Class B (172.16.0.0 - 172.31.255.255)
      if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) return false;

      // 0.0.0.0/8
      if (hostname.startsWith('0.')) return false;
    }

    return true;
  } catch {
    // Invalid URL
    return false;
  }
}
