import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "../styles/globals.css";
import styles from "./results.module.css";
import { GearIcon, SearchIcon } from "../components/icons";
import { SearchBar } from "../components/SearchBar";
import { SourceChip } from "../components/SourceChip";
import { SourceAvatar } from "../components/SourceAvatar";
import { SearchResultList } from "../components/SearchResultCard";
import { EmptyState, ErrorState, LoadingState, NoResultsState, NoSourcesState } from "../components/states";
import { useSources } from "../hooks/useSources";
import { useSettings } from "../hooks/useSettings";
import { useRecentSearches } from "../hooks/useRecentSearches";
import { useTheme } from "../hooks/useTheme";
import { runSearch } from "../services/search/SearchService";
import { SearchError, toSearchError } from "../services/search/errors";
import type { SearchOutcome } from "../types";

function readQueryFromLocation(): string {
  return new URLSearchParams(window.location.search).get("q")?.trim() ?? "";
}

export function Results() {
  const { sources, toggle, loading: sourcesLoading } = useSources();
  const { settings, loading: settingsLoading } = useSettings();
  const { add: remember } = useRecentSearches();
  const [input, setInput] = useState(readQueryFromLocation);
  const [outcome, setOutcome] = useState<SearchOutcome | null>(null);
  const [error, setError] = useState<SearchError | null>(null);
  const [running, setRunning] = useState(false);

  useTheme(settings?.theme ?? null);

  const activeSources = useMemo(() => sources.filter((source) => source.enabled), [sources]);

  const execute = useCallback(
    async (rawQuery: string) => {
      const query = rawQuery.trim();
      if (query === "" || settings === null) return;

      setRunning(true);
      setError(null);
      setOutcome(null);
      remember(query);

      try {
        setOutcome(await runSearch({ query, sources, settings }));
      } catch (thrown) {
        setError(toSearchError(thrown));
      } finally {
        setRunning(false);
      }
    },
    [remember, settings, sources],
  );

  const query = readQueryFromLocation();

  // Re-run whenever the query or the enabled-source set changes, so toggling a
  // source on the results page updates the query live.
  useEffect(() => {
    if (sourcesLoading || settingsLoading || settings === null) return;
    if (query === "") {
      setOutcome(null);
      setError(null);
      return;
    }
    void execute(query);
  }, [query, sourcesLoading, settingsLoading, settings, sources]);

  useEffect(() => {
    setInput(query);
  }, [query]);

  const submit = (value: string) => {
    const trimmed = value.trim();
    if (trimmed === "") return;
    remember(trimmed);
    const url = new URL(window.location.href);
    url.searchParams.set("q", trimmed);
    window.history.pushState(null, "", url);
    setInput(trimmed);
  };

  const openSettings = () => {
    void chrome.tabs.create({ url: chrome.runtime.getURL("settings.html") });
  };

  const busy = running || sourcesLoading || settingsLoading;

  return (
    <div className={styles.page}>
      <header className={styles.shell}>
        <div className={styles.header}>
          <span className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">
              M
            </span>
            MySearch Hub
          </span>
          <div className={styles.headerSearch}>
            <SearchBar value={input} onChange={setInput} onSubmit={submit} busy={busy} />
          </div>
          <button type="button" className="icon-btn" onClick={openSettings} aria-label="Open settings">
            <GearIcon size={18} />
          </button>
        </div>
      </header>

      <main className={styles.shell}>
        {activeSources.length > 0 ? (
          <div className="chip-row">
            {activeSources.map((source) => (
              <SourceChip
                key={source.id}
                source={source}
                onRemove={() => toggle(source.id, false)}
              />
            ))}
          </div>
        ) : null}

        {query === "" ? (
          <EmptyState />
        ) : activeSources.length === 0 && !sourcesLoading ? (
          <NoSourcesState />
        ) : busy ? (
          <LoadingState />
        ) : error !== null ? (
          <ErrorState
            title={error.userMessage}
            body={
              error.code === "NO_SOURCES" ? undefined : `Error code: ${error.code}`
            }
          />
        ) : outcome?.mode === "launch" ? (
          <LaunchPanel outcome={outcome} />
        ) : outcome?.mode === "results" ? (
          outcome.results.length === 0 ? (
            <NoResultsState />
          ) : (
            <div>
              <ResultsSummary count={outcome.results.length} filteredOut={outcome.filteredOut} />
              <SearchResultList results={outcome.results} sources={sources} />
            </div>
          )
        ) : (
          <EmptyState />
        )}
      </main>
    </div>
  );
}

function ResultsSummary({ count, filteredOut }: { count: number; filteredOut: number }) {
  return (
    <div>
      <p className={styles.filteredNotice}>
        {count} result{count === 1 ? "" : "s"} from your enabled sources.
        {filteredOut > 0
          ? ` ${filteredOut} off-source result${filteredOut === 1 ? "" : "s"} filtered out.`
          : ""}
      </p>
    </div>
  );
}

function LaunchPanel({ outcome }: { outcome: Extract<SearchOutcome, { mode: "launch" }> }) {
  return (
    <section className={styles.panel}>
      {outcome.notice === undefined ? null : (
        <p className={styles.notice}>{outcome.notice}</p>
      )}

      <div className={styles.queryBlock}>
        <span className={styles.queryLabel}>Query</span>
        <p className={styles.queryValue}>{outcome.query}</p>
        <p className={styles.panelHint}>
          Every link below is already restricted to your enabled sources.
        </p>
      </div>

      <div className={styles.primaryRow}>
        <a
          className="btn"
          data-variant="primary"
          href={outcome.combinedUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          <SearchIcon />
          Search all {outcome.perSource.length} sources
        </a>
      </div>

      <div className={styles.queryBlock}>
        <span className={styles.queryLabel}>Or pick one source</span>
        <div className={styles.launchGrid}>
          {outcome.perSource.map(({ source, url }) => (
            <a
              key={source.id}
              className={styles.launchButton}
              href={url}
              target="_blank"
              rel="noreferrer noopener"
            >
              <SourceAvatar name={source.name} domain={source.domain} />
              <span className={styles.launchButtonBody}>
                <span className={styles.launchButtonName}>{source.name}</span>
                <span className={styles.launchButtonMeta}>{source.domain}</span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

const root = document.getElementById("root");
if (root !== null) {
  createRoot(root).render(<Results />);
}
