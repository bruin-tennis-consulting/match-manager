'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation' // Updated import for usePathname

import { useData } from '@/app/DataProvider'
import { filterGroups } from '@/app/services/filterGroups'
import filterListStyles from '@/app/styles/FilterList.module.css'
import styles from '@/app/styles/Match.module.css'

import VideoPlayer from '@/app/components/VideoPlayer'
import FilterList from '@/app/components/FilterList'
import PointsList from '@/app/components/PointsList'
import ScoreBoard from '@/app/components/ScoreBoard'
import MatchTiles from '@/app/components/MatchTiles'
import ExtendedList from '@/app/components/ExtendedList'
import Loading from '@/app/components/Loading'

const findDisplayName = (key) => {
  // Search through all sections of filterGroups
  for (const section of Object.values(filterGroups)) {
    // Check in subCategories
    if (section.subCategories && section.subCategories[key]) {
      return section.subCategories[key].title
    }

    // Check in players
    if (section.players) {
      for (const player of Object.values(section.players)) {
        if (player.categories && player.categories[key]) {
          return player.categories[key].title
        }
      }
    }
  }

  return key // Fallback to key if no display name found
}

const MatchPage = () => {
  const [matchData, setMatchData] = useState()
  const [filterList, setFilterList] = useState([])
  const [videoObject, setVideoObject] = useState(null)
  const [showPercent, setShowPercent] = useState(false)
  const [showCount, setShowCount] = useState(false)
  const [playingPoint, setPlayingPoint] = useState(null)
  const [showPDF, setShowPDF] = useState(true)
  const [tab, setTab] = useState(1)
  const [bookmarks, setBookmarks] = useState([])
  const [triggerScroll, setTriggerScroll] = useState(false)
  const [autoplayEnabled, setAutoplayEnabled] = useState(true)
  const tableRef = useRef(null)
  const iframeRef = useRef(null)

  const { matches, updateMatch } = useData()
  const pathname = usePathname() // usePathname now imported from next/navigation
  const docId = pathname.substring(pathname.lastIndexOf('/') + 1)

  const [error, setError] = useState(null)
  const [isInitialLoad, setIsInitialLoad] = useState(matches.length === 0)

  const router = useRouter()
  const searchParams = useSearchParams()

  // Read filter parameters from URL on initial load
  useEffect(() => {
    const params = new URLSearchParams(searchParams)
    const initialFilters = []
    for (const [key, value] of params.entries()) {
      initialFilters.push([key, value])
    }
    setFilterList(initialFilters)
  }, [searchParams])

  // Update URL whenever filterList changes
  useEffect(() => {
    if (filterList) {
      const params = new URLSearchParams()
      filterList.forEach(([key, value]) => {
        params.append(key, value)
      })
      router.replace(`?${params.toString()}`)
    }
  }, [filterList, router])

  // Check validity of match by user access
  useEffect(() => {
    // Only proceed with match checking if matches array is not empty
    // This ensures we don't show an error before data is loaded
    if (matches.length > 0) {
      const selectedMatch = matches.find((match) => match.id === docId)

      if (!selectedMatch) {
        setError('not-found')
      } else {
        setError(null)
        setMatchData(selectedMatch)
        const initialBookmarks = selectedMatch.pointsJson.filter(
          (point) => point.bookmarked
        )
        setBookmarks(initialBookmarks)
      }

      setIsInitialLoad(false)
    }
  }, [matches, docId])
  const handleJumpToTime = (time) => {
    if (videoObject && videoObject.seekTo) {
      videoObject.seekTo(time / 1000, true)
    }
  }

  const returnFilteredPoints = useCallback(() => {
    let filteredPoints = matchData.pointsJson
    const filterMap = new Map()

    filterList.forEach((filter) => {
      const [key, value] = filter
      if (filterMap.has(key)) {
        filterMap.get(key).push(value)
      } else {
        filterMap.set(key, [value])
      }
    })

    filterMap.forEach((values, key) => {
      filteredPoints = filteredPoints.filter((point) =>
        values.length > 1
          ? values.includes(point[key])
          : point[key] === values[0]
      )
    })

    return filteredPoints
  }, [matchData, filterList])

  useEffect(() => {
    if (!videoObject || !autoplayEnabled) return
    const interval = setInterval(() => {
      if (videoObject && typeof videoObject.getCurrentTime === 'function') {
        const currentTime = videoObject.getCurrentTime() * 1000 // Convert to ms
        const filteredPoints = returnFilteredPoints().sort(
          (a, b) => a.Position - b.Position
        )

        if (!filteredPoints.length) return

        const insideAnyPoint = filteredPoints.some(
          (point) =>
            currentTime + 2000 >= point.Position &&
            currentTime - 2000 <= point.Position + point.Duration
        )

        if (!insideAnyPoint) {
          const nextPoint = filteredPoints.find(
            (point) => currentTime < point.Position
          )
          if (nextPoint) {
            if (iframeRef.current) {
              iframeRef.current.scrollIntoView({ behavior: 'smooth' })
            }
            videoObject.seekTo(nextPoint.Position / 1000, true)
          }
        }
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [videoObject, autoplayEnabled, filterList, returnFilteredPoints])

  const handleBookmark = async (point) => {
    const updatedPoints = matchData.pointsJson.map((p) => {
      if (p.Name === point.Name) {
        return { ...p, bookmarked: !p.bookmarked }
      }
      return p
    })

    setMatchData((prev) => ({ ...prev, pointsJson: updatedPoints }))
    setBookmarks(updatedPoints.filter((p) => p.bookmarked))

    try {
      await updateMatch(docId, { pointsJson: updatedPoints })
    } catch (error) {
      console.error('Error updating bookmarks:', error)
    }
  }

  useEffect(() => {
    if (matchData) {
      const points = returnFilteredPoints()
      const sortedPoints = [...points].sort((a, b) => b.Position - a.Position)

      const updateScoreboardWithTime = (time) => {
        const currentPoint = sortedPoints.find(
          (point) => point.Position <= time
        )
        if (currentPoint) {
          setPlayingPoint(currentPoint)
        }
      }

      const intervalId = setInterval(() => {
        if (videoObject && videoObject.getCurrentTime) {
          const currentTime = videoObject.getCurrentTime() * 1000
          updateScoreboardWithTime(currentTime)
        }
      }, 200)

      return () => clearInterval(intervalId)
    }
  }, [videoObject, matchData, returnFilteredPoints])

  useEffect(() => {
    if (triggerScroll && !showPDF) {
      if (tableRef.current) {
        tableRef.current.scrollIntoView({ behavior: 'smooth' })
      }
      setTriggerScroll(false)
    }
  }, [triggerScroll, showPDF])

  const removeFilter = (key, value) => {
    const updatedFilterList = filterList.filter(
      ([filterKey, filterValue]) =>
        !(filterKey === key && filterValue === value)
    )
    setFilterList(updatedFilterList)
  }

  const scrollToDetailedList = () => {
    setShowPDF(false)
    setTriggerScroll(true)
  }

  const sortedFilterList = filterList.sort((a, b) => a[0].localeCompare(b[0]))

  function addBorderRadius() {
    console.log('adding border radius')
    const anyIframe = document.getElementById('player')
    if (anyIframe) {
      console.log('found iframe:', anyIframe)
      anyIframe.style.borderRadius = '10px'
    }
  }

  const getMatchScores = (pointsJson) => {
    if (!pointsJson || !pointsJson.length) return []

    // Group points by set and get the last point of each set
    return (
      Object.values(
        pointsJson.reduce((acc, point) => {
          if (
            !acc[point.setNum] ||
            point.Position > acc[point.setNum].Position
          ) {
            acc[point.setNum] = point
          }
          return acc
        }, {})
      )
        // Sort by set number
        .sort((a, b) => a.setNum - b.setNum)
        // Map to score arrays, filtering out 0-0 scores
        .map((point) => {
          if (!point.gameScore || point.gameScore === '0-0') return null
          return point.gameScore.split('-').map(Number)
        })
        .filter(Boolean)
    )
  }

  // Usage in your component:
  console.log(matchData)
  const matchScores = matchData ? getMatchScores(matchData.pointsJson) : []

  return (
    <div className={styles.container}>
      {isInitialLoad ? (
        <Loading prompt={'Fetching match...'} />
      ) : error ? (
        <div
          className={styles.card}
          style={{ margin: 0, maxWidth: '560px', marginTop: '-120px' }}
        >
          <h3>{error === 'not-found' ? 'Match Not Found' : 'Access Denied'}</h3>
          <p>
            {error === 'not-found'
              ? 'The match you are looking for does not exist or has been removed. You may be logged into the wrong account. Please try again.'
              : 'You may be logged into the wrong account. Please check your login and try again.'}
          </p>
        </div>
      ) : matchData ? (
        <>
          <MatchTiles
            matchName={matchData.matchDetails.event}
            clientTeam={matchData.teams.clientTeam}
            opponentTeam={matchData.teams.opponentTeam}
            matchDetails={
              matchData.matchDetails.event ?? matchData.matchDetails.venue
            }
            date={new Date(matchData.matchDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
            player1UTR={matchData.players.client.UTR}
            player2UTR={matchData.players.opponent.UTR}
            player1Name={
              matchData.players.client.firstName +
              ' ' +
              matchData.players.client.lastName
            }
            player2Name={
              matchData.players.opponent.firstName +
              ' ' +
              matchData.players.opponent.lastName
            }
            player1FinalScores={matchData.sets.map((set) => ({
              score: set.clientGames
            }))}
            player2FinalScores={matchData.sets.map((set) => ({
              score: set.opponentGames
            }))}
            player1TieScores={matchData.pointsJson.map(
              (point) => point.player1TiebreakScore
            )}
            player2TieScores={matchData.pointsJson.map(
              (point) => point.player2TiebreakScore
            )}
            isUnfinished={matchData.matchDetails.unfinished}
            displaySections={{ score: true, info: true, matchup: true }}
          />
          <div className={styles.headerRow}>
            <div className={styles.titleContainer}>
              <h2>{matchData.name}</h2>
            </div>
          </div>
          <div className={styles.mainContent}>
            <div className={styles.videoPlayer}>
              <div ref={iframeRef}>
                <VideoPlayer
                  id="player"
                  videoId={matchData.videoId}
                  setVideoObject={setVideoObject}
                  onReady={addBorderRadius}
                />
              </div>
            </div>
            <div className={styles.sidebar}>
              <div className={filterListStyles.activeFilterListContainer}>
                Active Filters:
                <ul className={filterListStyles.activeFilterList}>
                  {sortedFilterList.map(([key, value]) => (
                    <li
                      className={filterListStyles.activeFilterItem}
                      key={`${key}-${value}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => removeFilter(key, value)}
                    >
                      {findDisplayName(key)}: {value}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => setTab(0)}
                className={
                  tab === 0
                    ? styles.toggle_button_neutral_active
                    : styles.toggle_button_neutral_inactive
                }
              >
                Filters
              </button>
              <button
                onClick={() => setTab(1)}
                className={
                  tab === 1
                    ? styles.toggle_button_neutral_active
                    : styles.toggle_button_neutral_inactive
                }
              >
                Points
              </button>
              <button
                onClick={() => setTab(2)}
                className={
                  tab === 2
                    ? styles.toggle_button_neutral_active
                    : styles.toggle_button_neutral_inactive
                }
              >
                Saved
              </button>
              <button
                onClick={() => setAutoplayEnabled((prev) => !prev)}
                className={
                  autoplayEnabled
                    ? styles.toggle_button_autoplay_active
                    : styles.toggle_button_neutral_inactive
                }
              >
                Autoplay
              </button>

              {tab === 0 && (
                <div className={styles.sidebox}>
                  <div className={styles.sidecontent}>
                    <div className={filterListStyles.optionsList}>
                      <div>
                        <input
                          type="radio"
                          id="defaultRadio"
                          checked={!showCount && !showPercent}
                          onChange={() => {
                            setShowPercent(false)
                            setShowCount(false)
                          }}
                        />
                        <label htmlFor="defaultRadio">Default</label>
                      </div>
                      <div>
                        <input
                          type="radio"
                          id="percentRadio"
                          checked={showPercent}
                          onChange={() => {
                            setShowPercent(true)
                            setShowCount(false)
                          }}
                        />
                        <label htmlFor="percentRadio">Show Percent</label>
                      </div>
                      <div>
                        <input
                          type="radio"
                          id="countRadio"
                          checked={showCount}
                          onChange={() => {
                            setShowPercent(false)
                            setShowCount(true)
                          }}
                        />
                        <label htmlFor="countRadio">Show Count</label>
                      </div>
                    </div>
                    <FilterList
                      pointsData={matchData.pointsJson}
                      filterList={filterList}
                      setFilterList={setFilterList}
                      showPercent={showPercent}
                      showCount={showCount}
                    />
                  </div>
                </div>
              )}
              {tab === 1 && (
                <div className={styles.sidebox}>
                  <div className={styles.sidecontent}>
                    <PointsList
                      pointsData={returnFilteredPoints()}
                      onPointSelect={handleJumpToTime}
                      onBookmark={handleBookmark}
                      clientTeam={matchData.teams.clientTeam}
                      opponentTeam={matchData.teams.opponentTeam}
                    />
                  </div>
                  <div
                    style={{
                      padding: '0.5vw',
                      textAlign: 'center'
                    }}
                  >
                    <button
                      className={styles.viewDetailedListButton}
                      onClick={scrollToDetailedList}
                    >
                      View Detailed List
                    </button>
                  </div>
                </div>
              )}
              {tab === 2 && (
                <div className={styles.sidebox}>
                  <div className={styles.sidecontent}>
                    <PointsList
                      pointsData={bookmarks}
                      onPointSelect={handleJumpToTime}
                      onBookmark={handleBookmark}
                      clientTeam={matchData.teams.clientTeam}
                      opponentTeam={matchData.teams.opponentTeam}
                    />
                  </div>
                  <div
                    style={{
                      padding: '0.5vw',
                      textAlign: 'center'
                    }}
                  >
                    <button
                      className={styles.viewDetailedListButton}
                      onClick={scrollToDetailedList}
                    >
                      View Detailed List
                    </button>
                  </div>
                </div>
              )}
              <div className="scoreboard">
                <ScoreBoard
                  names={matchData.name}
                  playData={playingPoint}
                  player1Name={
                    matchData.players.client.firstName +
                    ' ' +
                    matchData.players.client.lastName
                  }
                  player2Name={
                    matchData.players.opponent.firstName +
                    ' ' +
                    matchData.players.opponent.lastName
                  }
                  player1FinalScores={matchScores.map((scores) => ({
                    score: scores[0]
                  }))}
                  player2FinalScores={matchScores.map((scores) => ({
                    score: scores[1]
                  }))}
                  player1TieScores={matchData.pointsJson.map(
                    (point) => point.player1TiebreakScore
                  )}
                  player2TieScores={matchData.pointsJson.map(
                    (point) => point.player2TiebreakScore
                  )}
                  isUnfinished={matchData.matchDetails.unfinished}
                  displaySections={{ score: true, info: true, matchup: true }}
                />
              </div>
            </div>
          </div>
          <div className={styles.toggle}>
            <button
              onClick={() => setShowPDF(true)}
              className={
                showPDF
                  ? styles.toggle_buttonb_inactive
                  : styles.toggle_buttonb_active
              }
            >
              Key Stats & Visuals
            </button>
            <button
              onClick={() => setShowPDF(false)}
              className={
                showPDF
                  ? styles.toggle_buttona_active
                  : styles.toggle_buttona_inactive
              }
            >
              Detailed Point List
            </button>
            {showPDF ? (
              <iframe
                className={styles.pdfView}
                src={matchData.pdfFile}
                width="90%"
                height="1550"
              />
            ) : (
              <div ref={tableRef} className={styles.ExtendedList}>
                <ExtendedList
                  pointsData={returnFilteredPoints()}
                  clientTeam={matchData.teams.clientTeam}
                  opponentTeam={matchData.teams.opponentTeam}
                  onPointSelect={handleJumpToTime}
                  iframe={iframeRef}
                />
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}

export default MatchPage
