import clsx from "clsx";
import styles from "./DeliveryStatus.module.css";

export type MessageStatus = "sending" | "sent" | "delivered" | "read";

export interface DeliveryStatusProps {
  status: MessageStatus;
  className?: string;
}

/** Figma receipt geometry: two 13px discs offset by 6px (19×13). */
const CHECK = "M3.5 6.5l2 2 4-4.2";
const BG = "var(--sg-status-bg, var(--surface-pane))";

function Ring({ x, filled }: { x: number; filled?: boolean }) {
  return (
    <circle
      cx={x}
      cy={6.5}
      r={filled ? 6.5 : 5.9}
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={1.2}
    />
  );
}

function Check({ dx, ink }: { dx: number; ink: string }) {
  return (
    <path
      d={CHECK}
      transform={`translate(${dx} 0)`}
      fill="none"
      stroke={ink}
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

const LABELS: Record<MessageStatus, string> = {
  sending: "Sending",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
};

export function DeliveryStatus({ status, className }: DeliveryStatusProps) {
  const w = status === "sending" || status === "sent" ? 13 : 19;
  return (
    <svg
      className={clsx(styles.status, status === "sending" && styles.sending, className)}
      width={w}
      height={13}
      viewBox={`0 0 ${w} 13`}
      role="img"
      aria-label={LABELS[status]}
    >
      {status === "sending" && (
        <circle cx={6.5} cy={6.5} r={5.9} fill="none" stroke="currentColor" strokeWidth={1.2} strokeDasharray="2 2" />
      )}
      {status === "sent" && (
        <>
          <Ring x={6.5} />
          <Check dx={0} ink="currentColor" />
        </>
      )}
      {status === "delivered" && (
        <>
          <Ring x={6.5} />
          <Check dx={0} ink="currentColor" />
          <circle cx={12.5} cy={6.5} r={7} fill={BG} />
          <Ring x={12.5} />
          <Check dx={6} ink="currentColor" />
        </>
      )}
      {status === "read" && (
        <>
          <Ring x={6.5} filled />
          <Check dx={0} ink={BG} />
          <circle cx={12.5} cy={6.5} r={7.5} fill={BG} />
          <Ring x={12.5} filled />
          <Check dx={6} ink={BG} />
        </>
      )}
    </svg>
  );
}
