/* Usage: If you want to change the name of a column in the filter list, 
   add the original column name to the left side and the display name
   to the right side. */

const nameMap = {
  // New Player1 Focused Map
  player1ServePlacement: 'Serve Placement',
  player1ServeResult: 'Serve Result',

  // Group 2: Return
  player1ReturnFhBh: 'Return Forehand/Backhand',
  player1ReturnPlacement: 'Return Placement',

  player1LastShotResult: 'Point Ends with Winner/Error', // Include in Group 2 and 3

  // Group 3: Last Shot
  player1LastShotFhBh: 'Last Shot Forehand/Backhand',
  player1LastShotPlacement: 'Last Shot Placement',

  // Group 4: Point Information
  rallyCountFreq: 'Rally Length',
  atNetPlayer1: 'Player Comes to Net',
  pointWonBy: 'Point Won By',
  side: 'Deuce/Ad Serve',
  setNum: 'Set Number',

  // Group 5: Special Requests
  isPressurePoint: ' Pressure Point',
  isUnforcedError: 'Unforced Error',
  isSecondServeAttacked: 'Second Serve Attacked',
  isAggressiveServePlusOne: 'Aggressive Serve +1',
  pointScore: 'Point Score'

  // Data Version 0 (Points)
  //  "point_winner"           : 'Point Winner',

  //  "serverName"             : 'Server',
  //  "Serve Result"           : 'Serve Result',
  //  "Serve Placement"        : 'Serve Placement',
  //  "servingSide"            : 'Duece/Ad Side',

  //  "returnerName"           : 'Returner',
  //  "Return (Forehand/Backhand)": 'Return (Forehand/Backhand)',
  //  "Return Placement"       : 'Return Placement',
  //  "Return Error Type"      : 'Return Error Type',

  //  "Serve +1 Forehand/Backhand" : 'Serve +1 Forehand/Backhand',
  //  "Serve +1 Placement"     : 'Serve +1 Placement',
  //  "Serve +1 Error Type"    : 'Serve +1 Error Type',

  // //  "Return +1 Forehand/Backhand" : 'Return +1 Forehand/Backhand',
  // //  "Return +1 Placement"    : 'Return +1 Placement',
  // //  "Return +1 Error Type"   : 'Return +1 Error Type',

  //  "Last Shot Forehand/Backhand" : 'Last Shot Forehand/Backhand',
  //  "Last Shot Placement"    : 'Last Shot Placement',
  //  "Last Shot Error Type"   : 'Last Shot Error Type',

  //  "atNetName"                  : 'At Net',
  //  "isbreakPoint"           : 'Break Point',
  //  "setScoreSum"            : 'Set #',
  //  "rallyCountFreq"         : 'Rally Length',

  // Data Version 1
  // "Name"                   : 'Point Score',
  //  "Shot 1: gameScore"      : 'Game Score',
  //  "Shot 1: setScore"       : 'Set Score',
  //  "Shot 1: serverName"     : 'Server Name',
  //  "Shot 1: firstServeIn"   : 'First Serve In',
  //  "Shot 1: firstServeZone" : 'First Serve Zone',
  //  "Shot 1: secondServeIn"  : 'Second Serve In',
  //  "Shot 1: secondServeZone": 'Second Serve Zone',
  //  "Shot 2: returnData"     : 'Return Data',
}

/* Available keys for data format 1
   (each starts with "Shot X: ")
   (except for pointScore and isPointStartTime which are renamed to "Name" and "Position"): */

//   pointScore
//   gameScore
//   setScore
//   isPointStartTime
//   isPointEndTime
//   shotInRally
//   serverName
//   firstServeIn
//   firstServeZone
//   secondServeIn
//   secondServeZone
//   returnData
//   shotType
//   shotSpin
//   isVolley
//   isApproach
//   isDropshot
//   isWinner
//   isErrorWideR
//   isErrorWideL
//   isErrorNet
//   isErrorLong
//   isPointStart
//   isPointEnd
//   player2Name

export default nameMap
