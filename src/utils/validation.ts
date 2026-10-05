import { domainsOverlap, normalizeDomain, validateDomain } from "./domain";
import type { SearchSource } from "../types";

export interface SourceDraft {
  name: string;
  domain: string;
  category: string;
  searchUrlTemplate?: string;
}

export type SourceDraftErrors = Partial<Record<"name" | "domain" | "category" | "searchUrlTemplate", string>>;

export interface ValidationResult {
  valid: boolean;
  errors: SourceDraftErrors;
}

export const MAX_NAME_LENGTH = 40;

/**
 * Validate a source form draft against the sources that already exist.
 *
 * Duplicate rejection is deliberately stricter than string equality: a parent
 * and its child would both match the same search, so `docs.python.org` cannot
 * be added next to `python.org`.
 */
export function validateSourceDraft(draft: SourceDraft, existing: SearchSource[]): ValidationResult {
  const errors: SourceDraftErrors = {};

  const name = draft.name.trim();
  if (name === "") {
    errors.name = "Give the source a name.";
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.name = `Keep the name under ${MAX_NAME_LENGTH} characters.`;
  }

  const category = draft.category.trim();
  if (category === "") {
    errors.category = "Pick or type a category.";
  }

  const domainCheck = validateDomain(draft.domain);
  if (!domainCheck.valid) {
    errors.domain = domainCheck.error;
  }

  const template = draft.searchUrlTemplate?.trim() ?? "";
  if (template !== "") {
    const templateError = validateSearchUrlTemplate(template);
    if (templateError) errors.searchUrlTemplate = templateError;
  }

  if (!errors.domain) {
    const normalized = normalizeDomain(draft.domain);
    const conflict = existing.find((source) => domainsOverlap(source.domain, normalized));
    if (conflict) {
      errors.domain = `Overlaps an existing source: ${conflict.name} (${conflict.domain}).`;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** A native search template must be https and expose the `{query}` placeholder. */
export function validateSearchUrlTemplate(template: string): string | null {
  if (!template.includes("{query}")) {
    return "The template must contain {query}.";
  }
  let parsed: URL;
  try {
    parsed = new URL(template.replace("{query}", "probe"));
  } catch {
    return "Enter a valid URL.";
  }
  if (parsed.protocol !== "https:") {
    return "The template must use https.";
  }
  return null;
}

export function makeSourceId(domain: string): string {
  const normalized = normalizeDomain(domain);
  const slug = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug === "" ? crypto.randomUUID() : slug;
}
