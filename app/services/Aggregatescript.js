// script.js
// Contains functions to calculate a rich set of tennis match stats,
// including detailed serve and return analysis.

export function aggregateTennisStats(matches, manualStats = {}) {
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
