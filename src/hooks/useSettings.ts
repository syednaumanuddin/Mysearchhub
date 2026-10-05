import { useCallback, useEffect, useState } from "react";
import { getSettings, saveSettings, subscribe } from "../services/storage/StorageService";
import type { Settings } from "../types";

/**
 * Load settings and expose an updater.
 *
 * Writes go through the debounced storage layer, so toggling several switches
 * in a row costs one sync write instead of one per toggle.
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void getSettings().then((loaded) => {
      if (!active) return;
      setSettings(loaded);
      setLoading(false);
    });

    const unsubscribe = subscribe((changes) => {
      if (changes.settings) setSettings(changes.settings);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      if (current === null) return current;
      const next = { ...current, ...patch };
      void saveSettings(next);
      return next;
    });
  }, []);

  return { settings, loading, update };
}
