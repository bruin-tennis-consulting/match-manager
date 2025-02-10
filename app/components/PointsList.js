import React, { useState, useEffect } from 'react'
import styles from '@/app/styles/PointsList.module.css'
import getTeams from '@/app/services/getTeams.js'
import Image from 'next/image'

const PointsList = ({
  pointsData,
  onBookmark,
  onPointSelect,
  clientTeam,
  opponentTeam
}) => {
  const [clientLogo, setClientLogo] = useState('')
  const [opponentLogo, setOpponentLogo] = useState('')

  useEffect(() => {
    const fetchLogos = async () => {
      try {
        const allTeams = await getTeams()
        const clientLogoURL =
          allTeams.find((team) => team.name === clientTeam)?.logoUrl || ''
        const opponentLogoURL =
          allTeams.find((team) => team.name === opponentTeam)?.logoUrl || ''
        setClientLogo(clientLogoURL)
        setOpponentLogo(opponentLogoURL)
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }

    fetchLogos()
  }, [clientTeam, opponentTeam])

  return (
    <div className={styles.pointsContainer}>
      <table className={styles.pointsList}>
        <thead>
          <tr>
            <th>Server</th>
            <th>Set</th>
            <th>Game</th>
            <th>Point</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {pointsData.map((point, index) => (
            <tr
              className={styles.pointsListItem}
              key={index}
              onClick={() => onPointSelect(point.Position)}
              style={{ cursor: 'pointer' }}
            >
              <td>
                <div className={styles.imgcontainer}>
                  <div className={styles.playerSchoolImg}>
                    <Image
                      src={
                        point.serverName === point.player1Name
                          ? clientLogo
                          : opponentLogo
                      }
                      alt={
                        point.serverName === point.player1Name
                          ? `${clientTeam} logo`
                          : `${opponentTeam} logo`
                      }
                      className={styles.IMG}
                      width={50} // Adjust size as needed
                      height={50}
                      layout="intrinsic"
                    />
                  </div>
                </div>
              </td>
              <td>
                <b style={{ fontSize: '1em' }}>{point.setNum}</b>
              </td>
              <td>
                <b style={{ fontSize: '1em' }}>{point.gameScore}</b>
              </td>
              <td>
                <b
                  style={{
                    fontSize: '1em',
                    whiteSpace: 'nowrap',
                    width: '20%'
                  }}
                >
                  {point.pointScore}
                </b>
              </td>
              <td
                onClick={(e) => {
                  e.stopPropagation()
                  onBookmark(point)
                }}
              >
                {Object.prototype.hasOwnProperty.call(point, 'bookmarked') &&
                point.bookmarked ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="24"
                    height="24"
                  >
                    <path
                      d="M6 2c-1.1 0-2 .9-2 2v16c0 .55.45 1 1 1 .17 0 .34-.05.5-.15L12 17.7l6.5 3.15c.16.1.33.15.5.15.55 0 1-.45 1-1V4c0-1.1-.9-2-2-2H6z"
                      fill="#000000"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="24"
                    height="24"
                  >
                    <path d="M6 2c-1.1 0-2 .9-2 2v16c0 .55.45 1 1 1 .17 0 .34-.05.5-.15L12 17.7l6.5 3.15c.16.1.33.15.5.15.55 0 1-.45 1-1V4c0-1.1-.9-2-2-2H6zm0 2h12v13.15l-5.5-2.65a1 1 0 0 0-.99 0L6 17.15V4z" />
                  </svg>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default PointsList
