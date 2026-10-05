import { SourceAvatar } from "./SourceAvatar";
import { Toggle } from "./Toggle";
import styles from "./components.module.css";
import type { SearchSource } from "../types";

interface SourceToggleListProps {
  sources: SearchSource[];
  onToggle: (id: string, enabled: boolean) => void;
  limit?: number;
}

/**
 * Compact rows of sources, each with a switch. Row order is the user's search
 * order so the popup mirrors what the results page will do.
 */
export function SourceToggleList({ sources, onToggle, limit }: SourceToggleListProps) {
  const visible = limit === undefined ? sources : sources.slice(0, limit);

  if (visible.length === 0) {
    return <p className={styles.sourceRowMeta}>No sources yet.</p>;
  }

  return (
    <ul className={styles.sourceList}>
      {visible.map((source) => (
        <li key={source.id} className={styles.sourceRow}>
          <SourceAvatar name={source.name} domain={source.domain} />
          <span className={styles.sourceRowBody}>
            <span className={styles.sourceRowName}>{source.name}</span>
            <span className={styles.sourceRowMeta}>{source.domain}</span>
          </span>
          <Toggle
            checked={source.enabled}
            label={`Search ${source.name}`}
            onChange={(next) => onToggle(source.id, next)}
          />
        </li>
      ))}
    </ul>
  );
}
