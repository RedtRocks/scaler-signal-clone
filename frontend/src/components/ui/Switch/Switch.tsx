import clsx from "clsx";
import styles from "./Switch.module.css";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name (or wrap with a visible label via aria-labelledby). */
  label?: string;
  "aria-labelledby"?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, disabled, ...rest }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={rest["aria-labelledby"]}
      disabled={disabled}
      className={clsx(styles.switch, checked && styles.on)}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.thumb} />
    </button>
  );
}
