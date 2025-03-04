'use client'

import React, {
  useState,
  useEffect,
  useRef,
  Suspense,
  useCallback
} from 'react'
import { useSearchParams } from 'next/navigation'
import VideoPlayer from '../components/VideoPlayer.js'
import TennisCourtSVG from '@/public/TennisCourtSVG.js'
import styles from '@/app/styles/Tagging.module.css'

const TagTable = ({
  pair,
  index,
  handleStartTimeChange,
  handleEndTimeChange,
  handlePlayerWonChange,
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
          className={styles.inputField}
          placeholder="Start Time (ms)"
        />
      </td>
      <td>
        <input
          type="text"
          value={pair[1]}
          onChange={(event) => handleEndTimeChange(index, event.target.value)}
          className={styles.inputField}
          placeholder="End Time (ms)"
        />
      </td>
      <td>
        <input
          type="text"
          value={pair[2]}
          onChange={(event) => handlePlayerWonChange(index, event.target.value)}
          className={styles.inputField}
          placeholder="Point Winner"
        />
      </td>
      <td>
        <button
          className={styles.deleteButton}
          onClick={() => handleRemoveTime(index)}
          aria-label={`Remove timestamp ${index + 1}`}
        >
          &#10005;
        </button>
      </td>
    </tr>
  )
}

const KeybindingsTable = () => {
  return (
    <table className={styles.keybindingsTable}>
      <thead>
        <tr>
          <th>Key</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>[Space]</td>
          <td>Pause/Play</td>
        </tr>
        <tr>
          <td>[D] [F] [G]</td>
          <td>
            Start Timestamp | End Timestamp, Player 1 Won | End Timestamp,
            Player 2 Won
          </td>
        </tr>
        <tr>
          <td>[R] [E]</td>
          <td>Forward | Backward 1s</td>
        </tr>
        <tr>
          <td>[W] [Q]</td>
          <td>Forward | Backward 5s</td>
        </tr>
        <tr>
          <td>[S] [A]</td>
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

  // State variables for clicked point
  const [clickedQuadrant, setClickedQuadrant] = useState(null)
  const [clickedCoordinates, setClickedCoordinates] = useState(null)

  const searchParams = useSearchParams()

  useEffect(() => {
    const initialVideoId = searchParams.get('videoId') || ''
    setVideoId(initialVideoId)
  }, [searchParams])

  const handleVideoIdChange = (event) => {
    setVideoId(event.target.value)
  }

  const handleLoadVideo = () => {
    if (videoId.trim() === '') {
      alert('Please enter a valid YouTube Video ID.')
      return
    }
    // Optionally, you can update the URL's search params here
    // or handle any additional logic when loading a new video
    // For example, you might want to reset timeList and timerValue
    setTimeList([])
    setTimerValue(0)
    setCurTimeStart(0)
    // If using URL search params, you might need to update them
  }

  const handleKeyDown = useCallback(
    (event) => {
      if (!videoObject) return

      if (inputRef.current === document.activeElement) {
        if (event.key === ' ') {
          event.preventDefault()
        }
        return
      }

      const key = event.key.toLowerCase()

      const keyActions = {
        ' ': () => {
          const playing = videoObject.getPlayerState() === 1
          playing ? videoObject.pauseVideo() : videoObject.playVideo()
        },
        d: () => {
          const newTimestamp = Math.round(videoObject.getCurrentTime() * 1000)
          if (!timeList.some((pair) => pair[1] === 0)) {
            setTimeList((prevList) =>
              [...prevList, [newTimestamp, 0, '']].sort((a, b) => a[0] - b[0])
            )
            setCurTimeStart(newTimestamp)
          }
        },
        f: () => {
          const newTimestamp = Math.round(videoObject.getCurrentTime() * 1000)
          setTimeList((prevList) =>
            prevList.map((pair) =>
              pair[1] === 0 && newTimestamp >= pair[0]
                ? [pair[0], newTimestamp, 'Player 1']
                : pair
            )
          )
        },
        g: () => {
          const newTimestamp = Math.round(videoObject.getCurrentTime() * 1000)
          setTimeList((prevList) =>
            prevList.map((pair) =>
              pair[1] === 0 && newTimestamp >= pair[0]
                ? [pair[0], newTimestamp, 'Player 2']
                : pair
            )
          )
        },
        r: () =>
          videoObject.seekTo(
            videoObject.getCurrentTime() + 1 / FRAMERATE,
            true
          ),
        e: () =>
          videoObject.seekTo(
            videoObject.getCurrentTime() - 1 / FRAMERATE,
            true
          ),
        w: () => videoObject.seekTo(videoObject.getCurrentTime() + 5, true),
        q: () => videoObject.seekTo(videoObject.getCurrentTime() - 5, true),
        s: () => videoObject.seekTo(videoObject.getCurrentTime() + 10, true),
        a: () => videoObject.seekTo(videoObject.getCurrentTime() - 10, true),
        1: () => videoObject.setPlaybackRate(1),
        2: () => videoObject.setPlaybackRate(2)
      }

      const action = keyActions[key]
      if (action) action()
    },
    [videoObject, timeList, FRAMERATE, setCurTimeStart]
  )

  const handleStartTimeChange = (index, value) => {
    const updatedTimeList = [...timeList]
    updatedTimeList[index][0] = parseInt(value) || 0
    setTimeList(updatedTimeList)
  }

  const handleEndTimeChange = (index, value) => {
    const updatedTimeList = [...timeList]
    updatedTimeList[index][1] = parseInt(value) || 0
    setTimeList(updatedTimeList)
  }

  const handlePlayerWonChange = (index, value) => {
    const updatedTimeList = [...timeList]
    updatedTimeList[index][2] = value
    setTimeList(updatedTimeList)
  }

  const handleMinutesSecondsChange = (minutes, seconds) => {
    const newTime = minutes * 60 + seconds
    videoObject.seekTo(newTime, true)
  }

  const updateTimer = useCallback(() => {
    if (videoObject && typeof videoObject.getCurrentTime === 'function') {
      const currentTime = Math.round(videoObject.getCurrentTime() * 1000)
      setTimerValue(currentTime)
    }
  }, [videoObject, setTimerValue])

  const handleMillisecondsChange = (value) => {
    const milliseconds = parseInt(value)
    if (!isNaN(milliseconds)) {
      videoObject.seekTo(milliseconds / 1000, true)
    }
  }

  const handleRemoveTime = (index) => {
    const updatedTimeList = [...timeList].filter((_, i) => i !== index)
    setTimeList(updatedTimeList)
  }

  const handleDownload = () => {
    const csvData = [
      'Index,Start Time,End Time,Point Winner',
      ...timeList.map(
        (pair, index) => `${index + 1},${pair[0]},${pair[1]},${pair[2]}`
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
      'Index,Start Time,End Time,Point Winner',
      ...timeList.map(
        (pair, index) => `${index + 1},${pair[0]},${pair[1]},${pair[2]}`
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
  }, [handleKeyDown, updateTimer])

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

  const handleCourtClick = (event) => {
    if (!videoObject) return

    const rect = event.currentTarget.getBoundingClientRect()
    const widthOfCourt = rect.width
    const heightOfCourt = rect.height
    const courtWidthInInches = 432
    const xRatio = 0.6
    const inchesPerPixel = courtWidthInInches / (widthOfCourt * xRatio)

    // Calculate the click position within the element
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // Determine the offset from the center of the court
    const xFromCenter = x - widthOfCourt / 2
    const yFromCenter = y - heightOfCourt / 2

    let xInches = (xFromCenter * inchesPerPixel).toFixed(3)
    let yInches = (yFromCenter * inchesPerPixel * -1).toFixed(3)

    // Normalize any negative zero values
    xInches = Object.is(xInches, -0) ? 0 : xInches
    yInches = Object.is(yInches, -0) ? 0 : yInches

    // Determine quadrant based on center-relative offsets
    let quadrant = ''
    if (xFromCenter < 0 && yFromCenter < 0) quadrant = 'Top-Left'
    else if (xFromCenter >= 0 && yFromCenter < 0) quadrant = 'Top-Right'
    else if (xFromCenter < 0 && yFromCenter >= 0) quadrant = 'Bottom-Left'
    else if (xFromCenter >= 0 && yFromCenter >= 0) quadrant = 'Bottom-Right'

    setClickedQuadrant(quadrant)
    setClickedCoordinates({ x: xInches, y: yInches })
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className={styles.container}>
        <div className={styles.topSection}>
          {/* Video Player and Timestamp Table */}
          <div className={styles.videoSection}>
            <div className={styles.videoPlayer}>
              <VideoPlayer videoId={videoId} setVideoObject={setVideoObject} />
            </div>

            {/* Minimalistic Video ID Input Line */}
            <div className={styles.videoIdLine}>
              <input
                type="text"
                id="videoId"
                value={videoId}
                onChange={handleVideoIdChange}
                ref={inputRef}
                placeholder="Enter YouTube Video ID (e.g., dQw4w9WgXcQ)"
              />
              <button onClick={handleLoadVideo}>Load Video</button>
            </div>
            <button onClick={handleDownload}>Download JSON</button>
            <button onClick={handleCopyColumns}>Copy Columns</button>

            {/* Timestamp Table */}
            <div className={styles.timestampTableContainer}>
              <table className={styles.timestampTable}>
                <thead>
                  <tr>
                    <th>Index</th>
                    <th>Start Time (ms)</th>
                    <th>End Time (ms)</th>
                    <th>Point Winner</th>
                    <th>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan="5">
                      <strong>Current Timestamp</strong>
                    </td>
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
                            handleRemoveTime={handleRemoveTime}
                          />
                        )
                      } else return null
                    })}
                </tbody>
                <tbody>
                  <tr>
                    <td colSpan="5">
                      <strong>All Timestamps</strong>
                    </td>
                  </tr>
                  {timeList.map((pair, index) => (
                    <TagTable
                      key={index}
                      pair={pair}
                      index={index}
                      handleStartTimeChange={handleStartTimeChange}
                      handleEndTimeChange={handleEndTimeChange}
                      handlePlayerWonChange={handlePlayerWonChange}
                      handleRemoveTime={handleRemoveTime}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tennis Court SVG */}
          <div className={styles.courtSection}>
            <TennisCourtSVG
              className={styles.courtImage}
              handleImageClick={handleCourtClick}
              aria-label="Tennis Court Diagram"
            />
          </div>

          {/* Controls Section */}
          <div className={styles.controlsSection}>
            <table className={styles.timerTable}>
              <tbody>
                <tr>
                  <td>
                    <strong>Current Time:</strong>
                  </td>
                  <td>{timerValue} ms</td>
                </tr>
                <tr>
                  <td>
                    <strong>Jump to:</strong>
                  </td>
                  <td></td>
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
                      className={styles.inputField}
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
                        const minutes = parseFloat(event.target.value) || 0
                        const seconds = (timerValue % 60000) / 1000
                        handleMinutesSecondsChange(minutes, seconds)
                      }}
                      className={styles.inputField}
                    />
                  </td>
                  <td>minutes</td>
                  <td>
                    <input
                      type="number"
                      placeholder="Seconds"
                      value={Math.round((timerValue % 60000) / 1000)}
                      onChange={(event) => {
                        const seconds = parseFloat(event.target.value) || 0
                        const minutes = Math.floor(timerValue / 60000)
                        handleMinutesSecondsChange(minutes, seconds)
                      }}
                      className={styles.inputField}
                    />
                  </td>
                  <td>seconds</td>
                </tr>
              </tbody>
            </table>

            <KeybindingsTable />

            {/* Display Clicked Quadrant and Coordinates Under KeybindingsTable */}
            <div className={styles.clickedInfo}>
              {clickedQuadrant && clickedCoordinates ? (
                <div>
                  <h3>Clicked Point Details</h3>
                  <p>
                    <strong>Quadrant:</strong> {clickedQuadrant}
                  </p>
                  <p>
                    <strong>Coordinates:</strong> (X: {clickedCoordinates.x} ,
                    Y: {clickedCoordinates.y} )
                  </p>
                </div>
              ) : (
                <div>
                  <h3>Clicked Point Details</h3>
                  <p>Click on the court to see details here.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Horizontal Line */}
        <hr className={styles.customHr} />

        {/* Note: Timestamp Table has been moved inside videoSection */}
      </div>
    </Suspense>
  )
}
