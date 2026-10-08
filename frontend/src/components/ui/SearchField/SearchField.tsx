import clsx from "clsx";
import type { ChangeEvent, InputHTMLAttributes, Ref } from "react";
import { Icon } from "../Icon/Icon";
import styles from "./SearchField.module.css";

export interface SearchFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "className"> {
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  /** Shows a clear button when there is text; called on click. */
  onClear?: () => void;
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
}

export function SearchField({
  placeholder = "Search",
  onClear,
  inputRef,
  className,
  value,
  ...rest
}: SearchFieldProps) {
  return (
    <label className={clsx(styles.search, className)}>
      <Icon name="search" size={18} />
      <input
        ref={inputRef}
        type="search"
        placeholder={placeholder}
        aria-label={placeholder}
        value={value}
        className={styles.input}
        {...rest}
      />
      {onClear && value ? (
        <button type="button" className={styles.clear} aria-label="Clear search" onClick={onClear}>
          <Icon name="close" size={12} strokeWidth={2.4} />
        </button>
      ) : null}
    </label>
  );
}
