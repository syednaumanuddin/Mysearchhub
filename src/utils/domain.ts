const SCHEME_PREFIX = /^[a-z][a-z0-9+.-]*:\/\//i;
const PROTOCOL_RELATIVE = /^\/\//;
const ILLEGAL_HOST_CHARS = /[\s@\\?#*]/;

/**
 * Reduce any user-entered host reference to a bare registrable domain.
 *
 * `https://www.github.com/`, `www.github.com`, `github.com/` and
 * `HTTPS://GitHub.com` all normalize to `github.com`.
 */
export function normalizeDomain(input: string): string {
  if (typeof input !== "string") return "";

  let value = input.trim();
  if (value === "") return "";

  value = value.replace(SCHEME_PREFIX, "").replace(PROTOCOL_RELATIVE, "");

  const cut = value.search(/[/?#]/);
  if (cut !== -1) value = value.slice(0, cut);

  value = value.replace(/\.+$/, "").toLowerCase();

  if (value.startsWith("www.")) value = value.slice(4);

  return value.replace(/\.+$/, "");
}

/** True when `input` can be read as a host at all. Single labels are rejected. */
export function looksLikeDomain(input: string): boolean {
  const domain = normalizeDomain(input);
  if (domain === "") return false;
  if (domain.length > 253) return false;
  if (ILLEGAL_HOST_CHARS.test(domain)) return false;
  if (!domain.includes(".")) return false;
  if (domain.startsWith(".") || domain.includes("..")) return false;
  if (domain.includes(":")) return false;
  return domain.split(".").every((label) => isValidLabel(label));
}

function isValidLabel(label: string): boolean {
  if (label.length === 0 || label.length > 63) return false;
  if (label.startsWith("-") || label.endsWith("-")) return false;
  return /^[a-z0-9-]+$/.test(label);
}

export function validateDomain(input: string): { valid: boolean; error?: string } {
  const raw = input.trim();
  if (raw === "") return { valid: false, error: "Enter a site address." };
  if (!looksLikeDomain(raw)) {
    return { valid: false, error: "Enter a domain such as example.com — not a search keyword." };
  }
  return { valid: true };
}

/** Extract the hostname of an absolute URL, lowercased and without `www.`. */
export function hostnameFromUrl(url: string): string {
  try {
    return normalizeDomain(new URL(url).hostname);
  } catch {
    return "";
  }
}

/**
 * True when `hostname` is `domain` itself or one of its subdomains.
 *
 * Used both ways in this codebase: to test a Brave result against the enabled
 * sources, and to detect parent/child source conflicts.
 */
export function isSameOrSubdomain(hostname: string, domain: string): boolean {
  const host = normalizeDomain(hostname);
  const parent = normalizeDomain(domain);
  if (host === "" || parent === "") return false;
  return host === parent || host.endsWith(`.${parent}`);
}

/** True when either domain covers the other (duplicate or parent/child overlap). */
export function domainsOverlap(a: string, b: string): boolean {
  return isSameOrSubdomain(a, b) || isSameOrSubdomain(b, a);
}

/** Canonical https origin for a source. */
export function sourceUrl(domain: string): string {
  return `https://${normalizeDomain(domain)}`;
}

/** First letter of the source name, uppercased, for the monogram avatar. */
export function monogram(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "") return "?";
  return (trimmed[0] ?? "?").toUpperCase();
}
