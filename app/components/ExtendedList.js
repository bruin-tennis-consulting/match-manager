import React from 'react'
import Image from 'next/image'
import styles from '@/app/styles/ExtendedList.module.css'
import { useTeamLogos } from '@/app/hooks/useTeamLogos'
import Winner from '@/public/Winner.js'
import Error from '@/public/Error.js'
import DoubleFault from '@/public/DoubleFault'
import PlayButton from '@/public/PlayButton'

const ExtendedList = ({
  pointsData,
  clientTeam,
  opponentTeam,
  onPointSelect,
  iframe
}) => {
  const { clientLogo, opponentLogo, loading } = useTeamLogos(
    clientTeam,
    opponentTeam
  )

  if (loading) {
    return <div>Loading logos...</div>
  }

  const keys = [
    '',
    'serverName',
    'setScore',
    'gameScore',
    'pointScore',
    'pointWonBy',
    'lastShotResult',
    'rallyCount'
  ]
  const keysHeaders = [
    'Server',
    '',
    'Set Score',
    'Game Score',
    'Point',
    'Point Winner',
    'Last Shot Type',
    'Shot Count',
    ''
  ]

  const Scroll = (point) => {
    onPointSelect(point.Position)
    if (iframe.current) {
      iframe.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div id="table-container" className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr className={styles.TR}>
            {keysHeaders.map((key, index) => (
              <th className={styles.TH} key={index}>
                {key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pointsData.map((item, rowIndex) => (
            <tr className={styles.TR} key={rowIndex}>
              {keys.map((key, cellIndex) => (
                <td className={styles.TD} key={cellIndex}>
                  {cellIndex === 0 ? (
                    <div className={styles.playerSchoolImg}>
                      <Image
                        src={
                          item.player1Name === item.serverName
                            ? clientLogo || '/images/default-logo.svg'
                            : opponentLogo || '/images/default-logo.svg'
                        }
                        alt={
                          item.player1Name === item.serverName
                            ? `${clientTeam} logo`
                            : `${opponentTeam} logo`
                        }
                        className={styles.IMG}
                        width={30}
                        height={30}
                        onError={(e) => {
                          if (e.target.src !== '/images/default-logo.svg') {
                            e.target.src = '/images/default-logo.svg'
                          } else {
                            e.target.style.display = 'none'
                          }
                        }}
                      />
                    </div>
                  ) : cellIndex === 1 ? (
                    <div className={styles.serverIcon}>
                      {item.serverName === item.player1Name ? (
                        <PlayButton />
                      ) : (
                        <PlayButton />
                      )}
                    </div>
                  ) : cellIndex === 5 ? (
                    <div className={styles.winnerIcon}>
                      {item.pointWonBy === item.player1Name ? (
                        <Winner />
                      ) : (
                        <Winner />
                      )}
                    </div>
                  ) : cellIndex === 6 ? (
                    <div className={styles.errorIcon}>
                      {item.lastShotResult === 'Error' ? (
                        <Error />
                      ) : item.lastShotResult === 'Double Fault' ? (
                        <DoubleFault />
                      ) : null}
                    </div>
                  ) : cellIndex === 7 ? (
                    <div className={styles.rallyCount}>{item.rallyCount}</div>
                  ) : cellIndex === 8 ? (
                    <button
                      className={styles.scrollButton}
                      onClick={() => Scroll(item)}
                    >
                      Go to Point
                    </button>
                  ) : (
                    item[key]
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default ExtendedList
