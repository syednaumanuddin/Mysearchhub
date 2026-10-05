import { SearchError } from "./errors";
import { normalizeDomain } from "../../utils/domain";
import type { EnginePreset, SearchSource } from "../../types";

export const MAX_QUERY_LENGTH = 256;

/**
 * Operators that could widen or defeat the `site:` restriction. Matched
 * case-insensitively, with or without a value, so both `site:evil.com` and a
 * bare `site:` are removed.
 */
const OPERATOR_TOKEN =
  /(^|[\s(])(-)?\s*(?:site|inurl|intitle|filetype|related|cache|allinurl)\s*:[^\s()"'`]*/gi;

/** Characters that would let a query break out of the quoted phrase or OR group. */
const PHRASE_BREAKERS = /["\\()]/g;

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

export interface BuildOptions {
  supportsOr: boolean;
  exactMatch?: boolean;
}

/**
 * Reduce raw user input to a phrase that can only ever be combined with the
 * caller's `site:` filters.
 */
export function sanitizeQuery(raw: string): string {
  if (typeof raw !== "string") return "";

  let value = raw.replace(CONTROL_CHARS, " ");
  value = value.replace(OPERATOR_TOKEN, "$1");
  value = value.replace(PHRASE_BREAKERS, " ");
  value = value.replace(/\s+/g, " ").trim();

  if (value.length > MAX_QUERY_LENGTH) {
    value = value.slice(0, MAX_QUERY_LENGTH).trim();
  }

  return value;
}

function normalizeDomains(domains: string[]): string[] {
  const seen = new Set<string>();
  for (const domain of domains) {
    const normalized = normalizeDomain(domain);
    if (normalized !== "") seen.add(normalized);
  }
  return [...seen];
}

/**
 * Invariant check: every requested domain must be present in the built query.
 *
 * Called on every build so a future regression cannot silently emit an unscoped
 * query — that would break the product's one promise.
 */
export function assertSourceFilter(query: string, domains: string[]): void {
  const lowered = query.toLowerCase();
  for (const domain of domains) {
    if (!lowered.includes(`site:${domain.toLowerCase()}`)) {
      throw new SearchError("PROVIDER_ERROR", {
        userMessage: `Refusing to run an unscoped search: "${domain}" is missing from the query.`,
      });
    }
  }
}

/**
 * Compose the query that is sent to the provider.
 *
 * Always scoped to `domains`; throws `NO_SOURCES` when there is nothing to
 * scope to, which is the only correct behaviour when every source is disabled.
 */
export function buildSearchQuery(query: string, domains: string[], options: BuildOptions): string {
  const normalized = normalizeDomains(domains);
  if (normalized.length === 0) {
    throw new SearchError("NO_SOURCES");
  }

  const sanitized = sanitizeQuery(query);
  if (sanitized === "") {
    throw new SearchError("EMPTY_QUERY");
  }

  const phrase = options.exactMatch === false ? sanitized : `"${sanitized}"`;
  const filters = normalized.map((domain) => `site:${domain}`);

  const built = options.supportsOr
    ? `${phrase} (${filters.join(" OR ")})`
    : `${phrase} ${filters.join(" ")}`;

  assertSourceFilter(built, normalized);
  return built;
}

/** Single-source variant used for the per-source launch buttons. */
export function buildSourceScopedQuery(
  query: string,
  domain: string,
  options: Omit<BuildOptions, "supportsOr">,
): string {
  return buildSearchQuery(query, [domain], { ...options, supportsOr: false });
}

function substitute(template: string, query: string, code: "INVALID_ENGINE"): string {
  if (!template.includes("{query}")) {
    throw new SearchError(code, {
      userMessage: "The search URL template is missing the {query} placeholder.",
    });
  }
  return template.replace("{query}", encodeURIComponent(query));
}

/** Full engine URL for an already-built query. */
export function buildEngineUrl(enginePreset: EnginePreset, query: string): string {
  return substitute(enginePreset.urlTemplate, query, "INVALID_ENGINE");
}

/**
 * URL for one source.
 *
 * A source's own `searchUrlTemplate` wins so the button hits the site's native
 * search when it has a good one; otherwise the engine gets a `site:`-scoped
 * query for that single source.
 */
export function buildSourceUrl(
  source: SearchSource,
  query: string,
  enginePreset: EnginePreset,
  options: { exactMatch?: boolean } = {},
): string {
  if (source.searchUrlTemplate) {
    return substitute(source.searchUrlTemplate, query, "INVALID_ENGINE");
  }
  const scoped = buildSourceScopedQuery(query, source.domain, { exactMatch: options.exactMatch });
  return buildEngineUrl(enginePreset, scoped);
}
