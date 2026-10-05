import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock } from "./chrome-mock";
import type { FakeChrome } from "./chrome-mock";
import { BraveApiProvider } from "../src/services/search/providers/BraveApiProvider";
import { BRAVE_ORIGIN } from "../src/services/brave/permissions";
import type { SearchSource, Settings } from "../src/types";

const engineSettings: Settings = {
  engineId: "google",
  enginePreset: {
    id: "google",
    name: "Google",
    urlTemplate: "https://www.google.com/search?q={query}",
    supportsOr: true,
  },
  providerId: "brave-api",
  theme: "system",
  exactMatch: true,
  onboardingCompleted: true,
};

function source(id: string, domain: string): SearchSource {
  return { id, name: id, domain, url: `https://${domain}`, category: "Test", enabled: true };
}

const sources = [source("gh", "github.com"), source("nyt", "nytimes.com")];

let chromeMock: FakeChrome;
let fetchMock: ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  chromeMock = installChromeMock();
  chromeMock.__grantedOrigins.add(BRAVE_ORIGIN);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function configured(): Promise<BraveApiProvider> {
  await chrome.storage.local.set({ braveApiKey: "test-key" });
  return new BraveApiProvider();
}

describe("BraveApiProvider configuration", () => {
  it("is configured with a key and the permission", async () => {
    const provider = await configured();
    await expect(provider.isConfigured()).resolves.toBe(true);
  });

  it("is not configured without a key", async () => {
    await expect(new BraveApiProvider().isConfigured()).resolves.toBe(false);
  });

  it("is not configured without the host permission", async () => {
    await chrome.storage.local.set({ braveApiKey: "test-key" });
    chromeMock.__grantedOrigins.clear();
    await expect(new BraveApiProvider().isConfigured()).resolves.toBe(false);
  });
});

describe("BraveApiProvider search", () => {
  it("maps a response and resolves source ids", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        web: {
          results: [
            { title: "GitHub", url: "https://github.com/foo/bar", description: "A repo" },
            { title: "NYT", url: "https://www.nytimes.com/2024/01/01/x", description: "An article" },
          ],
        },
      }),
    );

    const provider = await configured();
    const outcome = await provider.search({ query: "event loop", sources, settings: engineSettings });

    expect(outcome.mode).toBe("results");
    if (outcome.mode !== "results") throw new Error("unreachable");

    expect(outcome.results).toHaveLength(2);
    expect(outcome.results[0]?.sourceId).toBe("gh");
    expect(outcome.results[0]?.domain).toBe("github.com");
    expect(outcome.results[1]?.sourceId).toBe("nyt");
    expect(outcome.filteredOut).toBe(0);
  });

  it("sends the scoped query and the subscription token", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ web: { results: [] } }));
    const provider = await configured();
    await provider.search({ query: "event loop", sources, settings: engineSettings });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("api.search.brave.com");
    expect(url).toContain("count=20");
    expect(decodeURIComponent(url)).toContain("site:github.com");
    expect((init.headers as Record<string, string>)["X-Subscription-Token"]).toBe("test-key");
  });

  it("drops an off-source result and reports the count", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        web: {
          results: [
            { title: "GitHub", url: "https://github.com/foo/bar", description: "A repo" },
            { title: "Off source", url: "https://evil.example.com/x", description: "Nope" },
          ],
        },
      }),
    );

    const provider = await configured();
    const outcome = await provider.search({ query: "x", sources, settings: engineSettings });
    if (outcome.mode !== "results") throw new Error("unreachable");

    expect(outcome.results).toHaveLength(1);
    expect(outcome.results[0]?.domain).toBe("github.com");
    expect(outcome.filteredOut).toBe(1);
  });

  it("keeps a subdomain result but drops a lookalike host", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        web: {
          results: [
            { title: "Docs", url: "https://docs.github.com/en", description: "" },
            { title: "Lookalike", url: "https://notgithub.com/x", description: "" },
          ],
        },
      }),
    );

    const provider = await configured();
    const outcome = await provider.search({ query: "x", sources, settings: engineSettings });
    if (outcome.mode !== "results") throw new Error("unreachable");

    expect(outcome.results.map((entry) => entry.domain)).toEqual(["docs.github.com"]);
    expect(outcome.filteredOut).toBe(1);
  });

  it("throws BAD_API_KEY on 401", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 401));
    const provider = await configured();
    await expect(
      provider.search({ query: "x", sources, settings: engineSettings }),
    ).rejects.toMatchObject({ code: "BAD_API_KEY" });
  });

  it("throws PLAN_REQUIRED on 402", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 402));
    const provider = await configured();
    await expect(
      provider.search({ query: "x", sources, settings: engineSettings }),
    ).rejects.toMatchObject({ code: "PLAN_REQUIRED" });
  });

  it("throws RATE_LIMITED on 429", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 429));
    const provider = await configured();
    await expect(
      provider.search({ query: "x", sources, settings: engineSettings }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("throws PROVIDER_ERROR on 500", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));
    const provider = await configured();
    await expect(
      provider.search({ query: "x", sources, settings: engineSettings }),
    ).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
  });

  it("throws NETWORK_ERROR when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const provider = await configured();
    await expect(
      provider.search({ query: "x", sources, settings: engineSettings }),
    ).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("throws NO_SOURCES before making a request", async () => {
    const provider = await configured();
    await expect(
      provider.search({ query: "x", sources: [], settings: engineSettings }),
    ).rejects.toMatchObject({ code: "NO_SOURCES" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws NOT_CONFIGURED when the key is missing", async () => {
    const provider = new BraveApiProvider();
    await expect(
      provider.search({ query: "x", sources, settings: engineSettings }),
    ).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
