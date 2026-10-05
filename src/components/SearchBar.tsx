import { useId } from "react";
import { SearchIcon } from "./icons";
import styles from "./components.module.css";

interface SearchBarProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: (value: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
  busy?: boolean;
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  autoFocus = false,
  placeholder = "Search your sources…",
  busy = false,
}: SearchBarProps) {
  const inputId = useId();

  return (
    <form
      className={styles.searchBar}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value);
      }}
      role="search"
    >
      <label className="visually-hidden" htmlFor={inputId}>
        Search query
      </label>
      <input
        id={inputId}
        className={styles.searchInput}
        type="search"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
      <button type="submit" className="btn" data-variant="primary" disabled={busy}>
        <SearchIcon />
        <span>Search</span>
      </button>
    </form>
  );
}
