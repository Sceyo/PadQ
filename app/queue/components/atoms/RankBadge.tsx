import styles from './RankBadge.module.css';

interface Props {
  rank: 'Beginner' | 'Intermediate' | 'Advanced' | 'Pro';
}
export default function RankBadge({ rank }: Props) {
  return <span className={`${styles.badge} ${styles[rank.toLowerCase()]}`}>{rank}</span>;
}