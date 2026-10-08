import { Icon } from "../Icon/Icon";
import styles from "./GetStartedCard.module.css";

export interface GetStartedCardProps {
  label: string;
  /** Illustration URL, e.g. /illustrations/get-started-new-group.svg */
  image?: string;
  onClick?: () => void;
  /** false hides the dismiss button. */
  onDismiss?: (() => void) | false;
}

export function GetStartedCard({ label, image, onClick, onDismiss }: GetStartedCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.art}>
        {/* eslint-disable-next-line @next/next/no-img-element -- small static SVG illustrations */}
        {image ? <img src={image} alt="" /> : null}
      </div>
      {onDismiss !== false ? (
        <button type="button" className={styles.dismiss} aria-label={`Dismiss ${label}`} onClick={onDismiss || undefined}>
          <Icon name="close" size={12} strokeWidth={2.4} />
        </button>
      ) : null}
      <button type="button" className={styles.pill} onClick={onClick}>
        {label}
      </button>
    </div>
  );
}
