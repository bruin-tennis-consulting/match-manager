import styles from '@/app/styles/Loading.module.css'

export default function Loading({ prompt }) {
  return (
    <div className={styles.loadingContainer}>
      <svg
        width="400"
        height="400"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="200"
          cy="200"
          r="100"
          stroke="#2774ae"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="628.32" /* Circumference of the circle */
          strokeDashoffset="628.32" /* Initially hidden */
          className={styles.animatedCircle}
        />
        <text x="200" y="350" className={styles.customText}>
          {prompt}
        </text>
      </svg>
    </div>
  )
}
