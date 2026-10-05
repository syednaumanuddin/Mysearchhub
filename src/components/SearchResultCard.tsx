import { SourceAvatar } from "./SourceAvatar";
import styles from "./components.module.css";
import type { SearchResult, SearchSource } from "../types";

interface SearchResultCardProps {
  result: SearchResult;
  source?: SearchSource | undefined;
}

/** One result. Links out; the snippet and owning source are shown inline. */
export function SearchResultCard({ result, source }: SearchResultCardProps) {
  return (
    <a className={styles.resultCard} href={result.url} target="_blank" rel="noreferrer noopener">
      <span className={styles.resultTitle}>{result.title}</span>
      <span className={styles.resultDomain}>
        {source === undefined ? result.domain : `${result.domain} · ${source.name}`}
      </span>
      {result.snippet === "" ? null : <span className={styles.resultSnippet}>{result.snippet}</span>}
    </a>
  );
}

interface SearchResultListProps {
  results: SearchResult[];
  sources: SearchSource[];
}

export function SearchResultList({ results, sources }: SearchResultListProps) {
  const byId = new Map(sources.map((source) => [source.id, source]));
  return (
    <div className={styles.resultList}>
      {results.map((result) => (
        <SearchResultCard
          key={result.url}
          result={result}
          source={result.sourceId === null ? undefined : byId.get(result.sourceId)}
        />
      ))}
    </div>
  );
}

export function ResultSourceBadge({ source }: { source: SearchSource }) {
  return (
    <span className="chip">
      <SourceAvatar name={source.name} domain={source.domain} size={18} />
      {source.name}
    </span>
  );
}
