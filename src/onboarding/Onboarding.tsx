import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../styles/globals.css";
import styles from "./onboarding.module.css";
import { ShieldIcon } from "../components/icons";
import { useSources } from "../hooks/useSources";
import { useSettings } from "../hooks/useSettings";
import { useTheme } from "../hooks/useTheme";
import { getSettings, SYNC_KEY } from "../services/storage/StorageService";

interface OnboardingOption {
  id: string;
  name: string;
  hint: string;
  domains: string[];
}

const OPTIONS: OnboardingOption[] = [
  {
    id: "web-development",
    name: "Web development",
    hint: "Stack Overflow, GitHub, npm, MDN and DevDocs.",
    domains: ["stackoverflow.com", "github.com", "npmjs.com", "developer.mozilla.org", "devdocs.io"],
  },
  {
    id: "programming",
    name: "Programming",
    hint: "Q&A, code and package reference. No video, no social.",
    domains: ["stackoverflow.com", "github.com", "npmjs.com", "devdocs.io"],
  },
  {
    id: "video-learning",
    name: "Video learning",
    hint: "YouTube and Vimeo.",
    domains: ["youtube.com", "vimeo.com"],
  },
];

export function Onboarding() {
  const { sources, commit } = useSources();
  const { settings } = useSettings();
  const [selected, setSelected] = useState<string[]>([]);

  useTheme(settings?.theme ?? null);

  const options = OPTIONS;

  const toggleOption = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  };

  /** Write the chosen enabled set and mark onboarding done, then close the tab. */
  const finish = async () => {
    const chosen = options.filter((option) => selected.includes(option.id));
    const domains = new Set(chosen.flatMap((option) => option.domains));

    commit(
      sources.map((source) => ({ ...source, enabled: domains.has(source.domain) })),
    );

    const current = await getSettings();
    // Write straight through rather than through the debounced helper: this tab
    // closes immediately after, so a pending write would be lost.
    await chrome.storage.sync.set({
      [SYNC_KEY.settings]: { ...current, onboardingCompleted: true },
    });

    window.close();
  };

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            M
          </span>
          <span className={styles.brandName}>MySearch Hub</span>
        </span>
        <h1 className={styles.title}>Search the sources you trust. Nothing else.</h1>
        <p className={styles.lede}>
          Most search extensions send your query somewhere and hand back whatever comes back.
          MySearch Hub does the opposite: you pick the sites, and it refuses to search anywhere you
          have not picked.
        </p>
      </header>

      <div className={styles.guarantee}>
        <ShieldIcon size={20} />
        <div>
          <p className={styles.guaranteeTitle}>The one rule</p>
          <p className={styles.guaranteeBody}>
            Every query is wrapped in a <code>site:</code> filter for the sources you enabled. There
            is no setting, no flag and no code path that runs a bare web search. Disable every source
            and the extension tells you it cannot search instead of quietly widening the net.
          </p>
        </div>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Start from a preset</h2>
        <p className={styles.sectionHint}>
          Optional. Pick one or more, then change anything later in settings.
        </p>

        <div className={styles.optionList}>
          {options.map((option) => (
            <label key={option.id} className={styles.option}>
              <input
                type="checkbox"
                checked={selected.includes(option.id)}
                onChange={() => toggleOption(option.id)}
              />
              <span className={styles.optionBody}>
                <span className={styles.optionName}>{option.name}</span>
                <span className={styles.optionHint}>{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <button
          type="button"
          className="btn"
          onClick={() => {
            window.close();
          }}
        >
          Skip
        </button>
        <button type="button" className="btn" data-variant="primary" onClick={() => void finish()}>
          Continue
        </button>
      </footer>
    </main>
  );
}

const root = document.getElementById("root");
if (root !== null) {
  createRoot(root).render(<Onboarding />);
}
