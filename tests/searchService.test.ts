import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock } from "./chrome-mock";
import { enabledSources, runSearch } from "../src/services/search/SearchService";
import { BRAVE_ORIGIN } from "../src/services/brave/permissions";
import type { EnginePreset, SearchSource, Settings } from "../src/types";

const engine: EnginePreset = {
  id: "google",
  name: "Google",
  urlTemplate: "https://www.google.com/search?q={query}",
  supportsOr: true,
};

function settings(overrides: Partial<Settings> = {}): Settings {
  return {
    engineId: "google",
    enginePreset: engine,
    providerId: "engine",
    theme: "system",
    exactMatch: true,
    onboardingCompleted: true,
    ...overrides,
  };
}

function source(id: string, domain: string, enabled = true): SearchSource {
  return { id, name: id, domain, url: `https://${domain}`, category: "Test", enabled };
}

const sources = [source("gh", "github.com"), source("so", "stackoverflow.com")];

beforeEach(() => {
  installChromeMock();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("enabledSources", () => {
  it("keeps only enabled sources, in order", () => {
    expect(enabledSources([source("a", "a.com"), source("b", "b.com", false)]).map((s) => s.id)).toEqual([
      "a",
    ]);
  });
});

describe("runSearch guard rails", () => {
  it("refuses an empty query", async () => {
    await expect(
      runSearch({ query: "   ", sources, settings: settings() }),
    ).rejects.toMatchObject({ code: "EMPTY_QUERY" });
  });

  it("refuses when the query is nothing but an operator", async () => {
    await expect(
      runSearch({ query: "site:evil.com", sources, settings: settings() }),
    ).rejects.toMatchObject({ code: "EMPTY_QUERY" });
  });

  it("refuses when no source is enabled", async () => {
    const allOff = sources.map((entry) => ({ ...entry, enabled: false }));
    await expect(
      runSearch({ query: "event loop", sources: allOff, settings: settings() }),
    ).rejects.toMatchObject({ code: "NO_SOURCES" });
  });

  it("only ever scopes to enabled sources", async () => {
    const mixed = [source("gh", "github.com"), source("off", "evil.com", false)];
    const outcome = await runSearch({ query: "event loop", sources: mixed, settings: settings() });
    if (outcome.mode !== "launch") throw new Error("unreachable");

    expect(outcome.query).toContain("site:github.com");
    expect(outcome.query).not.toContain("evil.com");
    expect(outcome.perSource).toHaveLength(1);
  });

  it("launches engine URLs when the engine provider is selected", async () => {
    const outcome = await runSearch({ query: "event loop", sources, settings: settings() });
    expect(outcome.mode).toBe("launch");
  });
});

describe("runSearch provider fallback", () => {
  it("falls back to scoped engine links when Brave has no key", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await runSearch({
      query: "event loop",
      sources,
      settings: settings({ providerId: "brave-api" }),
    });

    expect(outcome.mode).toBe("launch");
    if (outcome.mode !== "launch") throw new Error("unreachable");

    expect(outcome.notice).toBeTypeOf("string");
    expect(decodeURIComponent(outcome.combinedUrl)).toContain("site:github.com");
    expect(decodeURIComponent(outcome.combinedUrl)).toContain("site:stackoverflow.com");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the API when it is configured", async () => {
    const chromeMock = installChromeMock();
    chromeMock.__grantedOrigins.add(BRAVE_ORIGIN);
    await chrome.storage.local.set({ braveApiKey: "k" });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        web: { results: [{ title: "t", url: "https://github.com/a", description: "d" }] },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await runSearch({
      query: "event loop",
      sources,
      settings: settings({ providerId: "brave-api" }),
    });

    expect(outcome.mode).toBe("results");
    if (outcome.mode !== "results") throw new Error("unreachable");
    expect(outcome.results).toHaveLength(1);
  });

  it("propagates an API failure rather than silently widening the search", async () => {
    const chromeMock = installChromeMock();
    chromeMock.__grantedOrigins.add(BRAVE_ORIGIN);
    await chrome.storage.local.set({ braveApiKey: "k" });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
    );

    await expect(
      runSearch({
        query: "event loop",
        sources,
        settings: settings({ providerId: "brave-api" }),
      }),
    ).rejects.toMatchObject({ code: "BAD_API_KEY" });
  });
});
