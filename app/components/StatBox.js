import styles from '@/app/styles/StatBox.module.css'

const StatBox = ({ stat, statNum }) => {
  return (
    <div className={styles.statContainer}>
      <div className={styles.infoContainer}>
        <p className={styles.stat}>{stat}</p>
        <p className={styles.statNum}>{statNum}</p>
      </div>
    </div>
  )
}

export default StatBox
