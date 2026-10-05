import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import "../styles/globals.css";
import styles from "./popup.module.css";
import { GearIcon } from "../components/icons";
import { SearchBar } from "../components/SearchBar";
import { SourceToggleList } from "../components/SourceToggleList";
import { RecentSearches } from "../components/RecentSearches";
import { useSources } from "../hooks/useSources";
import { useSettings } from "../hooks/useSettings";
import { useRecentSearches } from "../hooks/useRecentSearches";
import { useTheme } from "../hooks/useTheme";

const POPUP_SOURCE_LIMIT = 6;

export function Popup() {
  const { sources, toggle, loading } = useSources();
  const { settings } = useSettings();
  const { recent, add, clear } = useRecentSearches();
  const [query, setQuery] = useState("");

  useTheme(settings?.theme ?? null);

  const enabledCount = sources.filter((source) => source.enabled).length;

  // The popup closes when it loses focus, so keep focus on the search field.
  useEffect(() => {
    const first = document.querySelector<HTMLInputElement>("input[type=search]");
    first?.focus();
  }, []);

  const openSettings = () => {
    void chrome.tabs.create({ url: chrome.runtime.getURL("settings.html") });
    window.close();
  };

  const run = (value: string) => {
    const trimmed = value.trim();
    if (trimmed === "") return;
    add(trimmed);
    void chrome.tabs.create({
      url: chrome.runtime.getURL(`results.html?q=${encodeURIComponent(trimmed)}`),
    });
    window.close();
  };

  return (
    <div className={styles.popup}>
      <header className={styles.header}>
        <span className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            M
          </span>
          MySearch Hub
        </span>
        <button
          type="button"
          className="icon-btn"
          onClick={openSettings}
          aria-label="Open settings"
          title="Settings"
        >
          <GearIcon size={18} />
        </button>
      </header>

      <SearchBar value={query} onChange={setQuery} onSubmit={run} />

      {enabledCount === 0 && !loading ? (
        <div className={styles.emptySources}>
          <span>No sources are enabled.</span>
          <button type="button" className="link-btn" onClick={openSettings}>
            Enable some
          </button>
        </div>
      ) : (
        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>Sources · {enabledCount} enabled</h2>
          <SourceToggleList sources={sources} onToggle={toggle} limit={POPUP_SOURCE_LIMIT} />
          {sources.length > POPUP_SOURCE_LIMIT ? (
            <button type="button" className="link-btn" onClick={openSettings}>
              Manage sources
            </button>
          ) : null}
        </section>
      )}

      <footer className={styles.footer}>
        <RecentSearches recent={recent} onRun={run} onClear={clear} />
        <p className={styles.hint}>
          Press <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>M</kbd> to open, or right-click selected
          text and choose “Search in MySearch Hub”.
        </p>
      </footer>
    </div>
  );
}

const root = document.getElementById("root");
if (root !== null) {
  createRoot(root).render(<Popup />);
}
