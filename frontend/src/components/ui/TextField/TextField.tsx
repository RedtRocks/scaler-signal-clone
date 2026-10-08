"use client";

import clsx from "clsx";
import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import styles from "./TextField.module.css";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  /** Error message; also marks the input invalid. */
  error?: string;
  hint?: ReactNode;
  /** Element inside the field's right edge (e.g. a character counter). */
  trailing?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export function TextField({ label, error, hint, trailing, id, className, ref, ...rest }: TextFieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const msgId = `${inputId}-msg`;
  return (
    <div className={clsx(styles.wrap, className)}>
      {label ? (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      ) : null}
      <div className={clsx(styles.field, error && styles.invalid)}>
        <input
          ref={ref}
          id={inputId}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? msgId : undefined}
          {...rest}
        />
        {trailing ? <span className={styles.trailing}>{trailing}</span> : null}
      </div>
      {error ? (
        <p id={msgId} className={styles.error} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
