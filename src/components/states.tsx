import type { ReactNode } from "react";
import styles from "./components.module.css";

interface StateProps {
  title: string;
  body?: string;
  children?: ReactNode;
  tone?: "neutral" | "error";
}

function State({ title, body, children, tone = "neutral" }: StateProps) {
  return (
    <div className={styles.state} data-tone={tone} role={tone === "error" ? "alert" : undefined}>
      <p className={styles.stateTitle}>{title}</p>
      {body === undefined ? null : <p className={styles.stateBody}>{body}</p>}
      {children}
    </div>
  );
}

/** Nothing typed yet. */
export function EmptyState(props: Partial<StateProps>) {
  return (
    <State
      title="What are you looking for?"
      body="Type a query and MySearch Hub will search only the sources you enabled."
      {...props}
    />
  );
}

/** No source is enabled, so there is nothing to search. */
export function NoSourcesState(props: Partial<StateProps>) {
  return (
    <State
      title="No sources enabled"
      body="MySearch Hub only searches the sources you turn on. Enable at least one to start searching."
      {...props}
    />
  );
}

/** Query produced nothing on the enabled sources. */
export function NoResultsState(props: Partial<StateProps>) {
  return (
    <State
      title="No results on your sources"
      body="Nothing on the enabled sources matched. Try fewer words, or turn exact match off in settings."
      {...props}
    />
  );
}

export function ErrorState({ title = "Something went wrong", ...props }: StateProps) {
  return <State title={title} tone="error" {...props} />;
}

export function LoadingState({ label = "Searching your sources…" }: { label?: string }) {
  return (
    <div className={styles.state}>
      <span className={styles.spinner} aria-hidden="true" />
      <p className={styles.stateBody} role="status">
        {label}
      </p>
    </div>
  );
}
