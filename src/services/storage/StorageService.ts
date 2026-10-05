import { DEFAULT_SETTINGS, DEFAULT_SOURCES } from "./defaults";
import type { RecentSearch, SearchSource, Settings } from "../../types";

export const SYNC_KEY = {
  sources: "sources",
  recentSearches: "recentSearches",
  settings: "settings",
} as const;

export const LOCAL_KEY = {
  braveApiKey: "braveApiKey",
} as const;

export const RECENT_SEARCH_LIMIT = 15;
export const WRITE_DEBOUNCE_MS = 150;

type StorageArea = chrome.storage.StorageArea;

export type StorageChangeListener = (changes: {
  sources?: SearchSource[];
  recentSearches?: RecentSearch[];
  settings?: Settings;
}) => void;

function storageAvailable(): boolean {
  return typeof chrome !== "undefined" && typeof chrome.storage !== "undefined";
}

/** `chrome.storage.sync` is unavailable in some contexts; `local` is the fallback. */
function syncArea(): StorageArea | null {
  if (!storageAvailable()) return null;
  return (chrome.storage.sync as StorageArea | undefined) ?? (chrome.storage.local as StorageArea);
}

function localArea(): StorageArea | null {
  if (!storageAvailable()) return null;
  return (chrome.storage.local as StorageArea | undefined) ?? null;
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "QuotaExceededError" || error.message.includes("QUOTA_BYTES"))
  );
}

/* ------------------------------------------------------------------ *
 * Pure recent-search helpers (MRU, case-insensitive dedupe, cap 15)
 * ------------------------------------------------------------------ */

export function addRecentSearch(
  existing: RecentSearch[],
  query: string,
  now: number = Date.now(),
): RecentSearch[] {
  const trimmed = query.trim();
  if (trimmed === "") return existing;

  const lowered = trimmed.toLowerCase();
  const withoutDuplicate = existing.filter((entry) => entry.query.trim().toLowerCase() !== lowered);

  return [{ query: trimmed, at: now }, ...withoutDuplicate].slice(0, RECENT_SEARCH_LIMIT);
}

export function clearRecentSearches(): RecentSearch[] {
  return [];
}
/* ------------------------------------------------------------------ *
 * Debounced writers
 * ------------------------------------------------------------------ */

interface PendingWrite {
  timer: ReturnType<typeof setTimeout>;
  value: unknown;
}

const pending = new Map<string, PendingWrite>();

async function writeNow(area: StorageArea, key: string, value: unknown): Promise<void> {
  await area.set({ [key]: value });
}

async function writeWithFallback(key: string, value: unknown): Promise<void> {
  const area = syncArea();
  if (!area) return;
  try {
    await writeNow(area, key, value);
  } catch (error) {
    if (!isQuotaError(error)) throw error;
    // Sync quota exhausted: keep the session working by falling back to local.
    const fallback = localArea();
    if (fallback) await writeNow(fallback, key, value);
  }
}

function schedule(key: string, value: unknown): void {
  const existing = pending.get(key);
  if (existing) clearTimeout(existing.timer);
  const timer = setTimeout(() => {
    pending.delete(key);
    void writeWithFallback(key, value);
  }, WRITE_DEBOUNCE_MS);
  pending.set(key, { timer, value });
}

/** Force any debounced write to land. Used by tests and by page teardown. */
export async function flushWrites(): Promise<void> {
  const entries = [...pending.entries()];
  pending.clear();
  for (const [key, entry] of entries) {
    // Cancel the pending timer too, otherwise it fires later and writes twice.
    clearTimeout(entry.timer);
    await writeWithFallback(key, entry.value);
  }
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

function coerceSources(raw: unknown): SearchSource[] {
  // An explicitly stored empty list is a legitimate state — the user may have
  // disabled everything, and the extension must then refuse to search rather
  // than silently restoring the defaults. Only a missing or corrupt record
  // falls back.
  if (raw === undefined || raw === null) return DEFAULT_SOURCES.map((entry) => ({ ...entry }));
  if (!Array.isArray(raw)) return DEFAULT_SOURCES.map((entry) => ({ ...entry }));

  return raw.filter(
    (entry): entry is SearchSource =>
      typeof entry === "object" && entry !== null && typeof (entry as SearchSource).domain === "string",
  );
}

function coerceRecents(raw: unknown): RecentSearch[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is RecentSearch =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as RecentSearch).query === "string" &&
      typeof (entry as RecentSearch).at === "number",
  );
}

function coerceSettings(raw: unknown): Settings {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_SETTINGS };
  const merged = { ...DEFAULT_SETTINGS, ...(raw as Partial<Settings>) } as Settings;
  return {
    ...merged,
    enginePreset: merged.enginePreset ?? DEFAULT_SETTINGS.enginePreset,
    providerId: merged.providerId === "brave-api" ? "brave-api" : "engine",
    theme: merged.theme === "light" || merged.theme === "dark" ? merged.theme : "system",
    exactMatch: merged.exactMatch !== false,
    onboardingCompleted: merged.onboardingCompleted === true,
  };
}

async function readOne(key: string): Promise<unknown> {
  const area = syncArea();
  if (!area) return undefined;
  const bag = await area.get(key);
  return (bag as Record<string, unknown>)[key];
}

export async function getSources(): Promise<SearchSource[]> {
  try {
    return coerceSources(await readOne(SYNC_KEY.sources));
  } catch {
    return DEFAULT_SOURCES.map((entry) => ({ ...entry }));
  }
}

export async function getSettings(): Promise<Settings> {
  try {
    return coerceSettings(await readOne(SYNC_KEY.settings));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function getRecentSearches(): Promise<RecentSearch[]> {
  try {
    return coerceRecents(await readOne(SYNC_KEY.recentSearches));
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ *
 * Writes
 * ------------------------------------------------------------------ */

export async function saveSources(sources: SearchSource[]): Promise<void> {
  schedule(SYNC_KEY.sources, sources);
}

export async function saveSettings(settings: Settings): Promise<void> {
  schedule(SYNC_KEY.settings, settings);
}

export async function saveRecentSearches(recents: RecentSearch[]): Promise<void> {
  schedule(SYNC_KEY.recentSearches, recents);
}

/** Bypass the debounce: seeding on install should not be lost to a fast restart. */
export async function writeSourcesNow(sources: SearchSource[]): Promise<void> {
  pending.delete(SYNC_KEY.sources);
  await writeWithFallback(SYNC_KEY.sources, sources);
}

/* ------------------------------------------------------------------ *
 * Secret material — local area only, never synced
 * ------------------------------------------------------------------ */

export async function getBraveApiKey(): Promise<string> {
  const area = localArea();
  if (!area) return "";
  try {
    const bag = await area.get(LOCAL_KEY.braveApiKey);
    const value = (bag as Record<string, unknown>)[LOCAL_KEY.braveApiKey];
    return typeof value === "string" ? value.trim() : "";
  } catch {
    return "";
  }
}

export async function setBraveApiKey(key: string): Promise<void> {
  const area = localArea();
  if (!area) return;
  await area.set({ [LOCAL_KEY.braveApiKey]: key.trim() });
}

export async function clearBraveApiKey(): Promise<void> {
  const area = localArea();
  if (!area) return;
  await area.remove(LOCAL_KEY.braveApiKey);
}

/* ------------------------------------------------------------------ *
 * Cross-page live sync
 * ------------------------------------------------------------------ */

const listeners = new Set<StorageChangeListener>();

const WATCHED_KEYS = [SYNC_KEY.sources, SYNC_KEY.recentSearches, SYNC_KEY.settings] as const;

function onChanged(changes: Record<string, chrome.storage.StorageChange>, areaName: string): void {
  if (areaName !== "sync" && areaName !== "local") return;

  const touched = WATCHED_KEYS.filter((key) => key in changes);
  if (touched.length === 0) return;

  // Re-read rather than trusting `changes.newValue`: a sync merge from another
  // device can produce a value that is not what this write wrote.
  void (async () => {
    const batch: Parameters<StorageChangeListener>[0] = {};
    if (touched.includes(SYNC_KEY.sources)) batch.sources = await getSources();
    if (touched.includes(SYNC_KEY.recentSearches)) batch.recentSearches = await getRecentSearches();
    if (touched.includes(SYNC_KEY.settings)) batch.settings = await getSettings();
    for (const listener of listeners) listener(batch);
  })();
}

let attached = false;

/** Subscribe to source/settings/recent-search changes from any extension page. */
export function subscribe(listener: StorageChangeListener): () => void {
  if (!storageAvailable()) return () => {};
  if (!attached) {
    attached = true;
    chrome.storage.onChanged.addListener(onChanged);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const StorageService = {
  getSources,
  getSettings,
  getRecentSearches,
  saveSources,
  saveSettings,
  saveRecentSearches,
  writeSourcesNow,
  getBraveApiKey,
  setBraveApiKey,
  clearBraveApiKey,
  subscribe,
  addRecentSearch,
  clearRecentSearches,
  flushWrites,
};

export type StorageServiceApi = typeof StorageService;
