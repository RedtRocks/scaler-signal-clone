"use client";

import { useId } from "react";
import styles from "./RadioGroup.module.css";

export interface RadioOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

export interface RadioGroupProps<T extends string> {
  /** Visible group label (legend). */
  label?: string;
  value: T;
  options: RadioOption<T>[];
  onChange: (value: T) => void;
  name?: string;
}

/** Settings radio list, e.g. Theme: System / Light / Dark. */
export function RadioGroup<T extends string>({ label, value, options, onChange, name }: RadioGroupProps<T>) {
  const auto = useId();
  const groupName = name ?? auto;
  return (
    <fieldset className={styles.group}>
      {label ? <legend className={styles.legend}>{label}</legend> : null}
      {options.map((o) => (
        <label key={o.value} className={styles.option}>
          <input
            type="radio"
            className={styles.input}
            name={groupName}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          <span className={styles.dot} aria-hidden />
          <span className={styles.text}>
            <span className={styles.label}>{o.label}</span>
            {o.description ? <span className={styles.desc}>{o.description}</span> : null}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
