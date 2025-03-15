'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

import { useData } from '@/app/DataProvider'
import {
  getSimpleTaggerButtonData,
  simpleColumnNames,
  columnNames
} from '@/app/services/taggerButtonData.js' // change this since our columnNames are not the same

import VideoPlayer from '@/app/components/VideoPlayer'
import { validateTable } from '@/app/services/taggingValidator'

import styles from '@/app/styles/TagMatch.module.css'

export default function TagMatch() {
  const searchParams = useSearchParams()
  const matchId = searchParams.get('matchId')

  const { matches, updateMatch, refresh } = useData()
  const match = matches.find((m) => m.id === matchId)

  const [videoObject, setVideoObject] = useState(null)
  const [videoId, setVideoId] = useState('')
  const [tableState, setTableState] = useState({
    rows: [],
    activeRowIndex: null
  })
  const [currentPage, setCurrentPage] = useState('PointScore')
  const [taggerHistory, setTaggerHistory] = useState([])
  const [isPublished, setIsPublished] = useState(false)
  const [matchMetadata, setMatchMetadata] = useState({})
  const [serverName, setServerName] = useState('Player1')

  const [customGameScore, setCustomGameScore] = useState('0-0')
  const [customSetScore, setCustomSetScore] = useState('0-0')

  const [initialLoad, setInitialLoad] = useState(true)
  const [errors, setErrors] = useState([])

  const [popUp, setPopUp] = useState([])
  const [isVisible, setIsVisible] = useState(true)
  const FRAMERATE = 30

  // States for Jump To functionality
  const [jumpMs, setJumpMs] = useState('')
  const [jumpMinutes, setJumpMinutes] = useState(0)
  const [jumpSecs, setJumpSecs] = useState(0)

  useEffect(() => {
    if (match && initialLoad) {
      // // debug
      // console.log('Match object:', match)
      // console.log('Extracted video ID:', match.videoId)
      setVideoId(match.videoId)
      setIsPublished(match.published || false)
      setTableState((oldTableState) => ({
        ...oldTableState,
        rows: match.points || []
      }))

      const { points, ...metadata } = match
      setMatchMetadata(metadata)
      setInitialLoad(false)
    }
  }, [match, initialLoad])

  useEffect(() => {
    const initialVideoId = searchParams.get('videoId') || ''
    setVideoId(initialVideoId)
  }, [searchParams])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [videoObject, videoId, tableState.rows, currentPage])

  useEffect(() => {
    sortTable()
  }, [tableState.rows])

  const handleKeyDown = (event) => {
    if (!videoObject) return

    const keyActions = {
      ' ': () => {
        const playing = videoObject.getPlayerState() === 1
        playing ? videoObject.pauseVideo() : videoObject.playVideo()
      },
      d: () => {
        const newTimestamp = getVideoTimestamp()

        if (
          tableState.activeRowIndex !== null &&
          tableState.rows[tableState.activeRowIndex].pointStartTime !== '' &&
          tableState.rows[tableState.activeRowIndex].pointEndTime === ''
        ) {
          saveToHistory()
          changeRowValue(
            tableState.activeRowIndex,
            'pointStartTime',
            newTimestamp
          )
        } else {
          saveToHistory()
          addNewRowAndSync()
        }
        sortTable()
      },
      f: () => {
        const newTimestamp = getVideoTimestamp()
        if (tableState.activeRowIndex !== null) {
          saveToHistory()
          changeRowValue(
            tableState.activeRowIndex,
            'pointEndTime',
            newTimestamp
          )
        }
      },
      r: () =>
        videoObject.seekTo(videoObject.getCurrentTime() + 1 / FRAMERATE, true),
      e: () =>
        videoObject.seekTo(videoObject.getCurrentTime() - 1 / FRAMERATE, true),
      w: () => videoObject.seekTo(videoObject.getCurrentTime() + 5, true),
      q: () => videoObject.seekTo(videoObject.getCurrentTime() - 5, true),
      s: () => videoObject.seekTo(videoObject.getCurrentTime() + 10, true),
      a: () => videoObject.seekTo(videoObject.getCurrentTime() - 10, true),
      2: () => videoObject.setPlaybackRate(2),
      1: () => videoObject.setPlaybackRate(1)
    }

    const action = keyActions[event.key]
    if (action) action()
  }

  const changeRowValue = (rowIndex, key, value) => {
    setTableState((oldTableState) => {
      const newRows = [...oldTableState.rows]
      newRows[rowIndex] = { ...newRows[rowIndex], [key]: value }
      return { ...oldTableState, rows: newRows }
    })
  }

  const getVideoTimestamp = () => {
    return Math.round(videoObject.getCurrentTime() * 1000)
  }

  // this has all the columns (original)
  // const convertToCSV = (data) => {
  //   const headers = Object.keys(data[0])
  //   const rows = data.map((obj) =>
  //     headers.map((fieldName) => JSON.stringify(obj[fieldName])).join(',')
  //   )
  //   return [headers.join(','), ...rows].join('\n')
  // }

  // only has the necessary columns in the CSV
  // issue: gameScore and setScore are interpretted as calendars in excel LOL
  //  normal tagger was like that too so gonna leave it (looked into solutions but couldn't find)
  const convertToCSV = (data) => {
    if (data.length === 0) return ''

    const selectedColumns = [
      'pointScore',
      'gameScore',
      'setScore',
      'serverName',
      'firstServeIn',
      'firstServeZone',
      'secondServeIn',
      'secondServeZone',
      'isWinner'
    ]

    const headers = selectedColumns.join(',')
    const rows = data.map((row) =>
      selectedColumns.map((field) => JSON.stringify(row[field] ?? '')).join(',')
    )

    return [headers, ...rows].join('\n')
  }

  const handleCopy = () => {
    const csvData = convertToCSV(tableState.rows)
    navigator.clipboard.writeText(csvData)
  }

  const handleDownload = () => {
    const csvData = convertToCSV(tableState.rows)
    const blob = new Blob([csvData], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'points.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const updateActiveRow = (key, value) => {
    setPopUp((popUp) => [...popUp, `Updating: ${key} = ${value}`])
    setTableState((oldTableState) => {
      const newRows = [...oldTableState.rows]
      if (oldTableState.activeRowIndex !== null) {
        newRows[oldTableState.activeRowIndex] = {
          ...newRows[oldTableState.activeRowIndex],
          [key]: value
        }
      }
      return { ...oldTableState, rows: newRows }
    })
  }

  const adjustGameScore = (p1Change, p2Change) => {
    setCustomGameScore((prevScore) => {
      const [p1, p2] = prevScore.split('-').map(Number)
      return `${Math.max(0, p1 + p1Change)}-${Math.max(0, p2 + p2Change)}`
    })
  }

  const adjustSetScore = (p1Change, p2Change) => {
    setCustomSetScore((prevScore) => {
      const [p1, p2] = prevScore.split('-').map(Number)
      return `${Math.max(0, p1 + p1Change)}-${Math.max(0, p2 + p2Change)}`
    })
  }

  const resetGameScore = () => {
    setCustomGameScore('0-0')
  }

  const resetSetScore = () => {
    setCustomSetScore('0-0')
  }

  const addNewRowAndSync = () => {
    setTableState((oldTableState) => {
      // pullAndPushRows(oldTableState.rows, null) // if we want to store in backend, we should do it here
      // will it conflict / override the backend data if there exists data for the full tagger for the same match?
      // how do we want to handle this?
      // right now, downloading from csv is the only option as it is local

      const lastRow =
        oldTableState.rows.length > 0
          ? oldTableState.rows[oldTableState.rows.length - 1]
          : {}

      const newRow = columnNames.reduce((acc, columnName) => {
        if (columnName === 'serverName') {
          acc[columnName] = serverName
        } else if (columnName === 'gameScore') {
          acc[columnName] = customGameScore ?? lastRow.gameScore ?? '0-0' // if customGameScore is set, use; if not inherit from last row; if no last row then 0-0
        } else if (columnName === 'setScore') {
          acc[columnName] = customSetScore ?? lastRow.setScore ?? '0-0' // if customSetScore is set, use; if not inherit from last row; if no last row then 0-0
        } else {
          acc[columnName] = '' // default to empty for all other fields
        }
        return acc
      }, {})

      const updatedTable = [...oldTableState.rows, newRow]
      updatedTable.sort((a, b) => a.pointStartTime - b.pointStartTime)

      const newIndex = updatedTable.length - 1

      setErrors(
        validateTable(updatedTable, {
          ...matchMetadata,
          activeRowIndex: newIndex
        })
      )

      return { rows: updatedTable, activeRowIndex: newIndex }
    })
  }

  const deleteRowAndSync = (rowIndex) => {
    const rowToDeleteTimestamp = tableState.rows[rowIndex].pointStartTime
    setTableState((oldTableState) => {
      const updatedTable = oldTableState.rows.filter(
        (_, index) => index !== rowIndex
      )
      const newActiveRowIndex =
        rowIndex === oldTableState.activeRowIndex
          ? oldTableState.activeRowIndex - 1
          : oldTableState.activeRowIndex
      setErrors(
        validateTable(updatedTable, {
          ...matchMetadata,
          activeRowIndex: newActiveRowIndex
        })
      )
      return { rows: updatedTable, activeRowIndex: newActiveRowIndex }
    })
    pullAndPushRows(tableState.rows, rowToDeleteTimestamp)
  }

  const saveToHistory = () => {
    setTaggerHistory((prevHistory) => {
      const newHistoryEntry = {
        table: JSON.parse(JSON.stringify(tableState.rows)),
        page: currentPage,
        activeRowIndex: tableState.activeRowIndex,
        popUp
      }
      return [...prevHistory, newHistoryEntry].slice(-30)
    })
  }

  const getLatestMatchDocument = async (matchId) => {
    await refresh()
    const match = matches.find((m) => m.id === matchId)

    if (match) {
      return match
    } else {
      throw new Error(`Match with ID ${matchId} not found.`)
    }
  }

  const pullAndPushRows = async (rowState, rowToDeleteTimestamp = null) => {
    try {
      const tableSnapshot = [...rowState]
      const matchDocument = await getLatestMatchDocument(matchId)
      const incomingRows = matchDocument.points ?? []

      let combinedRows = [...tableSnapshot, ...incomingRows]

      combinedRows =
        rowToDeleteTimestamp != null
          ? combinedRows.filter(
              (row) => row.pointStartTime !== rowToDeleteTimestamp
            )
          : combinedRows

      const uniqueRows = combinedRows.reduceRight(
        (acc, row) => {
          acc.pointStartTimes.add(row.pointStartTime)
          if (
            acc.pointStartTimes.has(row.pointStartTime) &&
            !acc.added.has(row.pointStartTime)
          ) {
            acc.rows.unshift(row)
            acc.added.add(row.pointStartTime)
          }
          return acc
        },
        { rows: [], pointStartTimes: new Set(), added: new Set() }
      ).rows

      uniqueRows.forEach((row) => {
        for (const key in row) {
          if (row[key] === undefined) {
            row[key] = ''
          }
        }
      })

      await updateMatch(matchId, { points: uniqueRows })

      setTableState((oldTableState) => {
        const currentTableWithOutdatedRemoved = oldTableState.rows.filter(
          (row) =>
            !uniqueRows.some(
              (uniqueRow) => uniqueRow.pointStartTime === row.pointStartTime
            )
        )

        const updatedTable = [...currentTableWithOutdatedRemoved, ...uniqueRows]

        updatedTable.sort((a, b) => a.pointStartTime - b.pointStartTime)

        const oldIndex = oldTableState.activeRowIndex
        const oldActiveRowTimestamp =
          oldTableState.rows[oldIndex]?.pointStartTime
        const newIndex = updatedTable.findIndex(
          (row) => row.pointStartTime === oldActiveRowTimestamp
        )
        setErrors(
          validateTable(updatedTable, {
            ...matchMetadata,
            activeRowIndex: newIndex
          })
        )

        return { rows: updatedTable, activeRowIndex: newIndex }
      })
      sortTable()
    } catch (error) {
      console.error('Error pulling and pushing rows: ', error)
    }
  }

  const togglePublish = async () => {
    pullAndPushRows(tableState.rows, null)
    try {
      await updateMatch(matchId, { published: !isPublished })
      setIsPublished(!isPublished)
    } catch (error) {
      console.error('Error toggling published state: ', error)
    }
  }

  const sortTable = () => {
    setTableState((oldTableState) => {
      return {
        ...oldTableState,
        rows: oldTableState.rows.sort(
          (a, b) => a.pointStartTime - b.pointStartTime
        )
      }
    })
  }

  const undoLastAction = () => {
    if (taggerHistory.length === 0) return

    const lastState = taggerHistory[taggerHistory.length - 1]
    setTableState({
      rows: JSON.parse(JSON.stringify(lastState.table)),
      activeRowIndex: lastState.activeRowIndex
    })
    setCurrentPage(lastState.page)
    setPopUp(lastState.popUp)

    setErrors(
      validateTable(lastState.table, {
        ...matchMetadata,
        activeRowIndex: lastState.activeRowIndex
      })
    )

    setTaggerHistory((prev) => prev.slice(0, -1))
  }

  // Jump to a specific timestamp in milliseconds
  const handleJumpToMs = () => {
    if (videoObject && jumpMs !== '') {
      const timeInSeconds = parseInt(jumpMs, 10) / 1000
      videoObject.seekTo(timeInSeconds, true)
    }
  }

  // Jump to a specific timestamp given minutes and seconds
  const handleJumpToMinSec = () => {
    if (videoObject) {
      const minutes = parseInt(jumpMinutes, 10) || 0
      const seconds = parseInt(jumpSecs, 10) || 0
      const totalSeconds = minutes * 60 + seconds
      videoObject.seekTo(totalSeconds, true)
    }
  }

  const buttonData = getSimpleTaggerButtonData(
    updateActiveRow,
    addNewRowAndSync,
    setCurrentPage,
    {
      serverName
    }
  )

  function getErrors(rowIndex, columnName) {
    const cellErrors = errors.filter((error) =>
      error.cells.some(
        ([errorRow, errorCol]) =>
          (errorRow === rowIndex || errorRow === null) &&
          (errorCol === columnName || errorCol === null)
      )
    )

    return cellErrors.length > 0 ? cellErrors : null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Condensed Jump To Section */}
      <div style={{ marginBottom: '1rem', marginLeft: '2vw' }}>
        <h3 style={{ marginBottom: '1vh', marginTop: '0px' }}>
          {' '}
          Jump To Timestamp
        </h3>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1vw',
            alignItems: 'flex-end'
          }}
        >
          <div
            style={{ display: 'flex', flexDirection: 'column', width: '10vw' }}
          >
            <label>Milliseconds:</label>
            <input
              type="number"
              value={jumpMs}
              onChange={(e) => setJumpMs(e.target.value)}
              placeholder="Enter ms"
              style={{ width: '10vw' }}
            />
          </div>
          <button
            onClick={handleJumpToMs}
            style={{ alignSelf: 'flex-end', height: '4vh', marginRight: '2vw' }}
          >
            Jump
          </button>
          <div
            style={{ display: 'flex', flexDirection: 'column', width: '10vw' }}
          >
            <label>Minutes:</label>
            <input
              type="number"
              value={jumpMinutes}
              onChange={(e) => setJumpMinutes(e.target.valueAsNumber || 0)}
              placeholder="Min"
              style={{ width: '10vw' }}
            />
          </div>
          <div
            style={{ display: 'flex', flexDirection: 'column', width: '10vw' }}
          >
            <label>Seconds:</label>
            <input
              type="number"
              value={jumpSecs}
              onChange={(e) => setJumpSecs(e.target.valueAsNumber || 0)}
              placeholder="Sec"
              style={{ width: '10vw' }}
            />
          </div>
          <button
            onClick={handleJumpToMinSec}
            style={{ alignSelf: 'flex-end', height: '4vh' }}
          >
            Jump
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          width: '100%',
          gap: '1rem'
        }}
      >
        {/* Left Column with Left Padding */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '48vw',
            height: '36vw',
            paddingLeft: '2vw'
          }}
        >
          <VideoPlayer videoId={videoId} setVideoObject={setVideoObject} />
          <button onClick={handleDownload}>Download CSV</button>
          <button onClick={handleCopy}>Copy Columns</button>
          <button onClick={undoLastAction}>Undo</button>
          <button onClick={togglePublish}>
            {isPublished ? 'Unpublish' : 'Publish'}
          </button>
          <button onClick={() => setIsVisible(!isVisible)}>
            {isVisible ? 'Hide Last Command' : 'Show Last Command'}
          </button>
        </div>

        <div>
          <p>{currentPage}</p>
          <div className={styles.buttonDataControl}>
            {buttonData[currentPage].map((button, index) => {
              return button.courtImage ? (
                <div key={index}>
                  <p>{button.label}</p>
                </div>
              ) : (
                <button
                  className={styles.customButton}
                  key={index}
                  onClick={() => {
                    setPopUp([])
                    saveToHistory()
                    const data = {
                      ...matchMetadata,
                      table: tableState.rows,
                      activeRowIndex: tableState.activeRowIndex,
                      videoTimestamp: getVideoTimestamp()
                    }
                    button.action(data)
                  }}
                >
                  {button.label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <p>Current Server: {serverName}</p>
            <button
              onClick={() => {
                setServerName((prevName) =>
                  prevName === 'Player1' ? 'Player2' : 'Player1'
                )
              }}
            >
              Toggle Server
            </button>
          </div>

          <div>
            <p>Current Game Score: {customGameScore}</p>
            <button onClick={() => adjustGameScore(1, 0)}>+1 Player 1</button>
            <button onClick={() => adjustGameScore(0, 1)}>+1 Player 2</button>
            <button onClick={() => adjustGameScore(-1, 0)}>-1 Player 1</button>
            <button onClick={() => adjustGameScore(0, -1)}>-1 Player 2</button>
            <button
              onClick={resetGameScore}
              style={{ backgroundColor: 'rgb(38,116,174)', color: 'white' }}
            >
              Reset Game Score
            </button>
          </div>

          <div>
            <p>Current Set Score: {customSetScore}</p>
            <button onClick={() => adjustSetScore(1, 0)}>+1 Player 1</button>
            <button onClick={() => adjustSetScore(0, 1)}>+1 Player 2</button>
            <button onClick={() => adjustSetScore(-1, 0)}>-1 Player 1</button>
            <button onClick={() => adjustSetScore(0, -1)}>-1 Player 2</button>
            <button
              onClick={resetSetScore}
              style={{ backgroundColor: 'rgb(38,116,174)', color: 'white' }}
            >
              Reset Set Score
            </button>
          </div>

          {/* <div>
            <p>Current Side: {serverFarNear}</p>
            <button
              onClick={() => {
                setServerFarNear((prevSide) =>
                  prevSide === 'Far' ? 'Near' : 'Far'
                )
              }}
            >
              Toggle Side
            </button>
          </div> */}

          {/* <div>
            <p>Tiebreak: {tiebreak.toString()}</p>
            <button
              onClick={() => {
                setTiebreak(!tiebreak)
              }}
            >
              Toggle Tiebreak
            </button>
          </div> */}

          {isVisible && popUp.length > 0 && (
            <div className={styles.popUp}>
              <h2 style={{ fontSize: '20px' }}>Altered Rows:</h2>
              {popUp.map((message, index) => (
                <p key={index}>{message}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th key={'delete_button'}>Delete</th>
            {simpleColumnNames.map((columnName, index) => (
              <th key={index}>{columnName}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableState.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              <td key={'delete_button_row'}>
                <button onClick={() => deleteRowAndSync(rowIndex)}>
                  <i className="fa fa-trash" aria-hidden="true">
                    X
                  </i>
                </button>
              </td>
              {simpleColumnNames.map((columnName, colIndex) => {
                const cellErrors = getErrors(rowIndex, columnName)
                const errorDescriptions = cellErrors
                  ? cellErrors.map((error) => error.description).join(', ')
                  : ''
                return (
                  <td key={colIndex}>
                    <input
                      type="text"
                      value={row[columnName] || ''}
                      onChange={(event) => {
                        saveToHistory()
                        changeRowValue(rowIndex, columnName, event.target.value)
                      }}
                      style={{
                        backgroundColor: cellErrors
                          ? 'lightcoral'
                          : tableState.activeRowIndex === rowIndex
                            ? 'yellow'
                            : 'white'
                      }}
                      title={errorDescriptions}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
