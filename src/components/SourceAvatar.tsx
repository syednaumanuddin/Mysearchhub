import type { CSSProperties } from "react";
import { monogram } from "../utils/domain";
import styles from "./components.module.css";

const HUES = [214, 262, 340, 8, 30, 150, 188, 284, 96, 316];

function hueFor(domain: string): number {
  let hash = 0;
  for (let index = 0; index < domain.length; index += 1) {
    hash = (hash * 31 + domain.charCodeAt(index)) >>> 0;
  }
  return HUES[hash % HUES.length] ?? 214;
}

interface SourceAvatarProps {
  name: string;
  domain: string;
  size?: number;
}

/**
 * Letter monogram derived from the domain.
 *
 * Deliberately not a favicon: fetching favicons would need a host permission
 * for every source the user might add, which would break the extension's
 * minimal-permission promise.
 */
export function SourceAvatar({ name, domain, size = 28 }: SourceAvatarProps) {
  return (
    <span
      className={styles.avatar}
      style={
        {
          "--avatar-hue": hueFor(domain),
          "--avatar-size": `${size}px`,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {monogram(name)}
    </span>
  );
}
