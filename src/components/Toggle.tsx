import styles from "./components.module.css";

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}

/** Accessible switch. Native `<button role="switch">` keeps space/enter working. */
export function Toggle({ checked, onChange, label, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={styles.toggle}
      data-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}
