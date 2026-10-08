import clsx from "clsx";
import type { ReactNode } from "react";
import styles from "./Tooltip.module.css";

export interface TooltipProps {
  label: string;
  placement?: "top" | "bottom" | "right";
  children: ReactNode;
  className?: string;
}

/** Hover/focus tooltip (CSS only). Decorative: keep an aria-label on the wrapped control. */
export function Tooltip({ label, placement = "top", children, className }: TooltipProps) {
  return (
    <span className={clsx(styles.wrap, className)}>
      {children}
      <span className={clsx(styles.tip, styles[placement])} aria-hidden>
        {label}
      </span>
    </span>
  );
}
