import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock } from "./chrome-mock";
import type { FakeChrome } from "./chrome-mock";
import {
  flushWrites,
  getBraveApiKey,
  getRecentSearches,
  getSettings,
  getSources,
  saveSources,
  setBraveApiKey,
  subscribe,
  SYNC_KEY,
  LOCAL_KEY,
} from "../src/services/storage/StorageService";
import { DEFAULT_SETTINGS, DEFAULT_SOURCES } from "../src/services/storage/defaults";

let chromeMock: FakeChrome;

beforeEach(() => {
  vi.useFakeTimers();
  chromeMock = installChromeMock();
});

afterEach(async () => {
  await flushWrites();
  vi.useRealTimers();
});

describe("storage reads", () => {
  it("falls back to defaults when nothing is stored", async () => {
    const sources = await getSources();
    expect(sources).toEqual(DEFAULT_SOURCES);
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(await getRecentSearches()).toEqual([]);
  });

  it("falls back to defaults when a record is the wrong shape", async () => {
    chromeMock.storage.sync.data[SYNC_KEY.sources] = "nonsense";
    chromeMock.storage.sync.data[SYNC_KEY.settings] = 42;
    chromeMock.storage.sync.data[SYNC_KEY.recentSearches] = { nope: true };

    expect(await getSources()).toEqual(DEFAULT_SOURCES);
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(await getRecentSearches()).toEqual([]);
  });

  it("keeps a stored empty list instead of restoring the defaults", async () => {
    // Disabling every source is a supported state, not a missing record.
    saveSources([]);
    await flushWrites();
    expect(await getSources()).toEqual([]);
  });

  it("merges a partial settings record over the defaults", async () => {
    chromeMock.storage.sync.data[SYNC_KEY.settings] = { providerId: "brave-api" };
    const settings = await getSettings();
    expect(settings.providerId).toBe("brave-api");
    expect(settings.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(settings.exactMatch).toBe(DEFAULT_SETTINGS.exactMatch);
  });

  it("rejects an unknown provider or theme", async () => {
    chromeMock.storage.sync.data[SYNC_KEY.settings] = {
      providerId: "evil",
      theme: "neon",
    };
    const settings = await getSettings();
    expect(settings.providerId).toBe("engine");
    expect(settings.theme).toBe("system");
  });
});

describe("storage writes", () => {
  it("debounces writes", async () => {
    saveSources([DEFAULT_SOURCES[0]!]);
    expect(chromeMock.storage.sync.data[SYNC_KEY.sources]).toBeUndefined();

    vi.advanceTimersByTime(200);
    await flushWrites();
    expect(chromeMock.storage.sync.data[SYNC_KEY.sources]).toHaveLength(1);
  });

  it("round-trips sources", async () => {
    const sources = [{ ...DEFAULT_SOURCES[0]!, enabled: false }];
    saveSources(sources);
    await flushWrites();
    expect(await getSources()).toEqual(sources);
  });

  it("keeps the API key out of sync storage", async () => {
    await setBraveApiKey("secret-key");
    expect(chromeMock.storage.local.data[LOCAL_KEY.braveApiKey]).toBe("secret-key");
    expect(chromeMock.storage.sync.data[LOCAL_KEY.braveApiKey]).toBeUndefined();
    expect(await getBraveApiKey()).toBe("secret-key");
  });
});

describe("subscribe", () => {  it("fires with the re-read value", async () => {
    const seen: number[] = [];
    const unsubscribe = subscribe((changes) => {
      if (changes.sources !== undefined) seen.push(changes.sources.length);
    });

    saveSources([]);
    await flushWrites();
    await vi.waitFor(() => expect(seen).toEqual([0]));

    unsubscribe();
  });

  it("ignores unrelated keys", async () => {
    let calls = 0;
    const unsubscribe = subscribe(() => {
      calls += 1;
    });

    chromeMock.storage.onChanged.emit({ [LOCAL_KEY.braveApiKey]: { newValue: "x" } }, "local");
    await Promise.resolve();
    expect(calls).toBe(0);

    unsubscribe();
  });
});
