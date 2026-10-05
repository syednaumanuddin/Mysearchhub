import { useCallback, useEffect, useState } from "react";
import {
  addRecentSearch,
  getRecentSearches,
  saveRecentSearches,
  subscribe,
} from "../services/storage/StorageService";
import type { RecentSearch } from "../types";

/**
 * Recent-search history: MRU order, case-insensitive dedupe, capped at 15.
 *
 * The pure reordering rules live in `addRecentSearch` so they can be tested
 * without React.
 */
export function useRecentSearches() {
  const [recent, setRecent] = useState<RecentSearch[]>([]);

  useEffect(() => {
    let active = true;

    void getRecentSearches().then((loaded) => {
      if (active) setRecent(loaded);
    });

    const unsubscribe = subscribe((changes) => {
      if (changes.recentSearches) setRecent(changes.recentSearches);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const add = useCallback((query: string) => {
    setRecent((current) => {
      const next = addRecentSearch(current, query);
      if (next !== current) void saveRecentSearches(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setRecent((current) => {
      if (current.length === 0) return current;
      void saveRecentSearches([]);
      return [];
    });
  }, []);

  return { recent, add, clear };
}
