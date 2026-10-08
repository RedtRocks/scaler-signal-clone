import clsx from "clsx";
import styles from "./Spinner.module.css";

export interface SpinnerProps {
  size?: number;
  label?: string;
  /** Inherit the text colour instead of ultramarine (e.g. inside a primary button). */
  inherit?: boolean;
}

export function Spinner({ size = 24, label = "Loading", inherit }: SpinnerProps) {
  return (
    <svg
      className={clsx(styles.spinner, inherit && styles.inherit)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="status"
      aria-label={label}
    >
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.2" />
      <path d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
