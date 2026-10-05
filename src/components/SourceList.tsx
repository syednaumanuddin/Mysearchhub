import { SourceAvatar } from "./SourceAvatar";
import { Toggle } from "./Toggle";
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, TrashIcon } from "./icons";
import styles from "./components.module.css";
import type { SearchSource } from "../types";

interface SourceListProps {
  sources: SearchSource[];
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (source: SearchSource) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, offset: number) => void;
}

/**
 * Full management list for settings: reorder, edit, remove, enable.
 *
 * Row order is the user's search order, so reordering here changes the order
 * of the per-source buttons and results on the search page.
 */
export function SourceList({ sources, onToggle, onEdit, onRemove, onMove }: SourceListProps) {
  if (sources.length === 0) {
    return <p className={styles.sourceRowMeta}>No sources match this filter.</p>;
  }

  return (
    <ul className={styles.sourceList}>
      {sources.map((source, index) => (
        <li key={source.id} className={styles.sourceRow}>
          <SourceAvatar name={source.name} domain={source.domain} />
          <span className={styles.sourceRowBody}>
            <span className={styles.sourceRowName}>{source.name}</span>
            <span className={styles.sourceRowMeta}>
              {source.domain} · {source.category}
              {source.searchUrlTemplate === undefined ? "" : " · native search"}
            </span>
          </span>
          <Toggle
            checked={source.enabled}
            label={`Search ${source.name}`}
            onChange={(next) => onToggle(source.id, next)}
          />
          <span className={styles.sourceRowActions}>
            <button
              type="button"
              className="icon-btn"
              onClick={() => onMove(source.id, -1)}
              disabled={index === 0}
              aria-label={`Move ${source.name} up`}
            >
              <ArrowUpIcon />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => onMove(source.id, 1)}
              disabled={index === sources.length - 1}
              aria-label={`Move ${source.name} down`}
            >
              <ArrowDownIcon />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => onEdit(source)}
              aria-label={`Edit ${source.name}`}
            >
              <PencilIcon />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => onRemove(source.id)}
              aria-label={`Remove ${source.name}`}
            >
              <TrashIcon />
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}
