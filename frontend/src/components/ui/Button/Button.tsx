import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "../Icon/Icon";
import styles from "./Button.module.css";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: "primary" | "secondary" | "destructive" | "link" | "icon";
  /** Icon for `variant="icon"` (also shown before the label on other variants). */
  icon?: IconName;
  iconSize?: number;
  /** Stretch to the container width (onboarding screens). */
  block?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = "primary",
  icon,
  iconSize,
  block,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  if (variant === "icon") {
    return (
      <button type={type} {...rest} className={clsx(styles.iconbtn, className)}>
        {icon ? <Icon name={icon} size={iconSize ?? 24} /> : children}
      </button>
    );
  }
  return (
    <button
      type={type}
      {...rest}
      className={clsx(styles.btn, styles[variant], block && styles.block, className)}
    >
      {icon ? <Icon name={icon} size={iconSize ?? 18} /> : null}
      {children}
    </button>
  );
}
