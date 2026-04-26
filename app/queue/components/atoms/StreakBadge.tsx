import styles from './StreakBadge.module.css';
export default function StreakBadge({ value }: { value: number }) {
  const label = value > 0 ? `🔥 ${value}` : value < 0 ? `❄️ ${Math.abs(value)}` : '—';
  return <span className={styles.streak}>{label}</span>;
}