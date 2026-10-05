# MySearch Hub

A Chrome extension (Manifest V3) that runs one query against **only the sources you enabled**.

Most search extensions take your query and send it somewhere you did not choose. MySearch Hub inverts
that: you pick the sites, and it is structurally incapable of running a search it was not scoped to.

> Every query is wrapped in a `site:` filter for the enabled sources. Disable all of them and the
> extension refuses to search and says so — there is no flag that widens it back to the open web.

---

## Install from source

```bash
npm install
npm run build
```

Then in Chrome:

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the generated `dist/` folder

`dist/` is a complete, loadable extension. Do not load the repository root — the manifest lives in
`public/` and is copied into `dist/` at build time.

### Scripts

| Command             | What it does                                                    |
| ------------------- | --------------------------------------------------------------- |
| `npm run dev`       | Vite dev server for iterating on pages (no extension APIs)       |
| `npm run typecheck` | `tsc --noEmit`, strict                                             |
| `npm test`          | Vitest, business logic only                                       |
| `npm run build`     | typecheck → pages build → single-file service-worker build       |
| `npm run icons`     | Regenerate `public/icons/*.png` (already committed)               |

---

## Using it

- **Popup** — type a query, flip which sources are included, hit Search.
- **Results page** — shows the exact built query, a "Search all N sources" button, and one button per
  source. Toggling a source updates the query live.
- **Context menu** — select text anywhere, right-click, **Search in MySearch Hub**.
- **Keyboard** — `Ctrl+Shift+M` opens the popup.
- **Settings** (`chrome://extensions` → extension options, or the gear icon) — engine, provider,
  theme, presets, and the full source list with add/edit/remove/reorder.

Two providers sit behind one `SearchProvider` interface:

- **Search engine (default, zero-config)** — builds the scoped query and hands you links. No
  permissions, no network calls from the extension itself.
- **Brave Search API (optional)** — returns structured results in the results page. Needs your own
  key.

---

## Permissions, and why there are so few

| Permission                          | Why                                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `storage`                           | Saves your sources, recents and settings.                                                  |
| `contextMenus`                      | The "Search in MySearch Hub" item on selected text.                                         |
| `https://api.search.brave.com/*`     | **Optional**, and only if you turn on the Brave provider.                                   |

There is no `host_permissions`, no content script, no `<all_urls>`, and no `web_accessible_resources`.
The extension reads nothing from any page. Source favicons are drawn as CSS letter monograms hashed
from the domain, specifically so that showing an icon never requires fetching from a third-party host.

### Privacy

- `sources`, `recentSearches` and `settings` go to `chrome.storage.sync`, so they follow your Chrome
  profile. They are small and well under quota.
- Your Brave API key goes to `chrome.storage.local` **only**. It is never synced, never written into
  the bundle, and never logged. "Forget key" deletes it and revokes the host permission.
- A query reaches exactly one destination: the provider you selected. In engine mode the extension
  makes no request at all — it gives you a URL and your browser does the rest. In Brave mode it goes
  to `api.search.brave.com` and nowhere else, which the MV3 CSP enforces.
- Nothing is fetched for favicons, analytics or telemetry. There are none.

---

## Adding a search provider

A provider is one object with an id, a name, a configuration check and a search method.

```ts
// src/services/search/providers/YourProvider.ts
import type { SearchProvider, SearchRequest } from "../SearchProvider";
import type { SearchOutcome } from "../../../types";

export class YourProvider implements SearchProvider {
  readonly id = "your-api" as const;
  readonly name = "Your API";

  async isConfigured(): Promise<boolean> {
    // False makes the UI fall back to engine links (still site:-scoped).
    return hasYourKey();
  }

  async search({ query, sources, settings }: SearchRequest): Promise<SearchOutcome> {
    // Build the scoped query — never the raw one.
    const scoped = buildSearchQuery(
      query,
      sources.map((s) => s.domain),
      { supportsOr: true, exactMatch: settings.exactMatch },
    );

    return { mode: "results", results: fetchAndFilter(scoped, sources), filteredOut: 0 };
  }
}
```

Then register it in `src/services/search/SearchProvider.ts` and add the id to `ProviderId` in
`src/types/index.ts`.

### Two rules a provider must not break

1. **Never build a query from `query` alone.** Use `buildSearchQuery(query, domains, ...)`. It
   normalizes and de-duplicates the domains, sanitizes the query (stripping `site:`, `inurl:`,
   `intitle:` and friends so an operator cannot be injected), and asserts that every domain survived
   into the output. That assertion is why a regression cannot silently produce an unscoped search.
2. **Never trust the response.** Brave results are re-checked against the enabled sources and
   off-source results are dropped and counted in `filteredOut`. Any provider returning results should
   do the same.

Return `mode: "launch"` with `combinedUrl` + `perSource[]` if the provider produces links rather than
results.

---

## Architecture

```
public/manifest.json      MV3, static — copied verbatim into dist/
scripts/generate-icons.mjs  Zero-dependency PNG writer (zlib + hand-rolled CRC32)
src/services/search/      QueryBuilder, providers, SearchService, errors
src/services/storage/     The only place chrome.storage is touched
src/components/          Shared React components + design-token CSS
src/{popup,results,settings,onboarding}/   One HTML entry each
tests/                    Vitest, node environment, business logic only
```

`SearchService.runSearch` is the single entry point the UI searches through. Its checks run in order:
usable query → at least one enabled source → provider configured → execute. There is deliberately no
branch that emits an unscoped query; a misconfigured API provider falls back to engine *links*, which
are still `site:`-scoped.

Two build passes are required. MV3 service workers cannot be code-split — a worker that imports a
shared chunk fails to register with "Could not load service worker" — so `vite.sw.config.ts` builds
`background.js` as one self-contained file with `emptyOutDir: false`.

## Testing

```bash
npm test
```

111 tests cover domain normalization, source validation (including parent/child domain collisions),
the query builder's scoping guarantees, the engine and Brave providers, the search-service guard
rails, storage round-trips and fallbacks, recent-search ordering, and the context-menu URL builder.
`tests/chrome-mock.ts` is a hand-rolled `chrome.*` mock whose areas are independent, which is what
lets a test prove the API key never lands in `storage.sync`.

Business logic only — there is no DOM testing library. Components are kept thin for that reason.

## License

MIT
