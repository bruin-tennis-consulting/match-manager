import React, { useEffect, useState } from 'react'

import styles from '@/app/styles/ExtendedList.module.css'
import getTeams from '@/app/services/getTeams.js'

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
  const [clientLogo, setClientLogo] = useState('')
  const [opponentLogo, setOpponentLogo] = useState('')

  useEffect(() => {
    const fetchLogos = async () => {
      try {
        const allTeams = await getTeams()
        console.log(allTeams)
        const clientLogoURL = allTeams.find(
          (team) => team.name === clientTeam
        ).logoUrl
        const opponentLogoURL = allTeams.find(
          (team) => team.name === opponentTeam
        ).logoUrl
        setClientLogo(clientLogoURL)
        setOpponentLogo(opponentLogoURL)
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }

    fetchLogos()
  })
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
    // useref
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
                    <img
                      src={
                        item.player1Name === item.serverName
                          ? clientLogo
                          : opponentLogo
                      }
                      className={styles.IMG}
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {cellIndex === keys.length - 2 ? (
                        <>
                          {item.lastShotResult === 'Winner' && <Winner />}
                          {item.lastShotResult === 'Error' && <Error />}
                          {item.lastShotResult === 'DoubleFault' && (
                            <DoubleFault />
                          )}
                          <span style={{ marginLeft: '4px' }}>
                            {item.lastShotResult}
                          </span>
                        </>
                      ) : (
                        item[key]
                      )}
                    </div>
                  )}
                </td>
              ))}

              <td className={styles.TD2}>
                <button className={styles.button} onClick={() => Scroll(item)}>
                  <PlayButton />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default ExtendedList
