import { describe, expect, it } from "vitest";
import {
  domainsOverlap,
  hostnameFromUrl,
  isSameOrSubdomain,
  looksLikeDomain,
  monogram,
  normalizeDomain,
  validateDomain,
} from "../src/utils/domain";

describe("normalizeDomain", () => {
  it.each([
    ["https://www.github.com/", "github.com"],
    ["www.github.com", "github.com"],
    ["github.com/", "github.com"],
    ["HTTPS://GitHub.com", "github.com"],
    ["  https://github.com/search?q=x  ", "github.com"],
    ["github.com.", "github.com"],
    ["//docs.python.org", "docs.python.org"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it("returns an empty string for a blank input", () => {
    expect(normalizeDomain("   ")).toBe("");
    expect(normalizeDomain("")).toBe("");
  });

  it("normalizes without validating — validation is validateDomain's job", () => {
    // normalizeDomain only reduces a host reference; it does not judge it.
    expect(normalizeDomain("not a domain")).toBe("not a domain");
    expect(validateDomain("not a domain").valid).toBe(false);
  });
});

describe("validateDomain", () => {
  it("accepts real hosts", () => {
    expect(validateDomain("example.com").valid).toBe(true);
    expect(validateDomain("docs.python.org").valid).toBe(true);
  });

  it.each(["", "not a domain", "localhost", "foo", "exa mple.com", "http://", "-bad.com"])(
    "rejects %s",
    (input) => {
      expect(validateDomain(input).valid).toBe(false);
    },
  );

  it("explains why it rejected the input", () => {
    expect(validateDomain("").error).toBeDefined();
    expect(validateDomain("localhost").error).toBeDefined();
  });
});

describe("looksLikeDomain", () => {
  it("requires a dotted multi-label host", () => {
    expect(looksLikeDomain("example.com")).toBe(true);
    expect(looksLikeDomain("localhost")).toBe(false);
    expect(looksLikeDomain("https://example.com/x")).toBe(true);
  });
});

describe("isSameOrSubdomain", () => {
  it("matches a host to its parent", () => {
    expect(isSameOrSubdomain("docs.python.org", "python.org")).toBe(true);
    expect(isSameOrSubdomain("www.python.org", "python.org")).toBe(true);
    expect(isSameOrSubdomain("python.org", "python.org")).toBe(true);
  });

  it("rejects unrelated and reverse-containment hosts", () => {
    expect(isSameOrSubdomain("evilpython.org", "python.org")).toBe(false);
    expect(isSameOrSubdomain("org", "python.org")).toBe(false);
    expect(isSameOrSubdomain("python.org", "docs.python.org")).toBe(false);
    expect(isSameOrSubdomain("", "python.org")).toBe(false);
  });
});

describe("domainsOverlap", () => {
  it("detects parent/child collisions in both directions", () => {
    expect(domainsOverlap("docs.python.org", "python.org")).toBe(true);
    expect(domainsOverlap("python.org", "docs.python.org")).toBe(true);
    expect(domainsOverlap("python.org", "python.org")).toBe(true);
    expect(domainsOverlap("python.org", "golang.org")).toBe(false);
  });
});

describe("hostnameFromUrl", () => {
  it("extracts a normalized hostname", () => {
    expect(hostnameFromUrl("https://www.nytimes.com/2024/01/01/x")).toBe("nytimes.com");
  });

  it("returns empty for an unparseable URL", () => {
    expect(hostnameFromUrl("not a url")).toBe("");
  });
});

describe("monogram", () => {
  it("uses the first letter, uppercased", () => {
    expect(monogram("stack overflow")).toBe("S");
  });

  it("falls back for an empty name", () => {
    expect(monogram("   ")).toBe("?");
  });
});
