import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import styles from "./components.module.css";

interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}

/**
 * Modal built on the native `<dialog>` element.
 *
 * Using the platform primitive means focus trapping, `Esc` to dismiss, inert
 * background content and focus restoration are handled by the browser rather
 * than reimplemented.
 */
export function Dialog({ open, title, description, onClose, children, actions }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <h2 id={titleId} className={styles.dialogTitle}>
        {title}
      </h2>
      {description === undefined ? null : (
        <p className={styles.dialogDescription}>{description}</p>
      )}
      {children}
      {actions === undefined ? null : <div className={styles.dialogActions}>{actions}</div>}
    </dialog>
  );
}
