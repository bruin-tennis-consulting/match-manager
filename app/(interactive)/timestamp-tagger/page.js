// timestamp-tagger/page.js
'use client'

import React, { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import VideoPlayer from '../../components/VideoPlayer'
import TennisCourtSVG from '@/app/components/TennisCourtSVG' // Import TennisCourtSVG
import styles from '../../styles/Tagging.module.css'

const TagTable = ({
  pair,
  index,
  handleStartTimeChange,
  handleEndTimeChange,
  handlePlayerWonChange,
  handleXChange,
  handleYChange,
  handleRemoveTime
}) => {
  return (
    <tr key={index}>
      <td>{index + 1}</td>
      <td>
        <input
          type="text"
          value={pair[0]}
          onChange={(event) => handleStartTimeChange(index, event.target.value)}
        />
      </td>
      <td>
        <input
          type="text"
          value={pair[1]}
          onChange={(event) => handleEndTimeChange(index, event.target.value)}
        />
      </td>
      <td>
        <input
          type="text"
          value={pair[2]}
          onChange={(event) => handlePlayerWonChange(index, event.target.value)}
        />
      </td>
      <td>
        <input
          type="number"
          value={pair[3]}
          onChange={(event) => handleXChange(index, event.target.value)}
          placeholder="X"
          style={{ width: '60px', marginRight: '5px' }}
        />
      </td>
      <td>
        <input
          type="number"
          value={pair[4]}
          onChange={(event) => handleYChange(index, event.target.value)}
          placeholder="Y"
          style={{ width: '60px', marginRight: '5px' }}
        />
      </td>
      <td>
        <button
          className={styles.deleteButton}
          onClick={() => handleRemoveTime(index)}
        >
          X
        </button>
      </td>
    </tr>
  )
}

const KeybindingsTable = () => {
  return (
    <table>
      <thead>
        <tr>
          <td>
            <b>Key</b>
          </td>
          <td>
            <b>Action</b>
          </td>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>[space]</td>
          <td>Pause/Play</td>
        </tr>
        <tr>
          <td>[d] [f] [g]</td>
          <td>
            Start Timestamp | End Timestamp, Player 1 Won | End Timestamp,
            Player 2 Won
          </td>
        </tr>
        <tr>
          <td>[r] [e]</td>
          <td>Forward | Backward 1s</td>
        </tr>
        <tr>
          <td>[w] [q]</td>
          <td>Forward | Backward 5s</td>
        </tr>
        <tr>
          <td>[s] [a]</td>
          <td>Forward | Backward 10s</td>
        </tr>
        <tr>
          <td>[1] [2]</td>
          <td>Speed x1 | x2</td>
        </tr>
      </tbody>
    </table>
  )
}

export default function TagMatch() {
  const [videoObject, setVideoObject] = useState(null)
  const [videoId, setVideoId] = useState('')
  const [timeList, setTimeList] = useState([])
  const [timerValue, setTimerValue] = useState(0)
  const [curTimeStart, setCurTimeStart] = useState(0)
  const FRAMERATE = 30
  const inputRef = useRef(null)

  const searchParams = useSearchParams()

  useEffect(() => {
    setVideoId(searchParams.get('videoId'))
  }, [])

  const handleVideoIdChange = (event) => {
    setVideoId(event.target.value)
  }

  const handleKeyDown = (event) => {
    if (!videoObject) return

    if (inputRef.current === document.activeElement) {
      if (event.key === ' ') {
        event.preventDefault()
      }
      return
    }

    const keyActions = {
      ' ': () => {
        const playing = videoObject.getPlayerState() === 1
        playing ? videoObject.pauseVideo() : videoObject.playVideo()
      },
      d: () => {
        const newTimestamp = Math.round(videoObject.getCurrentTime() * 1000)
        if (!timeList.some((pair) => pair[1] === 0)) {
          setTimeList((timeList) =>
            [...timeList, [newTimestamp, 0, '', 0, 0]].sort(
              (pair1, pair2) => pair1[0] - pair2[0]
            )
          )
          setCurTimeStart(newTimestamp)
        }
      },
      f: () => {
        const newTimestamp = Math.round(videoObject.getCurrentTime() * 1000)
        setTimeList((timeList) =>
          timeList.map((pair) =>
            pair[1] === 0 && newTimestamp >= pair[0]
              ? [pair[0], newTimestamp, 'Player 1', pair[3], pair[4]]
              : pair
          )
        )
      },
      g: () => {
        const newTimestamp = Math.round(videoObject.getCurrentTime() * 1000)
        setTimeList((timeList) =>
          timeList.map((pair) =>
            pair[1] === 0 && newTimestamp >= pair[0]
              ? [pair[0], newTimestamp, 'Player 2', pair[3], pair[4]]
              : pair
          )
        )
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

  const handleStartTimeChange = (index, value) => {
    const updatedTimeList = [...timeList]
    updatedTimeList[index] = [
      parseInt(value),
      updatedTimeList[index][1],
      updatedTimeList[index][2],
      updatedTimeList[index][3],
      updatedTimeList[index][4]
    ]
    setTimeList(updatedTimeList)
  }

  const handleEndTimeChange = (index, value) => {
    const updatedTimeList = [...timeList]
    updatedTimeList[index] = [
      updatedTimeList[index][0],
      parseInt(value),
      updatedTimeList[index][2],
      updatedTimeList[index][3],
      updatedTimeList[index][4]
    ]
    setTimeList(updatedTimeList)
  }

  const handlePlayerWonChange = (index, value) => {
    const updatedTimeList = [...timeList]
    updatedTimeList[index] = [
      updatedTimeList[index][0],
      updatedTimeList[index][1],
      value,
      updatedTimeList[index][3],
      updatedTimeList[index][4]
    ]
    setTimeList(updatedTimeList)
  }

  const handleXChange = (index, value) => {
    const updatedTimeList = [...timeList]
    updatedTimeList[index][3] = parseInt(value) || 0
    setTimeList(updatedTimeList)
  }

  const handleYChange = (index, value) => {
    const updatedTimeList = [...timeList]
    updatedTimeList[index][4] = parseInt(value) || 0
    setTimeList(updatedTimeList)
  }

  const handleMinutesSecondsChange = (minutes, seconds) => {
    const newTime = minutes * 60 + seconds
    videoObject.seekTo(newTime, true)
  }

  const updateTimer = () => {
    if (videoObject && typeof videoObject.getCurrentTime === 'function') {
      const currentTime = Math.round(videoObject.getCurrentTime() * 1000)
      setTimerValue(currentTime)
    }
  }

  const handleMillisecondsChange = (value) => {
    const milliseconds = parseInt(value)
    videoObject.seekTo(milliseconds / 1000, true)
  }

  const handleRemoveTime = (index) => {
    const updatedTimeList = [...timeList].filter((item, i) => i !== index)
    setTimeList(updatedTimeList)
  }

  const handleDownload = () => {
    const csvData = [
      'Index,Start Time,End Time,Point Winner,X,Y',
      ...timeList.map(
        (pair, index) =>
          `${index + 1},${pair[0]},${pair[1]},${pair[2]},${pair[3]},${pair[4]}`
      )
    ].join('\n')
    const blob = new Blob([csvData], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `timestamps_${videoId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopyColumns = () => {
    const columns = [
      'Index,Start Time,End Time,Point Winner,X,Y',
      ...timeList.map(
        (pair, index) =>
          `${index + 1},${pair[0]},${pair[1]},${pair[2]},${pair[3]},${pair[4]}`
      )
    ].join('\n')
    navigator.clipboard.writeText(columns)
  }

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    const timerInterval = setInterval(updateTimer, 100)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      clearInterval(timerInterval)
    }
  }, [videoObject, timeList])

  useEffect(() => {
    const handleArrowKeys = (event) => {
      if (event.key === 'ArrowRight') {
        videoObject.seekTo(videoObject.getCurrentTime() + 10, true)
      } else if (event.key === 'ArrowLeft') {
        videoObject.seekTo(videoObject.getCurrentTime() - 10, true)
      }
    }

    document.addEventListener('keydown', handleArrowKeys)
    return () => {
      document.removeEventListener('keydown', handleArrowKeys)
    }
  }, [videoObject])

  // Handle clicks on the Tennis Court SVG
  const handleCourtClick = (event) => {
    if (!videoObject) return

    const rect = event.currentTarget.getBoundingClientRect()
    const widthOfCourt = rect.width
    const heightOfCourt = rect.height

    // Assuming the court width in inches is 432 (36 feet)
    const courtWidthInInches = 432
    const courtHeightInInches = 780 // 65 feet (common tennis court length)

    // Calculate the scale ratios
    const xRatio = courtWidthInInches / widthOfCourt
    const yRatio = courtHeightInInches / heightOfCourt

    // Calculate click position relative to the SVG container
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // Convert to inches
    const xInches = Math.round(x * xRatio)
    const yInches = Math.round(y * yRatio)

    const currentTimestamp = Math.round(videoObject.getCurrentTime() * 1000)

    // Add a new timestamp with coordinates
    setTimeList((prevList) => [
      ...prevList,
      [currentTimestamp, 0, '', xInches, yInches]
    ].sort((a, b) => a[0] - b[0]))
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className={styles.container}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            width: '100%',
            height: '28vw'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ width: '42vw' }}>
              <VideoPlayer videoId={videoId} setVideoObject={setVideoObject} />
            </div>
            <label>Enter YouTube Code: </label>
            <input
              type="text"
              value={videoId}
              onChange={handleVideoIdChange}
              ref={inputRef}
            />
            <button onClick={handleDownload}>Download CSV</button>
            <button onClick={handleCopyColumns}>Copy Columns</button>
          </div>
          <div style={{ marginLeft: '20px' }}>
            <TennisCourtSVG
              className={styles.courtImage}
              handleImageClick={handleCourtClick}
            />
          </div>
          <div>
            <table className={styles.table}>
              <tbody>
                <tr>
                  <td colSpan="2">Current Time: {timerValue}ms</td>
                </tr>
                <tr>
                  <td>Jump to: </td>
                </tr>
                <tr>
                  <td>
                    <input
                      type="number"
                      placeholder="Milliseconds"
                      value={timerValue}
                      onChange={(event) =>
                        handleMillisecondsChange(event.target.value)
                      }
                      style={{ marginRight: '10px' }}
                    />
                  </td>
                  <td>ms</td>
                </tr>
                <tr>
                  <td>
                    <input
                      type="number"
                      placeholder="Minutes"
                      value={Math.floor(timerValue / 60000)}
                      onChange={(event) => {
                        const minutes = parseFloat(event.target.value)
                        const seconds = (timerValue % 60000) / 1000
                        handleMinutesSecondsChange(minutes, seconds)
                      }}
                      style={{ marginRight: '10px' }}
                    />
                  </td>
                  <td>minutes</td>
                  <td>
                    <input
                      type="number"
                      placeholder="Seconds"
                      value={Math.round((timerValue % 60000) / 1000)}
                      onChange={(event) => {
                        const seconds = parseFloat(event.target.value)
                        const minutes = Math.floor(timerValue / 60000)
                        handleMinutesSecondsChange(minutes, seconds)
                      }}
                    />
                  </td>
                  <td>seconds</td>
                </tr>
              </tbody>
            </table>
            <KeybindingsTable />
          </div>
        </div>

        <hr />
        <table>
          <thead>
            <tr>
              <th>Index</th>
              <th>Start Time</th>
              <th>End Time</th>
              <th>Point Winner</th>
              <th>X (inches)</th>
              <th>Y (inches)</th>
              <th>Remove</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan="7">Current Timestamp</td>
            </tr>
            {timeList.length !== 0 &&
              timeList.map((pair, index) => {
                if (curTimeStart === pair[0]) {
                  return (
                    <TagTable
                      key={index}
                      pair={timeList[index]}
                      index={index}
                      handleStartTimeChange={handleStartTimeChange}
                      handleEndTimeChange={handleEndTimeChange}
                      handlePlayerWonChange={handlePlayerWonChange}
                      handleXChange={handleXChange}
                      handleYChange={handleYChange}
                      handleRemoveTime={handleRemoveTime}
                    />
                  )
                } else return null
              })}
          </tbody>
          <tbody>
            <tr>
              <td colSpan="7">All Timestamps</td>
            </tr>
            {timeList.map((pair, index) => (
              <TagTable
                key={index}
                pair={pair}
                index={index}
                handleStartTimeChange={handleStartTimeChange}
                handleEndTimeChange={handleEndTimeChange}
                handlePlayerWonChange={handlePlayerWonChange}
                handleXChange={handleXChange}
                handleYChange={handleYChange}
                handleRemoveTime={handleRemoveTime}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Suspense>
  )
}
