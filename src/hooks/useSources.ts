import { useCallback, useEffect, useState } from "react";
import { getSources, saveSources, subscribe } from "../services/storage/StorageService";
import type { SearchSource } from "../types";

/**
 * Load the source list and expose mutations.
 *
 * Every mutation keeps array position as the user's order and writes through
 * the debounced storage layer. `subscribe` keeps the popup, results page and
 * settings page in sync live, including changes made in another window.
 */
export function useSources() {
  const [sources, setSources] = useState<SearchSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void getSources().then((loaded) => {
      if (!active) return;
      setSources(loaded);
      setLoading(false);
    });

    const unsubscribe = subscribe((changes) => {
      if (changes.sources) setSources(changes.sources);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const commit = useCallback((next: SearchSource[]) => {
    setSources(next);
    void saveSources(next);
  }, []);

  const toggle = useCallback(
    (id: string, enabled?: boolean) => {
      setSources((current) => {
        const next = current.map((source) =>
          source.id === id ? { ...source, enabled: enabled ?? !source.enabled } : source,
        );
        void saveSources(next);
        return next;
      });
    },
    [],
  );

  const add = useCallback(
    (draft: Omit<SearchSource, "id"> & { id?: string }) => {
      setSources((current) => {
        const id = draft.id ?? `${draft.domain}-${current.length}-${Date.now()}`;
        const next = [...current, { ...draft, id }];
        void saveSources(next);
        return next;
      });
    },
    [],
  );

  const update = useCallback((id: string, patch: Partial<SearchSource>) => {
    setSources((current) => {
      const next = current.map((source) => (source.id === id ? { ...source, ...patch } : source));
      void saveSources(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setSources((current) => {
      const next = current.filter((source) => source.id !== id);
      void saveSources(next);
      return next;
    });
  }, []);

  const move = useCallback((id: string, offset: number) => {
    setSources((current) => {
      const from = current.findIndex((source) => source.id === id);
      if (from === -1) return current;
      const to = from + offset;
      if (to < 0 || to >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      if (moved === undefined) return current;
      next.splice(to, 0, moved);
      void saveSources(next);
      return next;
    });
  }, []);

  const moveTo = useCallback((id: string, index: number) => {
    setSources((current) => {
      const from = current.findIndex((source) => source.id === id);
      if (from === -1) return current;
      const to = Math.max(0, Math.min(index, current.length - 1));
      if (to === from) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      if (moved === undefined) return current;
      next.splice(to, 0, moved);
      void saveSources(next);
      return next;
    });
  }, []);

  return { sources, loading, toggle, add, update, remove, move, moveTo, commit };
}
