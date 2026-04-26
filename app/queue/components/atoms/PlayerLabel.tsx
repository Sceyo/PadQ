import styles from './PlayerLabel.module.css';
interface Props { name: string; isActive?: boolean }
export default function PlayerLabel({ name, isActive }: Props) {
  return (
    <span className={`${styles.label} ${isActive ? styles.active : ''}`}>
      {name}
    </span>
  );
}