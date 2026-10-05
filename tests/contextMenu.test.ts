import { describe, expect, it } from "vitest";
import { buildResultsUrl } from "../src/background/contextMenu";

describe("buildResultsUrl", () => {
  it("builds an encoded results URL", () => {
    expect(buildResultsUrl("JavaScript event loop")).toBe(
      `results.html?q=${encodeURIComponent("JavaScript event loop")}`,
    );
  });

  it("encodes characters that would break a query string", () => {
    const url = buildResultsUrl("a&b=c#d?e");
    expect(url).toBe(`results.html?q=${encodeURIComponent("a&b=c#d?e")}`);
    expect(url).not.toContain("#");
    expect(url).not.toContain("&b");
  });

  it("trims the selection", () => {
    expect(buildResultsUrl("  spaced  ")).toBe(`results.html?q=spaced`);
  });

  it("returns null for an empty or whitespace selection", () => {
    expect(buildResultsUrl("")).toBeNull();
    expect(buildResultsUrl("   \n\t ")).toBeNull();
  });

  it("returns null for a non-string selection", () => {
    expect(buildResultsUrl(undefined as unknown as string)).toBeNull();
  });
});
