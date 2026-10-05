import { useEffect, useState } from "react";
import type { ResolvedTheme, ThemePreference } from "../types";

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(preference: ThemePreference): ResolvedTheme {
  const resolved: ResolvedTheme = preference === "system" ? systemTheme() : preference;
  document.documentElement.dataset.theme = resolved;
  return resolved;
}

/**
 * Resolve the theme preference onto `<html data-theme>`.
 *
 * `system` follows the OS live; an explicit choice pins the value and stops
 * following it, which is why the attribute always carries a resolved theme
 * rather than "system".
 */
export function useTheme(preference: ThemePreference | null) {
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  useEffect(() => {
    if (preference === null) return;

    setResolved(apply(preference));

    if (preference !== "system" || typeof window.matchMedia !== "function") return;

    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(apply("system"));
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  return resolved;
}
