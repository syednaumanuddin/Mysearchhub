import { describe, expect, it } from "vitest";
import { validateSearchUrlTemplate, validateSourceDraft } from "../src/utils/validation";
import { DEFAULT_SOURCES } from "../src/services/storage/defaults";

describe("validateSourceDraft", () => {
  it("accepts a well-formed draft", () => {
    const result = validateSourceDraft(
      { name: "Example", domain: "example.com", category: "Other" },
      [],
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("requires a name", () => {
    const result = validateSourceDraft(
      { name: "   ", domain: "example.com", category: "Other" },
      [],
    );
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  it("requires a category", () => {
    const result = validateSourceDraft(
      { name: "Example", domain: "example.com", category: "" },
      [],
    );
    expect(result.errors.category).toBeDefined();
  });

  it("rejects a domain that is not a host", () => {
    const result = validateSourceDraft(
      { name: "Example", domain: "how to cook", category: "Other" },
      [],
    );
    expect(result.errors.domain).toBeDefined();
  });

  it("rejects an exact duplicate domain", () => {
    const result = validateSourceDraft(
      { name: "GitHub again", domain: "github.com", category: "Development" },
      DEFAULT_SOURCES,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.domain).toContain("GitHub");
  });

  it("rejects a parent/child overlap in both directions", () => {
    const child = validateSourceDraft(
      { name: "Python docs", domain: "docs.python.org", category: "Documentation" },
      [{ ...DEFAULT_SOURCES[0]!, id: "py", name: "Python", domain: "python.org", url: "https://python.org", category: "Docs", enabled: true }],
    );
    expect(child.errors.domain).toBeDefined();

    const parent = validateSourceDraft(
      { name: "Python", domain: "python.org", category: "Documentation" },
      [{ ...DEFAULT_SOURCES[0]!, id: "py", name: "Python docs", domain: "docs.python.org", url: "https://docs.python.org", category: "Docs", enabled: true }],
    );
    expect(parent.errors.domain).toBeDefined();
  });

  it("allows a source to be edited without colliding with itself", () => {
    // Settings validates an edited draft against every source *except* the one
    // being edited, so keeping its own domain must not be a conflict.
    const self = { ...DEFAULT_SOURCES[0]!, name: "Renamed" };
    const others = DEFAULT_SOURCES.filter((entry) => entry.id !== self.id);

    const result = validateSourceDraft(
      { name: "Renamed", domain: "stackoverflow.com", category: "Development" },
      others,
    );
    expect(result.valid).toBe(true);
  });

  it("accepts an empty optional template", () => {
    const result = validateSourceDraft(
      { name: "Example", domain: "example.com", category: "Other", searchUrlTemplate: "  " },
      [],
    );
    expect(result.errors.searchUrlTemplate).toBeUndefined();
  });

  it("rejects a non-https template", () => {
    const result = validateSourceDraft(
      {
        name: "Example",
        domain: "example.com",
        category: "Other",
        searchUrlTemplate: "http://example.com/s?q={query}",
      },
      [],
    );
    expect(result.errors.searchUrlTemplate).toContain("https");
  });

  it("rejects a template with no {query} placeholder", () => {
    const result = validateSourceDraft(
      { name: "Example", domain: "example.com", category: "Other", searchUrlTemplate: "https://example.com/s" },
      [],
    );
    expect(result.errors.searchUrlTemplate).toContain("{query}");
  });
});

describe("validateSearchUrlTemplate", () => {
  it("passes a valid https template", () => {
    expect(validateSearchUrlTemplate("https://example.com/s?q={query}")).toBeNull();
  });

  it("rejects junk", () => {
    expect(validateSearchUrlTemplate("nonsense")).toBeTypeOf("string");
    expect(validateSearchUrlTemplate("https://example.com/s")).toContain("{query}");
  });
});
