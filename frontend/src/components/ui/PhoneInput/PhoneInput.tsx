"use client";

import clsx from "clsx";
import { useId, type Ref } from "react";
import { Icon } from "../Icon/Icon";
import fieldStyles from "../TextField/TextField.module.css";
import styles from "./PhoneInput.module.css";

export interface Country {
  iso: string;
  name: string;
  dial: string;
}

export const COUNTRIES: Country[] = [
  { iso: "US", name: "United States", dial: "+1" },
  { iso: "IN", name: "India", dial: "+91" },
  { iso: "GB", name: "United Kingdom", dial: "+44" },
  { iso: "DE", name: "Germany", dial: "+49" },
  { iso: "FR", name: "France", dial: "+33" },
  { iso: "BR", name: "Brazil", dial: "+55" },
  { iso: "AU", name: "Australia", dial: "+61" },
  { iso: "JP", name: "Japan", dial: "+81" },
  { iso: "SG", name: "Singapore", dial: "+65" },
  { iso: "AE", name: "United Arab Emirates", dial: "+971" },
];

/** "+1" + "(555) 000-0001" → "+15550000001" */
export function toE164(dial: string, national: string) {
  return `${dial}${national.replace(/\D/g, "")}`;
}

export interface PhoneInputProps {
  label?: string;
  /** ISO country (e.g. "US"). */
  country: string;
  onCountryChange: (iso: string) => void;
  /** National number as typed. */
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  countries?: Country[];
  inputRef?: Ref<HTMLInputElement>;
  onEnter?: () => void;
}

export function PhoneInput({
  label = "Phone number",
  country,
  onCountryChange,
  value,
  onChange,
  error,
  hint,
  autoFocus,
  disabled,
  countries = COUNTRIES,
  inputRef,
  onEnter,
}: PhoneInputProps) {
  const id = useId();
  const current = countries.find((c) => c.iso === country) ?? countries[0];
  return (
    <div className={fieldStyles.wrap}>
      <label htmlFor={id} className={fieldStyles.label}>
        {label}
      </label>
      <div className={clsx(fieldStyles.field, error && fieldStyles.invalid)}>
        <span className={styles.code}>
          <span aria-hidden>{current.dial}</span>
          <Icon name="chevron-down" size={14} strokeWidth={2} />
          <select
            className={styles.select}
            aria-label="Country code"
            value={current.iso}
            disabled={disabled}
            onChange={(e) => onCountryChange(e.target.value)}
          >
            {countries.map((c) => (
              <option key={c.iso} value={c.iso}>
                {c.name} ({c.dial})
              </option>
            ))}
          </select>
        </span>
        <input
          ref={inputRef}
          id={id}
          className={fieldStyles.input}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="Phone number"
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value.replace(/[^\d\s()-]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEnter?.();
          }}
        />
      </div>
      {error ? (
        <p className={fieldStyles.error} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className={fieldStyles.hint}>{hint}</p>
      ) : null}
    </div>
  );
}
