import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "../styles/globals.css";
import styles from "./settings.module.css";
import { PlusIcon, ShieldIcon } from "../components/icons";
import { SourceList } from "../components/SourceList";
import { RecentSearches } from "../components/RecentSearches";
import { Dialog } from "../components/Dialog";
import { Toggle } from "../components/Toggle";
import { useSources } from "../hooks/useSources";
import { useSettings } from "../hooks/useSettings";
import { useRecentSearches } from "../hooks/useRecentSearches";
import { useTheme } from "../hooks/useTheme";
import { CATEGORIES, DEFAULT_SOURCES, ENGINE_PRESETS, PRESETS } from "../services/storage/defaults";
import { getBraveApiKey } from "../services/storage/StorageService";
import { disable as disableBrave, enable as enableBrave, hasAccess } from "../services/brave/permissions";
import { normalizeDomain } from "../utils/domain";
import { validateSourceDraft } from "../utils/validation";
import type { SourceDraftErrors } from "../utils/validation";
import type { SearchSource, ThemePreference } from "../types";

const CUSTOM_ENGINE_ID = "custom";

export function Settings() {
  const { sources, toggle, add, update, remove, move, commit } = useSources();
  const { settings, loading: settingsLoading, update: updateSettings } = useSettings();
  const { recent, clear } = useRecentSearches();  const [filter, setFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SearchSource | null>(null);
  const [draft, setDraft] = useState({ name: "", domain: "", category: "", searchUrlTemplate: "" });
  const [errors, setErrors] = useState<SourceDraftErrors>({});
  const [keyDraft, setKeyDraft] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [permission, setPermission] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);

  useTheme(settings?.theme ?? null);

  useEffect(() => {
    void Promise.all([getBraveApiKey(), hasAccess()]).then(([key, permitted]) => {
      setHasKey(key !== "");
      setPermission(permitted);
    });
  }, []);

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (needle === "") return sources;
    return sources.filter(
      (source) =>
        source.name.toLowerCase().includes(needle) ||
        source.domain.toLowerCase().includes(needle) ||
        source.category.toLowerCase().includes(needle),
    );
  }, [filter, sources]);

  if (settingsLoading || settings === null) {
    return (
      <main className={styles.shell}>
        <p>Loading…</p>
      </main>
    );
  }

  const engineTemplate =
    settings.engineId === CUSTOM_ENGINE_ID
      ? (settings.customEngineUrl ?? "")
      : settings.enginePreset.urlTemplate;

  const applyEngine = (engineId: string) => {    if (engineId === CUSTOM_ENGINE_ID) {
      updateSettings({
        engineId: CUSTOM_ENGINE_ID,
        customEngineUrl: settings.customEngineUrl ?? "https://example.com/search?q={query}",
      });
      return;
    }
    const preset = ENGINE_PRESETS.find((entry) => entry.id === engineId);
    if (preset === undefined) return;
    updateSettings({ engineId: preset.id, enginePreset: preset });
  };

  const openAdd = () => {
    setEditing(null);
    setDraft({ name: "", domain: "", category: CATEGORIES[0], searchUrlTemplate: "" });
    setErrors({});
    setDialogOpen(true);
  };

  const openEdit = (source: SearchSource) => {
    setEditing(source);
    setDraft({
      name: source.name,
      domain: source.domain,
      category: source.category,
      searchUrlTemplate: source.searchUrlTemplate ?? "",
    });
    setErrors({});
    setDialogOpen(true);
  };

  const others = editing === null ? sources : sources.filter((entry) => entry.id !== editing.id);

  const saveDraft = () => {
    const result = validateSourceDraft(draft, others);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }

    const template = draft.searchUrlTemplate.trim();
    const fields = {
      name: draft.name.trim(),
      domain: normalizeDomain(draft.domain),
      url: `https://${normalizeDomain(draft.domain)}`,
      category: draft.category.trim(),
      searchUrlTemplate: template === "" ? undefined : template,
    };

    if (editing === null) {
      add({ ...fields, enabled: true });
    } else {
      update(editing.id, fields);
    }
    setDialogOpen(false);
  };

  const enableBraveProvider = async () => {
    setProviderError(null);
    try {
      await enableBrave(keyDraft);
      setHasKey(true);
      setPermission(true);
      setKeyDraft("");
    } catch (error) {
      setProviderError(error instanceof Error ? error.message : String(error));
    }
  };

  const forgetBrave = async () => {
    setProviderError(null);
    await disableBrave();
    setHasKey(false);
    setPermission(false);
    updateSettings({ providerId: "engine" });
  };

  const applyPreset = (presetId: string) => {
    const preset = PRESETS.find((entry) => entry.id === presetId);
    if (preset === undefined) return;
    commit(
      sources.map((source) => ({
        ...source,
        enabled: preset.domains.some((domain) => normalizeDomain(domain) === source.domain),
      })),
    );
  };

  const resetSources = () => {
    if (!window.confirm("Reset your source list to the default ten?")) return;
    commit(DEFAULT_SOURCES.map((entry) => ({ ...entry })));
  };

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.brandMark} aria-hidden="true">
          M
        </span>
        <h1 className={styles.brand}>MySearch Hub</h1>
      </header>
      <p className={styles.subtitle}>
        One query, only the sources you enable. Nothing searches the open web unless you pick a source.
      </p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Search engine</h2>
        <p className={styles.sectionHint}>
          Used to build every URL. The extension never searches on its own — it hands you a link.
        </p>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="engine-select">
            Engine
          </label>
          <select
            id="engine-select"
            className={styles.select}
            value={settings.engineId}
            onChange={(event) => applyEngine(event.target.value)}
          >
            {ENGINE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
            <option value={CUSTOM_ENGINE_ID}>Custom…</option>
          </select>
        </div>

        {settings.engineId === CUSTOM_ENGINE_ID ? (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="custom-engine">
              Custom search URL
            </label>
            <input
              id="custom-engine"
              className={styles.input}
              value={settings.customEngineUrl ?? ""}
              placeholder="https://example.com/search?q={query}"
              onChange={(event) => updateSettings({ customEngineUrl: event.target.value })}
            />
            <p className={styles.help}>Must include {`{query}`}.</p>
          </div>
        ) : null}

        <div className={styles.field}>
          <span className={styles.label}>Exact match</span>
          <div className={styles.checkboxRow}>
            <div className={styles.checkboxOption}>
              <Toggle
                checked={settings.exactMatch}
                label="Exact match"
                onChange={(next) => updateSettings({ exactMatch: next })}
              />
              <span>
                Wrap the query in quotes. Turn off for broader recall at the cost of looser matching.
              </span>
            </div>
          </div>
        </div>

        <p className={styles.help}>
          Current template: <code>{engineTemplate}</code>
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Search provider</h2>
        <p className={styles.sectionHint}>
          The engine provider needs no permissions. The API provider returns results in this page but
          requires your own key.
        </p>

        <div className={styles.radioRow}>
          <label className={styles.radioOption}>
            <input
              type="radio"
              name="provider"
              checked={settings.providerId === "engine"}
              onChange={() => updateSettings({ providerId: "engine" })}
            />
            <span className={styles.radioBody}>
              <span className={styles.label}>Search engine links</span>
              <span className={styles.help}>
                No permissions, no API key. Shows the built query and one button per source.
              </span>
            </span>
          </label>

          <label className={styles.radioOption}>
            <input
              type="radio"
              name="provider"
              checked={settings.providerId === "brave-api"}
              onChange={() => updateSettings({ providerId: "brave-api" })}
            />
            <span className={styles.radioBody}>
              <span className={styles.label}>Brave Search API</span>
              <span className={styles.help}>
                Results appear here, filtered to your enabled sources.
              </span>
            </span>
          </label>
        </div>

        {settings.providerId === "brave-api" ? (
          <>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="brave-key">
                Brave Search API key
              </label>
              <div className={styles.fieldRow}>
                <input
                  id="brave-key"
                  className={styles.input}
                  type="password"
                  value={keyDraft}
                  placeholder={hasKey ? "Saved — type a new key to replace it" : "Paste your key"}
                  autoComplete="off"
                  onChange={(event) => setKeyDraft(event.target.value)}
                />
                <button
                  type="button"
                  className="btn"
                  data-variant="primary"
                  onClick={() => void enableBraveProvider()}
                  disabled={keyDraft.trim() === ""}
                >
                  Save key
                </button>
                {hasKey ? (
                  <button
                    type="button"
                    className="btn"
                    data-variant="danger"
                    onClick={() => void forgetBrave()}
                  >
                    Forget key
                  </button>
                ) : null}
              </div>
              <p className={styles.help}>
                Permission to <code>api.search.brave.com</code>:{" "}
                {permission ? "granted" : "not granted yet"}. Saving a key asks for it.
              </p>
              {providerError === null ? null : (
                <p className={styles.error} role="alert">
                  {providerError}
                </p>
              )}
            </div>

            <p className={styles.privacyNote}>
              <ShieldIcon size={16} />
              <span>
                The key is stored in <code>chrome.storage.local</code> on this device only. It is never
                synced, never bundled with the extension, and removed the moment you forget it.
              </span>
            </p>
          </>
        ) : null}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Appearance</h2>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="theme">
            Theme
          </label>
          <select
            id="theme"
            className={styles.select}
            value={settings.theme}
            onChange={(event) => updateSettings({ theme: event.target.value as ThemePreference })}
          >
            <option value="system">Match system</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Presets</h2>
        <p className={styles.sectionHint}>Turn on a preset’s sources and turn off the rest.</p>
        <div className={styles.presetRow}>
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="btn"
              title={preset.description}
              onClick={() => applyPreset(preset.id)}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Preferred sources</h2>
        <div className={styles.filterRow}>
          <label className="visually-hidden" htmlFor="source-filter">
            Filter sources
          </label>
          <input
            id="source-filter"
            className={styles.input}
            type="search"
            placeholder="Filter sources…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <span className={styles.countNote}>
            {visible.length} of {sources.length}
          </span>
          <button type="button" className="btn" data-variant="primary" onClick={openAdd}>
            <PlusIcon />
            Add source
          </button>
        </div>

        <SourceList
          sources={visible}
          onToggle={toggle}
          onEdit={openEdit}
          onRemove={remove}
          onMove={(id, offset) => move(id, offset)}
        />
        <p className={styles.help}>
          Order here is the order of the buttons on the results page.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Recent searches</h2>
        <RecentSearches
          recent={recent}
          onRun={(query) => {
            void chrome.tabs.create({
              url: chrome.runtime.getURL(`results.html?q=${encodeURIComponent(query)}`),
            });
          }}
          onClear={clear}
          emptyHint="Nothing searched yet."
        />
      </section>

      <section className={`${styles.section} ${styles.dangerZone}`}>
        <h2 className={styles.sectionTitle}>Reset</h2>
        <p className={styles.sectionHint}>
          Restores the default ten sources and their enabled state. Your engine and theme are untouched.
        </p>
        <div className={styles.footer}>
          <button type="button" className="btn" onClick={resetSources}>
            Reset sources to defaults
          </button>
        </div>
      </section>

      <Dialog
        open={dialogOpen}
        title={editing === null ? "Add source" : `Edit ${editing.name}`}
        description="A source is a site MySearch Hub is allowed to search. Queries are always restricted to the sources you enable."
        onClose={() => setDialogOpen(false)}
        actions={
          <>
            <button type="button" className="btn" onClick={() => setDialogOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn" data-variant="primary" onClick={saveDraft}>
              {editing === null ? "Add source" : "Save"}
            </button>
          </>
        }
      >
        <div className={styles.dialogField}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="source-name">
              Name
            </label>
            <input
              id="source-name"
              className={styles.input}
              value={draft.name}
              aria-invalid={errors.name !== undefined}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
            {errors.name === undefined ? null : <p className={styles.error}>{errors.name}</p>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="source-domain">
              Domain
            </label>
            <input
              id="source-domain"
              className={styles.input}
              value={draft.domain}
              placeholder="example.com"
              aria-invalid={errors.domain !== undefined}
              onChange={(event) => setDraft({ ...draft, domain: event.target.value })}
            />
            {errors.domain === undefined ? null : <p className={styles.error}>{errors.domain}</p>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="source-category">
              Category
            </label>
            <input
              id="source-category"
              className={styles.input}
              list="source-categories"
              value={draft.category}
              onChange={(event) => setDraft({ ...draft, category: event.target.value })}
            />
            <datalist id="source-categories">
              {CATEGORIES.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
            {errors.category === undefined ? null : <p className={styles.error}>{errors.category}</p>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="source-template">
              Native search URL (optional)
            </label>
            <input
              id="source-template"
              className={styles.input}
              value={draft.searchUrlTemplate}
              placeholder="https://example.com/search?q={query}"
              aria-invalid={errors.searchUrlTemplate !== undefined}
              onChange={(event) => setDraft({ ...draft, searchUrlTemplate: event.target.value })}
            />
            <p className={styles.help}>
              When set, this source’s button uses the site’s own search instead of an engine{" "}
              <code>site:</code> query. Must be https and contain <code>{"{query}"}</code>.
            </p>
            {errors.searchUrlTemplate === undefined ? null : (
              <p className={styles.error}>{errors.searchUrlTemplate}</p>
            )}
          </div>
        </div>
      </Dialog>
    </main>
  );
}

const root = document.getElementById("root");
if (root !== null) {
  createRoot(root).render(<Settings />);
}
