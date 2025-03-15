// // script.js
// // Contains functions to calculate a rich set of tennis match stats,
// // including detailed serve and return analysis.

export function aggregateMatchStats(matches, manualStats = {}) {
  const playerStats = {}

  // Filter matches to only include published ones
  const publishedMatches = matches.filter((match) => match.published)

  // Helper function that initializes stats for a given player and year.
  const initPlayerYear = (player, year) => {
    if (!player) return
    if (!playerStats[player]) playerStats[player] = {}
    if (!playerStats[player][year]) {
      playerStats[player][year] = {
        matchesPlayed: 0,
        totalPoints: 0,
        servePoints: 0,
        returnPoints: 0,
        // First serve stats:
        firstServeAttempts: 0,
        firstServeInCount: 0,
        firstServeFaults: 0,
        firstServeWins: 0,
        // Second serve stats:
        secondServeAttempts: 0,
        secondServeInCount: 0,
        secondServeFaults: 0,
        secondServeWins: 0,
        // Double faults:
        doubleFaults: 0,
        // Other serve stats:
        aces: 0,
        downTheT: 0,
        breakPointOpportunities: 0,
        breakPointSaved: 0,
        // Overall shot stats:
        winners: 0,
        unforcedErrors: 0,
        // Rally stats:
        totalRallyCount: 0,
        rallyCountPoints: 0,
        // Serve placement coordinates (first & second):
        sumFirstServeX: 0,
        sumFirstServeY: 0,
        firstServeCountForPlacement: 0,
        sumSecondServeX: 0,
        sumSecondServeY: 0,
        secondServeCountForPlacement: 0,
        // Return stats:
        returnWinners: 0
      }
    }
  }

  // Iterate over each match and update player stats.
  publishedMatches.forEach((match) => {
    const year = match.matchDate ? match.matchDate.substring(0, 4) : 'unknown'

    // Extract player names from match object (formatting)
    const player1 =
      `${match.players?.client?.firstName || ''} ${match.players?.client?.lastName || ''}`.trim()
    const player2 =
      `${match.players?.opponent?.firstName || ''} ${match.players?.opponent?.lastName || ''}`.trim()
    const players = [player1, player2]

    // Initialize stats for each player in this match/year and increment match count.
    players.forEach((player) => {
      if (!player) return
      initPlayerYear(player, year)
      playerStats[player][year].matchesPlayed += 1
    })

    // Process every point in the match (if any)
    const points = match.pointsJson || []
    points.forEach((point) => {
      // Update total points and rally info for both players.
      players.forEach((player) => {
        if (!player) return
        initPlayerYear(player, year)
        playerStats[player][year].totalPoints += 1
        if (point.rallyCount !== undefined && point.rallyCount !== null) {
          playerStats[player][year].totalRallyCount += point.rallyCount
          playerStats[player][year].rallyCountPoints += 1
        }
      })

      // Determine server and receiver.
      const server = point.serverName
      const receiver = players.find((p) => p !== server)

      // --- Update server stats ---
      if (server && playerStats[server] && playerStats[server][year]) {
        const stats = playerStats[server][year]
        stats.servePoints++

        // Process first serve data if available.
        if (point.firstServeIn !== undefined) {
          stats.firstServeAttempts++
          if (point.firstServeIn === true || point.firstServeIn === 1) {
            stats.firstServeInCount++
            // Record placement if available.
            if (
              point.firstServeXCoord !== undefined &&
              point.firstServeYCoord !== undefined
            ) {
              stats.sumFirstServeX += point.firstServeXCoord
              stats.sumFirstServeY += point.firstServeYCoord
              stats.firstServeCountForPlacement++
            }
            // If server won the point on a good first serve.
            if (point.pointWonBy === server) {
              stats.firstServeWins++
            }
          } else {
            stats.firstServeFaults++
          }
          // Check if serve was hit "down the T"
          if (
            point.firstServeZone &&
            point.firstServeZone.toLowerCase() === 't'
          ) {
            stats.downTheT++
          }
        }

        // Process second serve data
        if (point.secondServeIn !== undefined) {
          stats.secondServeAttempts++
          if (point.secondServeIn === true || point.secondServeIn === 1) {
            stats.secondServeInCount++
            if (
              point.secondServeXCoord !== undefined &&
              point.secondServeYCoord !== undefined
            ) {
              stats.sumSecondServeX += point.secondServeXCoord
              stats.sumSecondServeY += point.secondServeYCoord
              stats.secondServeCountForPlacement++
            }
            if (point.pointWonBy === server) {
              stats.secondServeWins++
            }
          } else {
            stats.secondServeFaults++
          }
          // If both serves failed, count as a double fault.
          if (
            (point.firstServeIn === false || point.firstServeIn === 0) &&
            (point.secondServeIn === false || point.secondServeIn === 0)
          ) {
            stats.doubleFaults++
          }
        }

        // Break point stats
        if (point.isBreakPoint) {
          stats.breakPointOpportunities++
          if (point.pointWonBy === server) {
            stats.breakPointSaved++
          }
        }

        // Count aces
        if (point.isAce && point.pointWonBy === server) {
          stats.aces++
        }

        // Count winners and unforced errors by the server.
        if (point.lastShotResult) {
          const result = point.lastShotResult.toLowerCase()
          if (result === 'winner' && point.lastShotHitBy === server) {
            stats.winners++
          }
          if (result === 'error' && point.lastShotHitBy === server) {
            stats.unforcedErrors++
          }
        }
      }

      // --- Update receiver stats ---
      if (receiver && playerStats[receiver] && playerStats[receiver][year]) {
        const rStats = playerStats[receiver][year]
        rStats.returnPoints++
        if (point.lastShotResult) {
          const result = point.lastShotResult.toLowerCase()
          if (result === 'winner' && point.lastShotHitBy === receiver) {
            rStats.winners++
            rStats.returnWinners++
          }
          if (result === 'error' && point.lastShotHitBy === receiver) {
            rStats.unforcedErrors++
          }
        }
      }
    })
  })

  // Incorporate manual adjustments (e.g., matches outside of the website)
  Object.keys(manualStats).forEach((player) => {
    const adjustments = manualStats[player]
    if (playerStats[player]) {
      Object.keys(playerStats[player]).forEach((year) => {
        const stats = playerStats[player][year]
        if (adjustments.aces) {
          stats.aces += adjustments.aces
        }
        // You can extend for additional manual adjustments...
      })
    } else {
      // If player did not appear in the online data, add them manually.
      playerStats[player] = { manual: adjustments }
    }
  })

  // Computing derived percentages and averages.
  Object.keys(playerStats).forEach((player) => {
    Object.keys(playerStats[player]).forEach((year) => {
      const stats = playerStats[player][year]

      stats.firstServePercentage = stats.firstServeAttempts
        ? (stats.firstServeInCount / stats.firstServeAttempts) * 100
        : 0
      stats.firstServeWinPercentage = stats.firstServeInCount
        ? (stats.firstServeWins / stats.firstServeInCount) * 100
        : 0
      stats.secondServePercentage = stats.secondServeAttempts
        ? (stats.secondServeInCount / stats.secondServeAttempts) * 100
        : 0
      stats.secondServeWinPercentage = stats.secondServeInCount
        ? (stats.secondServeWins / stats.secondServeInCount) * 100
        : 0
      stats.doubleFaultRate = stats.secondServeAttempts
        ? (stats.doubleFaults / stats.secondServeAttempts) * 100
        : 0
      stats.breakPointSavePercentage = stats.breakPointOpportunities
        ? (stats.breakPointSaved / stats.breakPointOpportunities) * 100
        : 0
      stats.averageRallyLength = stats.rallyCountPoints
        ? stats.totalRallyCount / stats.rallyCountPoints
        : 0
      stats.averageFirstServeX = stats.firstServeCountForPlacement
        ? stats.sumFirstServeX / stats.firstServeCountForPlacement
        : 0
      stats.averageFirstServeY = stats.firstServeCountForPlacement
        ? stats.sumFirstServeY / stats.firstServeCountForPlacement
        : 0
      stats.averageSecondServeX = stats.secondServeCountForPlacement
        ? stats.sumSecondServeX / stats.secondServeCountForPlacement
        : 0
      stats.averageSecondServeY = stats.secondServeCountForPlacement
        ? stats.sumSecondServeY / stats.secondServeCountForPlacement
        : 0
    })
  })

  return playerStats
}

export function exportStatsToCSV(aggregatedStats) {
  // Build a CSV string from the aggregated stats object.
  // The CSV will include columns for all the stats computed.
  const headers = [
    'Player',
    'Year',
    'MatchesPlayed',
    'TotalPoints',
    'ServePoints',
    'ReturnPoints',
    'FirstServeAttempts',
    'FirstServeInCount',
    'FirstServeFaults',
    'FirstServePercentage',
    'FirstServeWins',
    'FirstServeWinPercentage',
    'SecondServeAttempts',
    'SecondServeInCount',
    'SecondServeFaults',
    'SecondServeWins',
    'SecondServePercentage',
    'SecondServeWinPercentage',
    'DoubleFaults',
    'DoubleFaultRate',
    'Aces',
    'DownTheT',
    'BreakPointOpportunities',
    'BreakPointSaved',
    'BreakPointSavePercentage',
    'ReturnWinners',
    'Winners',
    'UnforcedErrors',
    'TotalRallyCount',
    'RallyCountPoints',
    'AverageRallyLength',
    'AverageFirstServeX',
    'AverageFirstServeY',
    'AverageSecondServeX',
    'AverageSecondServeY'
  ]
  const rows = [headers.join(',')]

  Object.keys(aggregatedStats).forEach((player) => {
    Object.keys(aggregatedStats[player]).forEach((year) => {
      const s = aggregatedStats[player][year]
      const row = [
        player,
        year,
        s.matchesPlayed,
        s.totalPoints,
        s.servePoints,
        s.returnPoints,
        s.firstServeAttempts,
        s.firstServeInCount,
        s.firstServeFaults,
        s.firstServePercentage.toFixed(2),
        s.firstServeWins,
        s.firstServeWinPercentage.toFixed(2),
        s.secondServeAttempts,
        s.secondServeInCount,
        s.secondServeFaults,
        s.secondServeWins,
        s.secondServePercentage.toFixed(2),
        s.secondServeWinPercentage.toFixed(2),
        s.doubleFaults,
        s.doubleFaultRate.toFixed(2),
        s.aces,
        s.downTheT,
        s.breakPointOpportunities,
        s.breakPointSaved,
        s.breakPointSavePercentage.toFixed(2),
        s.returnWinners,
        s.winners,
        s.unforcedErrors,
        s.totalRallyCount,
        s.rallyCountPoints,
        s.averageRallyLength.toFixed(2),
        s.averageFirstServeX.toFixed(2),
        s.averageFirstServeY.toFixed(2),
        s.averageSecondServeX.toFixed(2),
        s.averageSecondServeY.toFixed(2)
      ]
      rows.push(row.join(','))
    })
  })

  return rows.join('\n')
}

// matchStats.js
// Script to calculate detailed tennis match statistics with each row representing a match
// and containing comprehensive stats for both players
//
// This script produces an array of match statistics objects where each object represents
// a single tennis match with detailed metrics for both players. The data is organized
// with player1 and player2 fields, making it easy to analyze match-by-match performance.

/**
 * Calculate detailed statistics for each tennis match
 * @param {Array} matches - Array of match objects
 * @returns {Array} Array of match statistics objects
 */
export function calculateMatchStats(matches) {
  const matchStats = []

  // Process each match individually
  matches.forEach((match) => {
    // Skip unpublished matches if needed
    if (!match.published) return

    // Extract basic match information
    const matchId = match.id || 'unknown'
    const matchDate = match.matchDate || 'unknown'
    const surface = match.matchDetails?.surface || 'unknown'
    const event = match.matchDetails?.event || 'unknown'
    const division = match.matchDetails?.division || 'unknown'
    const venue = match.matchDetails?.matchVenue || 'unknown'

    // Extract player names
    const player1Name =
      `${match.players?.client?.firstName || ''} ${match.players?.client?.lastName || ''}`.trim()
    const player2Name =
      `${match.players?.opponent?.firstName || ''} ${match.players?.opponent?.lastName || ''}`.trim()

    // Initialize stats objects for both players
    const player1Stats = initPlayerStats()
    const player2Stats = initPlayerStats()

    // Map player names to their stats objects
    const playerStatsMap = {
      [player1Name]: player1Stats,
      [player2Name]: player2Stats
    }

    // Initialize set-specific tracking
    const setTracking = {}

    // Initialize game tracking
    let currentSet = '1'
    let currentGame = 0
    let serverInCurrentGame = null
    let pointsInCurrentGame = []

    // Process each point in the match
    const points = match.pointsJson || []
    points.forEach((point, index) => {
      // Track set information
      if (point.setNum) {
        currentSet = point.setNum.toString()
      }

      // Ensure set exists in tracking
      if (!setTracking[currentSet]) {
        setTracking[currentSet] = {
          player1GamesWon: 0,
          player2GamesWon: 0,
          player1PointsWon: 0,
          player2PointsWon: 0
        }
      }

      // Determine server and receiver for this point
      const serverName = point.serverName
      const receiverName =
        serverName === player1Name ? player2Name : player1Name

      // Skip points with missing server information
      if (!serverName || !playerStatsMap[serverName]) return

      // Game tracking
      if (point.gameNumber && point.gameNumber !== currentGame) {
        // Process previous game if we have points
        if (pointsInCurrentGame.length > 0 && serverInCurrentGame) {
          const gameWinner = determineGameWinner(pointsInCurrentGame)
          if (gameWinner) {
            if (gameWinner === player1Name) {
              setTracking[currentSet].player1GamesWon++
              if (serverInCurrentGame === player2Name) {
                player1Stats.returnGamesWon++
                player2Stats.serviceGamesLost++
              } else {
                player1Stats.serviceGamesWon++
                player2Stats.returnGamesLost++
              }
            } else if (gameWinner === player2Name) {
              setTracking[currentSet].player2GamesWon++
              if (serverInCurrentGame === player1Name) {
                player2Stats.returnGamesWon++
                player1Stats.serviceGamesLost++
              } else {
                player2Stats.serviceGamesWon++
                player1Stats.returnGamesLost++
              }
            }
          }
        }

        // Reset for new game
        currentGame = point.gameNumber
        serverInCurrentGame = serverName
        pointsInCurrentGame = [point]
      } else {
        // Add point to current game
        pointsInCurrentGame.push(point)
      }

      // Get stats objects for server and receiver
      const serverStats = playerStatsMap[serverName]
      const receiverStats = playerStatsMap[receiverName]

      // Update total points for both players
      serverStats.totalPoints++
      receiverStats.totalPoints++

      // Update points won
      if (point.pointWonBy) {
        if (point.pointWonBy === player1Name) {
          player1Stats.pointsWon++
          setTracking[currentSet].player1PointsWon++
        } else if (point.pointWonBy === player2Name) {
          player2Stats.pointsWon++
          setTracking[currentSet].player2PointsWon++
        }
      }

      // Update rally stats if available
      if (point.rallyCount !== undefined && point.rallyCount !== null) {
        serverStats.totalRallyCount += point.rallyCount
        serverStats.rallyCountPoints++
        receiverStats.totalRallyCount += point.rallyCount
        receiverStats.rallyCountPoints++

        // Track rally length categories
        const rallyLength = point.rallyCount
        if (rallyLength <= 4) {
          serverStats.shortRallies++
          receiverStats.shortRallies++
          if (point.pointWonBy === serverName) {
            serverStats.shortRalliesWon++
          } else if (point.pointWonBy === receiverName) {
            receiverStats.shortRalliesWon++
          }
        } else if (rallyLength <= 8) {
          serverStats.mediumRallies++
          receiverStats.mediumRallies++
          if (point.pointWonBy === serverName) {
            serverStats.mediumRalliesWon++
          } else if (point.pointWonBy === receiverName) {
            receiverStats.mediumRalliesWon++
          }
        } else {
          serverStats.longRallies++
          receiverStats.longRallies++
          if (point.pointWonBy === serverName) {
            serverStats.longRalliesWon++
          } else if (point.pointWonBy === receiverName) {
            receiverStats.longRalliesWon++
          }
        }
      }

      // Update server-specific stats
      serverStats.servePoints++

      // Process first serve data
      processFirstServe(point, serverName, serverStats)

      // Process second serve data
      processSecondServe(point, serverName, serverStats)

      // Process break points
      processBreakPoint(point, serverName, serverStats)

      // Process aces
      if (point.isAce && point.pointWonBy === serverName) {
        serverStats.aces++
      }

      // Process net points
      if (
        point.atNetPlayer1 === serverName ||
        point.atNetPlayer2 === serverName
      ) {
        serverStats.netApproaches++
        if (point.pointWonBy === serverName) {
          serverStats.netPointsWon++
        }
      }

      if (
        point.atNetPlayer1 === receiverName ||
        point.atNetPlayer2 === receiverName
      ) {
        receiverStats.netApproaches++
        if (point.pointWonBy === receiverName) {
          receiverStats.netPointsWon++
        }
      }

      // Process serve directions
      if (
        (point.firstServeIn === true || point.firstServeIn === 1) &&
        point.firstServeZone
      ) {
        const zone = point.firstServeZone.toLowerCase()
        if (zone === 't') {
          serverStats.servesToT++
        } else if (zone === 'body') {
          serverStats.servesToBody++
        } else if (zone === 'wide') {
          serverStats.servesToWide++
        }
      }

      // Process shot types and results
      processShotTypes(
        point,
        serverName,
        serverStats,
        receiverName,
        receiverStats
      )

      // Process winners and errors
      processWinnersAndErrors(
        point,
        serverName,
        serverStats,
        receiverName,
        receiverStats
      )

      // Update receiver-specific stats
      receiverStats.returnPoints++

      // Process return directions
      if (point.returnDirection) {
        const direction = point.returnDirection.toLowerCase()
        if (direction === 'down the line') {
          receiverStats.returnsDownTheLine++
        } else if (direction === 'crosscourt') {
          receiverStats.returnsCrosscourt++
        }
      }
    })

    // Process the final game
    if (pointsInCurrentGame.length > 0 && serverInCurrentGame) {
      const gameWinner = determineGameWinner(pointsInCurrentGame)
      if (gameWinner) {
        if (gameWinner === player1Name) {
          setTracking[currentSet].player1GamesWon++
          if (serverInCurrentGame === player2Name) {
            player1Stats.returnGamesWon++
            player2Stats.serviceGamesLost++
          } else {
            player1Stats.serviceGamesWon++
            player2Stats.returnGamesLost++
          }
        } else if (gameWinner === player2Name) {
          setTracking[currentSet].player2GamesWon++
          if (serverInCurrentGame === player1Name) {
            player2Stats.returnGamesWon++
            player1Stats.serviceGamesLost++
          } else {
            player2Stats.serviceGamesWon++
            player1Stats.returnGamesLost++
          }
        }
      }
    }

    // Determine match winner based on sets won
    const setsWonByPlayer1 = Object.values(setTracking).filter(
      (set) => set.player1GamesWon > set.player2GamesWon
    ).length

    const setsWonByPlayer2 = Object.values(setTracking).filter(
      (set) => set.player2GamesWon > set.player1GamesWon
    ).length

    const matchWinner =
      setsWonByPlayer1 > setsWonByPlayer2 ? player1Name : player2Name

    // Calculate derived stats for both players
    calculateDerivedStats(player1Stats)
    calculateDerivedStats(player2Stats)

    // Create match stats object
    const matchStat = {
      matchId,
      matchDate,
      surface,
      event,
      division,
      venue,
      player1: player1Name,
      player2: player2Name,
      matchWinner,
      score: formatMatchScore(setTracking),

      // Player 1 stats
      player1_pointsPlayed: player1Stats.totalPoints,
      player1_pointsWon: player1Stats.pointsWon,
      player1_pointsWonPercentage:
        player1Stats.totalPoints > 0
          ? (player1Stats.pointsWon / player1Stats.totalPoints) * 100
          : 0,
      player1_servePoints: player1Stats.servePoints,
      player1_returnPoints: player1Stats.returnPoints,

      // First serve stats
      player1_firstServeAttempts: player1Stats.firstServeAttempts,
      player1_firstServeInCount: player1Stats.firstServeInCount,
      player1_firstServePercentage: player1Stats.firstServePercentage,
      player1_firstServeWins: player1Stats.firstServeWins,
      player1_firstServeWinPercentage: player1Stats.firstServeWinPercentage,

      // Second serve stats
      player1_secondServeAttempts: player1Stats.secondServeAttempts,
      player1_secondServeInCount: player1Stats.secondServeInCount,
      player1_secondServePercentage: player1Stats.secondServePercentage,
      player1_secondServeWins: player1Stats.secondServeWins,
      player1_secondServeWinPercentage: player1Stats.secondServeWinPercentage,

      // Other serve stats
      player1_doubleFaults: player1Stats.doubleFaults,
      player1_doubleFaultRate: player1Stats.doubleFaultRate,
      player1_aces: player1Stats.aces,
      player1_servesToT: player1Stats.servesToT,
      player1_servesToBody: player1Stats.servesToBody,
      player1_servesToWide: player1Stats.servesToWide,

      // Game stats
      player1_serviceGamesPlayed:
        player1Stats.serviceGamesWon + player1Stats.serviceGamesLost,
      player1_serviceGamesWon: player1Stats.serviceGamesWon,
      player1_serviceGamesWonPercentage:
        player1Stats.serviceGamesWon + player1Stats.serviceGamesLost > 0
          ? (player1Stats.serviceGamesWon /
              (player1Stats.serviceGamesWon + player1Stats.serviceGamesLost)) *
            100
          : 0,
      player1_returnGamesPlayed:
        player1Stats.returnGamesWon + player1Stats.returnGamesLost,
      player1_returnGamesWon: player1Stats.returnGamesWon,
      player1_returnGamesWonPercentage:
        player1Stats.returnGamesWon + player1Stats.returnGamesLost > 0
          ? (player1Stats.returnGamesWon /
              (player1Stats.returnGamesWon + player1Stats.returnGamesLost)) *
            100
          : 0,

      // Break points
      player1_breakPointOpportunities: player1Stats.breakPointOpportunities,
      player1_breakPointsConverted: player1Stats.returnGamesWon,
      player1_breakPointConversionRate:
        player1Stats.breakPointOpportunities > 0
          ? (player1Stats.returnGamesWon /
              player1Stats.breakPointOpportunities) *
            100
          : 0,
      player1_breakPointSaved: player1Stats.breakPointSaved,
      player1_breakPointSavePercentage: player1Stats.breakPointSavePercentage,

      // Shot stats
      player1_winners: player1Stats.winners,
      player1_forehandWinners: player1Stats.forehandWinners,
      player1_backhandWinners: player1Stats.backhandWinners,
      player1_unforcedErrors: player1Stats.unforcedErrors,
      player1_forehandErrors: player1Stats.forehandErrors,
      player1_backhandErrors: player1Stats.backhandErrors,
      player1_returnWinners: player1Stats.returnWinners,

      // Net stats
      player1_netApproaches: player1Stats.netApproaches,
      player1_netPointsWon: player1Stats.netPointsWon,
      player1_netPointsWonPercentage:
        player1Stats.netApproaches > 0
          ? (player1Stats.netPointsWon / player1Stats.netApproaches) * 100
          : 0,

      // Return stats
      player1_returnsDownTheLine: player1Stats.returnsDownTheLine,
      player1_returnsCrosscourt: player1Stats.returnsCrosscourt,

      // Rally stats
      player1_shortRallies: player1Stats.shortRallies,
      player1_shortRalliesWon: player1Stats.shortRalliesWon,
      player1_shortRalliesWonPercentage:
        player1Stats.shortRallies > 0
          ? (player1Stats.shortRalliesWon / player1Stats.shortRallies) * 100
          : 0,
      player1_mediumRallies: player1Stats.mediumRallies,
      player1_mediumRalliesWon: player1Stats.mediumRalliesWon,
      player1_mediumRalliesWonPercentage:
        player1Stats.mediumRallies > 0
          ? (player1Stats.mediumRalliesWon / player1Stats.mediumRallies) * 100
          : 0,
      player1_longRallies: player1Stats.longRallies,
      player1_longRalliesWon: player1Stats.longRalliesWon,
      player1_longRalliesWonPercentage:
        player1Stats.longRallies > 0
          ? (player1Stats.longRalliesWon / player1Stats.longRallies) * 100
          : 0,
      player1_averageRallyLength: player1Stats.averageRallyLength,

      // Serve placement
      player1_averageFirstServeX: player1Stats.averageFirstServeX,
      player1_averageFirstServeY: player1Stats.averageFirstServeY,
      player1_averageSecondServeX: player1Stats.averageSecondServeX,
      player1_averageSecondServeY: player1Stats.averageSecondServeY,

      // PLAYER 2 STATS (same structure as player 1)
      player2_pointsPlayed: player2Stats.totalPoints,
      player2_pointsWon: player2Stats.pointsWon,
      player2_pointsWonPercentage:
        player2Stats.totalPoints > 0
          ? (player2Stats.pointsWon / player2Stats.totalPoints) * 100
          : 0,
      player2_servePoints: player2Stats.servePoints,
      player2_returnPoints: player2Stats.returnPoints,

      // First serve stats
      player2_firstServeAttempts: player2Stats.firstServeAttempts,
      player2_firstServeInCount: player2Stats.firstServeInCount,
      player2_firstServePercentage: player2Stats.firstServePercentage,
      player2_firstServeWins: player2Stats.firstServeWins,
      player2_firstServeWinPercentage: player2Stats.firstServeWinPercentage,

      // Second serve stats
      player2_secondServeAttempts: player2Stats.secondServeAttempts,
      player2_secondServeInCount: player2Stats.secondServeInCount,
      player2_secondServePercentage: player2Stats.secondServePercentage,
      player2_secondServeWins: player2Stats.secondServeWins,
      player2_secondServeWinPercentage: player2Stats.secondServeWinPercentage,

      // Other serve stats
      player2_doubleFaults: player2Stats.doubleFaults,
      player2_doubleFaultRate: player2Stats.doubleFaultRate,
      player2_aces: player2Stats.aces,
      player2_servesToT: player2Stats.servesToT,
      player2_servesToBody: player2Stats.servesToBody,
      player2_servesToWide: player2Stats.servesToWide,

      // Game stats
      player2_serviceGamesPlayed:
        player2Stats.serviceGamesWon + player2Stats.serviceGamesLost,
      player2_serviceGamesWon: player2Stats.serviceGamesWon,
      player2_serviceGamesWonPercentage:
        player2Stats.serviceGamesWon + player2Stats.serviceGamesLost > 0
          ? (player2Stats.serviceGamesWon /
              (player2Stats.serviceGamesWon + player2Stats.serviceGamesLost)) *
            100
          : 0,
      player2_returnGamesPlayed:
        player2Stats.returnGamesWon + player2Stats.returnGamesLost,
      player2_returnGamesWon: player2Stats.returnGamesWon,
      player2_returnGamesWonPercentage:
        player2Stats.returnGamesWon + player2Stats.returnGamesLost > 0
          ? (player2Stats.returnGamesWon /
              (player2Stats.returnGamesWon + player2Stats.returnGamesLost)) *
            100
          : 0,

      // Break points
      player2_breakPointOpportunities: player2Stats.breakPointOpportunities,
      player2_breakPointsConverted: player2Stats.returnGamesWon,
      player2_breakPointConversionRate:
        player2Stats.breakPointOpportunities > 0
          ? (player2Stats.returnGamesWon /
              player2Stats.breakPointOpportunities) *
            100
          : 0,
      player2_breakPointSaved: player2Stats.breakPointSaved,
      player2_breakPointSavePercentage: player2Stats.breakPointSavePercentage,

      // Shot stats
      player2_winners: player2Stats.winners,
      player2_forehandWinners: player2Stats.forehandWinners,
      player2_backhandWinners: player2Stats.backhandWinners,
      player2_unforcedErrors: player2Stats.unforcedErrors,
      player2_forehandErrors: player2Stats.forehandErrors,
      player2_backhandErrors: player2Stats.backhandErrors,
      player2_returnWinners: player2Stats.returnWinners,

      // Net stats
      player2_netApproaches: player2Stats.netApproaches,
      player2_netPointsWon: player2Stats.netPointsWon,
      player2_netPointsWonPercentage:
        player2Stats.netApproaches > 0
          ? (player2Stats.netPointsWon / player2Stats.netApproaches) * 100
          : 0,

      // Return stats
      player2_returnsDownTheLine: player2Stats.returnsDownTheLine,
      player2_returnsCrosscourt: player2Stats.returnsCrosscourt,

      // Rally stats
      player2_shortRallies: player2Stats.shortRallies,
      player2_shortRalliesWon: player2Stats.shortRalliesWon,
      player2_shortRalliesWonPercentage:
        player2Stats.shortRallies > 0
          ? (player2Stats.shortRalliesWon / player2Stats.shortRallies) * 100
          : 0,
      player2_mediumRallies: player2Stats.mediumRallies,
      player2_mediumRalliesWon: player2Stats.mediumRalliesWon,
      player2_mediumRalliesWonPercentage:
        player2Stats.mediumRallies > 0
          ? (player2Stats.mediumRalliesWon / player2Stats.mediumRallies) * 100
          : 0,
      player2_longRallies: player2Stats.longRallies,
      player2_longRalliesWon: player2Stats.longRalliesWon,
      player2_longRalliesWonPercentage:
        player2Stats.longRallies > 0
          ? (player2Stats.longRalliesWon / player2Stats.longRallies) * 100
          : 0,
      player2_averageRallyLength: player2Stats.averageRallyLength,

      // Serve placement
      player2_averageFirstServeX: player2Stats.averageFirstServeX,
      player2_averageFirstServeY: player2Stats.averageFirstServeY,
      player2_averageSecondServeX: player2Stats.averageSecondServeX,
      player2_averageSecondServeY: player2Stats.averageSecondServeY
    }

    // Add match stats to collection
    matchStats.push(matchStat)
  })

  return matchStats
}

/**
 * Process first serve data from a point
 */
function processFirstServe(point, serverName, serverStats) {
  if (point.firstServeIn !== undefined) {
    serverStats.firstServeAttempts++

    if (point.firstServeIn === true || point.firstServeIn === 1) {
      serverStats.firstServeInCount++

      // Record placement if available
      if (
        point.firstServeXCoord !== undefined &&
        point.firstServeYCoord !== undefined
      ) {
        serverStats.sumFirstServeX += point.firstServeXCoord
        serverStats.sumFirstServeY += point.firstServeYCoord
        serverStats.firstServeCountForPlacement++
      }

      // If server won the point on a good first serve
      if (point.pointWonBy === serverName) {
        serverStats.firstServeWins++
      }
    } else {
      serverStats.firstServeFaults++
    }
  }
}

/**
 * Process second serve data from a point
 */
function processSecondServe(point, serverName, serverStats) {
  if (point.secondServeIn !== undefined) {
    serverStats.secondServeAttempts++

    if (point.secondServeIn === true || point.secondServeIn === 1) {
      serverStats.secondServeInCount++

      // Record placement if available
      if (
        point.secondServeXCoord !== undefined &&
        point.secondServeYCoord !== undefined
      ) {
        serverStats.sumSecondServeX += point.secondServeXCoord
        serverStats.sumSecondServeY += point.secondServeYCoord
        serverStats.secondServeCountForPlacement++
      }

      // If server won the point on a second serve
      if (point.pointWonBy === serverName) {
        serverStats.secondServeWins++
      }
    } else {
      serverStats.secondServeFaults++

      // If both serves failed, count as a double fault
      if (
        (point.firstServeIn === false || point.firstServeIn === 0) &&
        (point.secondServeIn === false || point.secondServeIn === 0)
      ) {
        serverStats.doubleFaults++
      }
    }
  }
}

/**
 * Process break point data from a point
 */
function processBreakPoint(point, serverName, serverStats) {
  if (point.isBreakPoint) {
    serverStats.breakPointOpportunities++
    if (point.pointWonBy === serverName) {
      serverStats.breakPointSaved++
    }
  }
}

/**
 * Process shot types from a point
 */
function processShotTypes(
  point,
  serverName,
  serverStats,
  receiverName,
  receiverStats
) {
  // Process shot types like slices, dropshots, lobs, etc.
  if (point.isSlice && point.lastShotHitBy === serverName) {
    serverStats.slices = (serverStats.slices || 0) + 1
  } else if (point.isSlice && point.lastShotHitBy === receiverName) {
    receiverStats.slices = (receiverStats.slices || 0) + 1
  }

  if (point.isDropshot && point.lastShotHitBy === serverName) {
    serverStats.dropshots = (serverStats.dropshots || 0) + 1
  } else if (point.isDropshot && point.lastShotHitBy === receiverName) {
    receiverStats.dropshots = (receiverStats.dropshots || 0) + 1
  }

  if (point.isLob && point.lastShotHitBy === serverName) {
    serverStats.lobs = (serverStats.lobs || 0) + 1
  } else if (point.isLob && point.lastShotHitBy === receiverName) {
    receiverStats.lobs = (receiverStats.lobs || 0) + 1
  }

  if (point.isVolley && point.lastShotHitBy === serverName) {
    serverStats.volleys = (serverStats.volleys || 0) + 1
  } else if (point.isVolley && point.lastShotHitBy === receiverName) {
    receiverStats.volleys = (receiverStats.volleys || 0) + 1
  }

  if (point.isOverhead && point.lastShotHitBy === serverName) {
    serverStats.overheads = (serverStats.overheads || 0) + 1
  } else if (point.isOverhead && point.lastShotHitBy === receiverName) {
    receiverStats.overheads = (receiverStats.overheads || 0) + 1
  }
}

/**
 * Process winners and errors from a point
 */
function processWinnersAndErrors(
  point,
  serverName,
  serverStats,
  receiverName,
  receiverStats
) {
  if (!point.lastShotResult) return

  const result = point.lastShotResult.toLowerCase()
  const shotBy = point.lastShotHitBy
  const shotType = point.lastShotFhBh ? point.lastShotFhBh.toLowerCase() : null

  // Process winners
  if (result === 'winner') {
    if (shotBy === serverName) {
      serverStats.winners++

      if (shotType === 'forehand') {
        serverStats.forehandWinners++
      } else if (shotType === 'backhand') {
        serverStats.backhandWinners++
      }

      // Check if this was a return winner (first shot after serve)
      if (point.shotInRally === 1 && shotBy === receiverName) {
        receiverStats.returnWinners++
      }
    } else if (shotBy === receiverName) {
      receiverStats.winners++

      if (shotType === 'forehand') {
        receiverStats.forehandWinners++
      } else if (shotType === 'backhand') {
        receiverStats.backhandWinners++
      }

      // Check if this was a return winner
      if (point.shotInRally === 1) {
        receiverStats.returnWinners++
      }
    }
  }

  // Process errors
  else if (result === 'error') {
    if (shotBy === serverName) {
      serverStats.unforcedErrors++

      if (shotType === 'forehand') {
        serverStats.forehandErrors++
      } else if (shotType === 'backhand') {
        serverStats.backhandErrors++
      }
    } else if (shotBy === receiverName) {
      receiverStats.unforcedErrors++

      if (shotType === 'forehand') {
        receiverStats.forehandErrors++
      } else if (shotType === 'backhand') {
        receiverStats.backhandErrors++
      }
    }
  }
}

/**
 * Determine the winner of a game from its points
 */
function determineGameWinner(points) {
  // Get the last point which should have the final score
  const lastPoint = points[points.length - 1]

  if (!lastPoint || !lastPoint.pointWonBy) {
    return null
  }

  // Simple approach: return the winner of the last point
  // For more complex scenarios (tiebreaks, etc.), this would need enhancement
  return lastPoint.pointWonBy
}

/**
 * Calculate derived statistics from raw counts
 */
function calculateDerivedStats(stats) {
  // First serve percentages
  stats.firstServePercentage = stats.firstServeAttempts
    ? (stats.firstServeInCount / stats.firstServeAttempts) * 100
    : 0

  stats.firstServeWinPercentage = stats.firstServeInCount
    ? (stats.firstServeWins / stats.firstServeInCount) * 100
    : 0

  // Second serve percentages
  stats.secondServePercentage = stats.secondServeAttempts
    ? (stats.secondServeInCount / stats.secondServeAttempts) * 100
    : 0

  stats.secondServeWinPercentage = stats.secondServeInCount
    ? (stats.secondServeWins / stats.secondServeInCount) * 100
    : 0

  // Double fault rate
  stats.doubleFaultRate = stats.secondServeAttempts
    ? (stats.doubleFaults / stats.secondServeAttempts) * 100
    : 0

  // Break point save percentage
  stats.breakPointSavePercentage = stats.breakPointOpportunities
    ? (stats.breakPointSaved / stats.breakPointOpportunities) * 100
    : 0

  // Average rally length
  stats.averageRallyLength = stats.rallyCountPoints
    ? stats.totalRallyCount / stats.rallyCountPoints
    : 0

  // Average serve placements
  stats.averageFirstServeX = stats.firstServeCountForPlacement
    ? stats.sumFirstServeX / stats.firstServeCountForPlacement
    : 0

  stats.averageFirstServeY = stats.firstServeCountForPlacement
    ? stats.sumFirstServeY / stats.firstServeCountForPlacement
    : 0

  stats.averageSecondServeX = stats.secondServeCountForPlacement
    ? stats.sumSecondServeX / stats.secondServeCountForPlacement
    : 0

  stats.averageSecondServeY = stats.secondServeCountForPlacement
    ? stats.sumSecondServeY / stats.secondServeCountForPlacement
    : 0
}

/**
 * Format a match score from set tracking object
 */
function formatMatchScore(setTracking) {
  return Object.keys(setTracking)
    .map((setNum) => {
      const set = setTracking[setNum]
      return `${set.player1GamesWon}-${set.player2GamesWon}`
    })
    .join(', ')
}

/**
 * Export match statistics to CSV format
 * @param {Array} matchStats - Array of match statistics objects
 * @returns {String} CSV-formatted string
 */
export function exportMatchStatsToCSV(matchStats) {
  if (!matchStats || matchStats.length === 0) {
    return ''
  }

  // Get headers from the first match's keys
  const headers = Object.keys(matchStats[0])
  const rows = [headers.join(',')]

  // Add each match as a row
  matchStats.forEach((match) => {
    const row = headers.map((header) => {
      const value = match[header]

      // Format all decimal numbers to 2 decimal places if they're demicals
      if (typeof value === 'number' && value % 1 !== 0) {
        return value.toFixed(2)
      }

      // Ensure strings with commas are properly quoted
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`
      }

      return value
    })

    rows.push(row.join(','))
  })

  return rows.join('\n')
}

/**
 * Initialize player stats object with all metrics
 */
function initPlayerStats() {
  return {
    totalPoints: 0,
    pointsWon: 0,
    servePoints: 0,
    returnPoints: 0,

    // First serve stats
    firstServeAttempts: 0,
    firstServeInCount: 0,
    firstServeFaults: 0,
    firstServeWins: 0,

    // Second serve stats
    secondServeAttempts: 0,
    secondServeInCount: 0,
    secondServeFaults: 0,
    secondServeWins: 0,

    // Other serve stats
    doubleFaults: 0,
    aces: 0,
    servesToT: 0,
    servesToBody: 0,
    servesToWide: 0,

    // Game stats
    serviceGamesWon: 0,
    serviceGamesLost: 0,
    returnGamesWon: 0,
    returnGamesLost: 0,

    // Break points
    breakPointOpportunities: 0,
    breakPointSaved: 0,

    // Shot stats
    winners: 0,
    forehandWinners: 0,
    backhandWinners: 0,
    unforcedErrors: 0,
    forehandErrors: 0,
    backhandErrors: 0,
    returnWinners: 0,

    // Net stats
    netApproaches: 0,
    netPointsWon: 0,

    // Return stats
    returnsDownTheLine: 0,
    returnsCrosscourt: 0,

    // Rally stats
    totalRallyCount: 0,
    rallyCountPoints: 0,
    shortRallies: 0,
    shortRalliesWon: 0,
    mediumRallies: 0,
    mediumRalliesWon: 0,
    longRallies: 0,
    longRalliesWon: 0,

    // Serve placement coordinates
    sumFirstServeX: 0,
    sumFirstServeY: 0,
    firstServeCountForPlacement: 0,
    sumSecondServeX: 0,
    sumSecondServeY: 0,
    secondServeCountForPlacement: 0,

    // Derived metrics (calculated later)
    firstServePercentage: 0,
    firstServeWinPercentage: 0,
    secondServePercentage: 0,
    secondServeWinPercentage: 0,
    doubleFaultRate: 0,
    breakPointSavePercentage: 0,
    averageRallyLength: 0,
    averageFirstServeX: 0,
    averageFirstServeY: 0,
    averageSecondServeX: 0,
    averageSecondServeY: 0
  }
}
