import styles from '@/app/styles/Loading.module.css'

export default function Loading() {
  return (
    <div className={styles.loadingContainer}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid"
        className={styles.spinner}
      >
        <g>
          <path
            stroke="none"
            fill="#2774ae"
            d="M10 50A40 40 0 0 0 90 50A40 41.4 0 0 1 10 50"
          >
            <animateTransform
              values="0 50 50.7;360 50 50.7"
              keyTimes="0;1"
              repeatCount="indefinite"
              dur="1s"
              type="rotate"
              attributeName="transform"
            />
          </path>
        </g>
      </svg>
    </div>
  )
}
