import { relativeTime } from "../utils/format";
import { SearchIcon, TrashIcon } from "./icons";
import styles from "./components.module.css";
import type { RecentSearch } from "../types";

interface RecentSearchesProps {
  recent: RecentSearch[];
  onRun: (query: string) => void;
  onClear?: () => void;
  emptyHint?: string;
}

export function RecentSearches({ recent, onRun, onClear, emptyHint }: RecentSearchesProps) {
  if (recent.length === 0) {
    return emptyHint === undefined ? null : (
      <p className={styles.sourceRowMeta}>{emptyHint}</p>
    );
  }

  return (
    <div>
      <div className={styles.recentHeader}>
        <span className={styles.recentHeading}>Recent</span>
        {onClear === undefined ? null : (
          <button
            type="button"
            className="icon-btn"
            onClick={onClear}
            aria-label="Clear recent searches"
            title="Clear history"
          >
            <TrashIcon size={14} />
          </button>
        )}
      </div>
      <ul className={styles.recentList}>
        {recent.map((entry) => (
          <li key={entry.query.toLowerCase()}>
            <button type="button" className={styles.recentItem} onClick={() => onRun(entry.query)}>
              <SearchIcon size={13} />
              <span className={styles.recentQuery}>{entry.query}</span>
              <span className={styles.recentTime}>{relativeTime(entry.at)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
