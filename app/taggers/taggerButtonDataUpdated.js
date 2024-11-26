/* ======== Usage: =========

The 'getTaggerButtonData' function generates a JSON object used for creating a dynamic user interface with buttons. This object maps page names to arrays of button objects, each defined with specific properties and actions.

Structure:
- Each button object has a 'label' property, which specifies the text to be displayed on the button.
- The 'action' property of each button is a function that handles all logic for the button. It can call various functions passed from tag-match.js, such as 'updateLastRow', 'setCurrentPage', and 'addNewRow'.

Data Handling:
- All table data is stored in the 'data' argument of the action function, accessible with 'data.table'.
- For image-based interaction, set the 'courtImage' property to 'serve' or 'standard' to specify how the court image should be split.
- Coordinates are captured in 'data.x' and 'data.y'. Use these to update table entries based on user interactions.

Example Logic:
- Update the last row based on serve coordinates:
  if (data.y > 800) {
    updateLastRow('isErrorLong', '1'); // Marks the serve as long
  }

- Update scores and state transitions:
  updateLastRow('pointScore', '0-0'); // sets the pointScore column to '0-0' for the last row
  setCurrentPage('FirstServeResult'); // transitions to the First Serve Result page
  newRow(); // adds a new row to the table

Additional Properties of 'data':
- data.x (only for image data)
- data.y (only for image data)
- data.table
- data.activeRowIndex
- data.videoTimestamp
- Every other property in the match document on the server is also available in 'data', such as 'data.videoId', 'data.clientTeam', etc.

======== Developed by Alex West ======== */

var serverScore = 0;
var returnerScore = 0;
var player1SetScore = 0;
var player2SetScore = 0;
var player1GameScore = 0;
var player2GameScore = 0;

// function updateFirstServe() {
//   if (data.table[data.activeRowIndex]['isAce'] == '1') {
//     ace(data.table[data.activeRowIndex]['serverName']);
//     if (serverScore == 0 && returnerScore == 0) {
//       setCurrentPage('ServerName');
//     }
//     else {
//       addNewRow();
//       if (serverScore == 40 && returnerScore == 40) {
//         setCurrentPage('PointScore');
//       }
//       else {
//         if (data.activeRowIndex > 0)
//         {
//           updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
//           updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
//         }
//         else {
//           updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
//           updateActiveRow('serverName', data.table[0]['serverName']); 
//         }
//         updateActiveRow('pointScore', serverScore + '-' + returnerScore);
//         updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
//         updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
//         updateActiveRow('isPointStart', 1);
//         updateActiveRow('shotInRally', 1);
//         updateActiveRow('side', chooseSide());
//         setCurrentPage('FirstServe');  
//       }   
//     }
//   }
//   else {
//     setCurrentPage('GroundstrokeContact');
//   }
// }

// function updateSecondServe() {
//     updateActiveRow('secondServeIn', '0');
//     updateActiveRow('isPointEnd', '1');
//     doubleFault(data.table[data.activeRowIndex]['serverName']);
//     if (serverScore == 0 && returnerScore == 0) {
//       setCurrentPage('ServerName');
//     }
//     else {
//       addNewRow();
//       if (serverScore == 40 && returnerScore == 40) {
//         setCurrentPage('PointScore');
//       }
//       else {
//         if (data.activeRowIndex > 0) {
//           updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
//           updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
//         }
//         else {
//           updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
//           updateActiveRow('serverName', data.table[0]['serverName']);
//         }
//         updateActiveRow('pointScore', serverScore + '-' + returnerScore);
//         updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
//         updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
//         updateActiveRow('isPointStart', 1);
//         updateActiveRow('shotInRally', 1);
//         updateActiveRow('side', chooseSide());
//         setCurrentPage('FirstServe');  
//       }   
//     }
// }

function updateScore(shotInRally, isWinner, serverName) {
  if ((shotInRally % 2 == 0) & isWinner == '1') {
    if (returnerScore == 40) {
      if (serverName == 'Player1') {
        player2GameScore += 1;
        serverScore = 0;
        returnerScore = 0;
      }
      else
      {
        player1GameScore += 1;
        serverScore = 0;
        returnerScore = 0; 
      }

    }
    else if (returnerScore != 30) {
      returnerScore += 15;
    }
    else {
      returnerScore += 10;
    }
  }
  else if (shotInRally % 2 == 0) {
    if (serverScore == 40) {
      if (serverName == 'Player1') {
        serverScore = 0;
        returnerScore = 0;
        player1GameScore += 1;
      }
      else
      {
        player2GameScore += 1;
        serverScore = 0;
        returnerScore = 0; 
      }
    }
    else if (serverScore != 30) {
      serverScore += 15;
    }
    else    {
      serverScore += 10;
    }
                            
  }
  else if (shotInRally % 2 == 1 & isWinner == '1') {
    if (serverScore == 40) {
      if (serverName == 'Player1') {
        player1GameScore += 1;
        serverScore = 0;
        returnerScore = 0;
      }
      else
      {
        player2GameScore += 1;
        serverScore = 0;
        returnerScore = 0; 
      }
    }
    else if (serverScore != 30) {
      serverScore += 15;
    }
    else  {
      serverScore += 10;
    }
  }
  else {
    if (returnerScore == 40) {
      if (serverName == 'Player1') {
        serverScore = 0;
        returnerScore = 0;
        player2GameScore += 1;
      }
      else
      {
        player1GameScore += 1;
        serverScore = 0;
        returnerScore = 0; 
      }

    }
    else if (returnerScore != 30) {
      returnerScore += 15;
    }
    else {
      returnerScore += 10;
    }
  }
}
function chooseSide() {
  if (serverScore == 40 || returnerScore == 40) {
    if ((serverScore + returnerScore) % 2 == 0) {
      return "Ad";
    }
    else
    {
      return "Deuce";
    }
  }
  else {
    if ((serverScore + returnerScore) % 2 == 0) {
      return "Deuce";
    }
    else
    {
      return "Ad";
    } 
  }
    
}
function doubleFault(serverName) {
  if (returnerScore < 30) {
    returnerScore += 15;
  }
  else if (returnerScore < 40) {
    returnerScore += 10;
  }
  else {
    if (serverName == 'Player1') {
      player2GameScore += 1;
      serverScore = 0;
      returnerScore = 0;
    }
    else
    {
      player1GameScore += 1;
      serverScore = 0;
      returnerScore = 0; 
    } 
  }
}
function ace(serverName) {
  if (serverScore < 30) {
    serverScore += 15;
  }
  else if (serverScore < 40) {
    serverScore += 10;
  }
  else {
    if (serverName == 'Player1') {
      player1GameScore += 1;
      serverScore = 0;
      returnerScore = 0;
    }
    else
    {
      player2GameScore += 1;
      serverScore = 0;
      returnerScore = 0;
    }
  }
} 
function updateTiebreakScore(shotInRally, isWinner, serverName) {
  if ((shotInRally % 2 == 0) &
    isWinner == '1') {
    if (serverName == 'Player1') {
      returnerScore += 1;
    }
    else {
      serverScore += 1;
    }
  }
  else if ((shotInRally % 2 == 0)) {
    if (serverName == 'Player1') {
      serverScore += 1;
    }
    else {
      returnerScore += 1;
    }
  }
  else if ((shotInRally % 2 == 1) & 
    isWinner == '1') {
    if (serverName == 'Player1') {
      serverScore += 1;
    }
    else {
      returnerScore += 1;
    }
  }
  else  {
    if (serverName == 'Player1') {
      returnerScore += 1;
    }
    else {
      serverScore += 1;
    }
  }
}
function chooseTiebreakSide() {
  if ((serverScore + returnerScore) % 2 == 0) {
    return "Deuce";
  }
  else
  {
    return "Ad";
  }

}



export const getTaggerButtonDataUpdated = (updateActiveRow, addNewRow, setCurrentPage) => ({
    
  'ServerName': [
    {
      label: 'Player1',
      action: () => {
        addNewRow();
        updateActiveRow('serverName', 'Player1');
        setCurrentPage('ServerSide')
      }
    },
    {
      label: 'Player2',
      action: () => {
        addNewRow();
        updateActiveRow('serverName', 'Player2');
        setCurrentPage('ServerSide')
      }
    },
  ],
  'ServerNameTiebreak': [
    {
      label: 'Player1',
      action: () => {
        addNewRow();
        updateActiveRow('serverName', 'Player1');
        setCurrentPage('ServerSideTiebreak')
      }
    },
    {
      label: 'Player2',
      action: () => {
        addNewRow();
        updateActiveRow('serverName', 'Player2');
        setCurrentPage('ServerSideTiebreak')
      }
    },
  ],
  'ServerSide': [
    {
      label: 'NearSide',
      action: () => {
        updateActiveRow('serverFarNear', 'Near');
        updateActiveRow('pointScore', serverScore + '-' + returnerScore);
        updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
        updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
        updateActiveRow('isPointStart', 1);
        updateActiveRow('shotInRally', 1);
        updateActiveRow('side', chooseSide());
        setCurrentPage('FirstServe');
      }
    },
    {
      label: 'FarSide',
      action: () => {
        updateActiveRow('serverFarNear', 'Far');
        updateActiveRow('pointScore', serverScore + '-' + returnerScore);
        updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
        updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
        updateActiveRow('isPointStart', 1);
        updateActiveRow('shotInRally', 1);
        updateActiveRow('side', chooseSide());
        setCurrentPage('FirstServe');
      }
    },
  ],
  'ServerSideTiebreak': [
    {
      label: 'NearSide',
      action: (data) => {
        updateActiveRow('pointScore', serverScore + '-' + returnerScore);
        updateActiveRow('gameScore', data.table[data.activeRowIndex - 1]['gameScore']);
        updateActiveRow('setScore', data.table[data.activeRowIndex - 1]['setScore']);
        updateActiveRow('isPointStart', 1);
        updateActiveRow('shotInRally', 1);
        updateActiveRow('side', chooseTiebreakSide());
        setCurrentPage('FirstServe');
      }
    },
    {
      label: 'FarSide',
      action: (data) => {
        updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
        updateActiveRow('pointScore', serverScore + '-' + returnerScore);
        updateActiveRow('gameScore', data.table[data.activeRowIndex - 1]['gameScore']);
        updateActiveRow('setScore', data.table[data.activeRowIndex - 1]['setScore']);
        updateActiveRow('isPointStart', 1);
        updateActiveRow('shotInRally', 1);
        updateActiveRow('side', chooseTiebreakSide());
        setCurrentPage('FirstServe');
      }
    },
  ],
  'PointScore': [
    {
      label: '40-40 (Ad Side)',
      action: (data) => {
        updateActiveRow('pointScore', '40-40');
        updateActiveRow('gameScore', data.table[data.activeRowIndex - 1]['gameScore']);
        updateActiveRow('setScore', data.table[data.activeRowIndex - 1]['setScore']);
        updateActiveRow('isPointStart', 1);
        updateActiveRow('shotInRally', 1);
        updateActiveRow('side', 'Ad');
        updateActiveRow('isBreakPoint', 1);
        setCurrentPage('FirstServe');
      }
    },
    {
      label: '40-40 (Deuce Side)',
      action: (data) => {
        updateActiveRow('pointScore', '40-40');
        updateActiveRow('gameScore', data.table[data.activeRowIndex - 1]['gameScore']);
        updateActiveRow('setScore', data.table[data.activeRowIndex - 1]['setScore']);
        updateActiveRow('isPointStart', 1);
        updateActiveRow('shotInRally', 1);
        updateActiveRow('side', 'Deuce');
        updateActiveRow('isBreakPoint', 1);
        setCurrentPage('FirstServe');
      }
    },
  ],
  'FirstServe': [
    {
      label: 'Ace',
      action: () => {
        updateActiveRow('isAce', '1');
        updateActiveRow('isPointEnd', '1');
        updateActiveRow('isWinner', '1');
      }
    },
    {
      courtImage: 'serve',
      label: 'Select First Serve Position',
      action: (data) => {
        updateActiveRow('firstServeXCoord', data.x);
        updateActiveRow('firstServeYCoord', data.y);  
        // Depending on coordinates, fill location of serve, etc...
        if (data.table[data.activeRowIndex]['serverFarNear'] == 'Near') {
          if ((data.table[data.activeRowIndex])['side'] == 'Deuce') // split by side
          {
            // Assuming coordinate range of x: 0-(-157), y: 0-245
            if (data.x >= -157 & data.x < -101)
            {
              updateActiveRow('firstServeZone', 'Wide');
              if (data.y >= 10 & data.y <= 245)
              {
                if (data.table[data.activeRowIndex]['isAce'] == '1') {
                  ace(data.table[data.activeRowIndex]['serverName']);
                  if (serverScore == 0 && returnerScore == 0) {
                    setCurrentPage('ServerName');
                  }
                  else {
                    addNewRow();
                    if (serverScore == 40 && returnerScore == 40) {
                      setCurrentPage('PointScore');
                    }
                    else {
                      if (data.activeRowIndex > 0)
                      {
                        updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                        updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                      }
                      else {
                        updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                        updateActiveRow('serverName', data.table[0]['serverName']); 
                      }
                      updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                      updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                      updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                      updateActiveRow('isPointStart', 1);
                      updateActiveRow('shotInRally', 1);
                      updateActiveRow('side', chooseSide());
                      setCurrentPage('FirstServe');  
                    }   
                  }
                }
                else {
                  setCurrentPage('GroundstrokeContact');
                }
              }
              else
              {
                updateActiveRow('firstServeIn', '0');
                setCurrentPage('SecondServe');
              }
            }
            else if (data.x >= -101 & data.x <= -54)
            {
              updateActiveRow('firstServeZone', 'Body');
              if (data.y >= 10 & data.y <= 245)
              {
                if (data.table[data.activeRowIndex]['isAce'] == '1') {
                  ace(data.table[data.activeRowIndex]['serverName']);
                  if (serverScore == 0 && returnerScore == 0) {
                    setCurrentPage('ServerName');
                  }
                  else {
                    addNewRow();
                    if (serverScore == 40 && returnerScore == 40) {
                      setCurrentPage('PointScore');
                    }
                    else {
                      if (data.activeRowIndex > 0)
                      {
                        updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                        updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                      }
                      else {
                        updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                        updateActiveRow('serverName', data.table[0]['serverName']); 
                      }
                      updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                      updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                      updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                      updateActiveRow('isPointStart', 1);
                      updateActiveRow('shotInRally', 1);
                      updateActiveRow('side', chooseSide());
                      setCurrentPage('FirstServe');  
                    }   
                  }
                }
                else {
                  setCurrentPage('GroundstrokeContact');
                }
              }
              else
              {
                updateActiveRow('firstServeIn', '0');
                setCurrentPage('SecondServe');
              }
            }
            else if (data.x > -54 & data.x <= 0)
            {
              updateActiveRow('firstServeZone', 'T');
              if (data.y >= 10 & data.y <= 245)
              {
                if (data.table[data.activeRowIndex]['isAce'] == '1') {
                  ace(data.table[data.activeRowIndex]['serverName']);
                  if (serverScore == 0 && returnerScore == 0) {
                    setCurrentPage('ServerName');
                  }
                  else {
                    addNewRow();
                    if (serverScore == 40 && returnerScore == 40) {
                      setCurrentPage('PointScore');
                    }
                    else {
                      if (data.activeRowIndex > 0)
                      {
                        updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                        updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                      }
                      else {
                        updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                        updateActiveRow('serverName', data.table[0]['serverName']); 
                      }
                      updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                      updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                      updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                      updateActiveRow('isPointStart', 1);
                      updateActiveRow('shotInRally', 1);
                      updateActiveRow('side', chooseSide());
                      setCurrentPage('FirstServe');  
                    }   
                  }
                }
                else {
                  setCurrentPage('GroundstrokeContact');
                }
              }
              else
              {
                updateActiveRow('firstServeIn', '0');
                setCurrentPage('SecondServe');
              }
            }
            else
            {
              updateActiveRow('firstServeIn', '0');
              if (data.x > 0) 
              {
                updateActiveRow('firstServeZone', 'T');
              }
              else 
              {
                updateActiveRow('firstServeZone', 'Wide')
              }
              setCurrentPage('SecondServe');
            }
          }
          else // wide and T inverted for Ad side
          {  // Assuming coordinate range of x: 0-157, y: 0-245
            if (data.x >= 0 & data.x < 55)
            {
              updateActiveRow('firstServeZone', 'T');
              if (data.y >= 10 & data.y <= 245)
              {
                if (data.table[data.activeRowIndex]['isAce'] == '1') {
                  ace(data.table[data.activeRowIndex]['serverName']);
                  if (serverScore == 0 && returnerScore == 0) {
                    setCurrentPage('ServerName');
                  }
                  else {
                    addNewRow();
                    if (serverScore == 40 && returnerScore == 40) {
                      setCurrentPage('PointScore');
                    }
                    else {
                      if (data.activeRowIndex > 0)
                      {
                        updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                        updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                      }
                      else {
                        updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                        updateActiveRow('serverName', data.table[0]['serverName']); 
                      }
                      updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                      updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                      updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                      updateActiveRow('isPointStart', 1);
                      updateActiveRow('shotInRally', 1);
                      updateActiveRow('side', chooseSide());
                      setCurrentPage('FirstServe');  
                    }   
                  }
                }
                else {
                  setCurrentPage('GroundstrokeContact');
                }
              }
              else
              {
                updateActiveRow('firstServeIn', '0');
                setCurrentPage('SecondServe');
              }
            }
            else if (data.x >= 55 & data.x <= 105)
            {
              updateActiveRow('firstServeZone', 'Body');
              if (data.y >= 10 & data.y <= 245)
              {
                if (data.table[data.activeRowIndex]['isAce'] == '1') {
                  ace(data.table[data.activeRowIndex]['serverName']);
                  if (serverScore == 0 && returnerScore == 0) {
                    setCurrentPage('ServerName');
                  }
                  else {
                    addNewRow();
                    if (serverScore == 40 && returnerScore == 40) {
                      setCurrentPage('PointScore');
                    }
                    else {
                      if (data.activeRowIndex > 0)
                      {
                        updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                        updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                      }
                      else {
                        updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                        updateActiveRow('serverName', data.table[0]['serverName']); 
                      }
                      updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                      updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                      updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                      updateActiveRow('isPointStart', 1);
                      updateActiveRow('shotInRally', 1);
                      updateActiveRow('side', chooseSide());
                      setCurrentPage('FirstServe');  
                    }   
                  }
                }
                else {
                  setCurrentPage('GroundstrokeContact');
                }
              }
              else
              {
                updateActiveRow('firstServeIn', '0');
                setCurrentPage('SecondServe');
              }
            }
            else if (data.x > 105 & data.x <= 157)
            {
              updateActiveRow('firstServeZone', 'Wide');
              if (data.y >= 10 & data.y <= 245)
              {
                if (data.table[data.activeRowIndex]['isAce'] == '1') {
                  ace(data.table[data.activeRowIndex]['serverName']);
                  if (serverScore == 0 && returnerScore == 0) {
                    setCurrentPage('ServerName');
                  }
                  else {
                    addNewRow();
                    if (serverScore == 40 && returnerScore == 40) {
                      setCurrentPage('PointScore');
                    }
                    else {
                      if (data.activeRowIndex > 0)
                      {
                        updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                        updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                      }
                      else {
                        updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                        updateActiveRow('serverName', data.table[0]['serverName']); 
                      }
                      updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                      updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                      updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                      updateActiveRow('isPointStart', 1);
                      updateActiveRow('shotInRally', 1);
                      updateActiveRow('side', chooseSide());
                      setCurrentPage('FirstServe');  
                    }   
                  }
                }
                else {
                  setCurrentPage('GroundstrokeContact');
                }
              }
              else
              {
                updateActiveRow('firstServeIn', '0');
                setCurrentPage('SecondServe');
              }
            }
            else
            {
              updateActiveRow('firstServeIn', '0');
              if (data.x < 0) 
              {
                updateActiveRow('firstServeZone', 'T');
              }
              else 
              {
                updateActiveRow('firstServeZone', 'Wide')
              }
              setCurrentPage('SecondServe');
            }   
          }
        }
        // FAR SIDE
        else
        {
          if ((data.table[data.activeRowIndex])['side'] == 'Ad') // split by side
          {
            // Assuming coordinate range of x: 0-(-157), y: 0-245
            if (data.x >= -157 & data.x < -105)
            {
              updateActiveRow('firstServeZone', 'Wide');
              if (data.y <= -10 & data.y >= -245)
              {
                if (data.table[data.activeRowIndex]['isAce'] == '1') {
                  ace(data.table[data.activeRowIndex]['serverName']);
                  if (serverScore == 0 && returnerScore == 0) {
                    setCurrentPage('ServerName');
                  }
                  else {
                    addNewRow();
                    if (serverScore == 40 && returnerScore == 40) {
                      setCurrentPage('PointScore');
                    }
                    else {
                      if (data.activeRowIndex > 0)
                      {
                        updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                        updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                      }
                      else {
                        updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                        updateActiveRow('serverName', data.table[0]['serverName']); 
                      }
                      updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                      updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                      updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                      updateActiveRow('isPointStart', 1);
                      updateActiveRow('shotInRally', 1);
                      updateActiveRow('side', chooseSide());
                      setCurrentPage('FirstServe');  
                    }   
                  }
                }
                else {
                  setCurrentPage('GroundstrokeContact');
                }
              }
              else
              {
                updateActiveRow('firstServeIn', '0');
                setCurrentPage('SecondServe');
              }
            }
            else if (data.x >= -105 & data.x <= -52)
            {
              updateActiveRow('firstServeZone', 'Body');
              if (data.y <= -10 & data.y >= -245)
              {
                if (data.table[data.activeRowIndex]['isAce'] == '1') {
                  ace(data.table[data.activeRowIndex]['serverName']);
                  if (serverScore == 0 && returnerScore == 0) {
                    setCurrentPage('ServerName');
                  }
                  else {
                    addNewRow();
                    if (serverScore == 40 && returnerScore == 40) {
                      setCurrentPage('PointScore');
                    }
                    else {
                      if (data.activeRowIndex > 0)
                      {
                        updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                        updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                      }
                      else {
                        updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                        updateActiveRow('serverName', data.table[0]['serverName']); 
                      }
                      updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                      updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                      updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                      updateActiveRow('isPointStart', 1);
                      updateActiveRow('shotInRally', 1);
                      updateActiveRow('side', chooseSide());
                      setCurrentPage('FirstServe');  
                    }   
                  }
                }
                else {
                  setCurrentPage('GroundstrokeContact');
                }
              }
              else
              {
                updateActiveRow('firstServeIn', '0');
                setCurrentPage('SecondServe');
              }
            }
            else if (data.x > -52 & data.x < 0)
            {
              updateActiveRow('firstServeZone', 'T');
              if (data.y <= -10 & data.y >= -245)
              {
                if (data.table[data.activeRowIndex]['isAce'] == '1') {
                  ace(data.table[data.activeRowIndex]['serverName']);
                  if (serverScore == 0 && returnerScore == 0) {
                    setCurrentPage('ServerName');
                  }
                  else {
                    addNewRow();
                    if (serverScore == 40 && returnerScore == 40) {
                      setCurrentPage('PointScore');
                    }
                    else {
                      if (data.activeRowIndex > 0)
                      {
                        updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                        updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                      }
                      else {
                        updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                        updateActiveRow('serverName', data.table[0]['serverName']); 
                      }
                      updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                      updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                      updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                      updateActiveRow('isPointStart', 1);
                      updateActiveRow('shotInRally', 1);
                      updateActiveRow('side', chooseSide());
                      setCurrentPage('FirstServe');  
                    }   
                  }
                }
                else {
                  setCurrentPage('GroundstrokeContact');
                }
              }
              else
              {
                updateActiveRow('firstServeIn', '0');
                setCurrentPage('SecondServe');
              }
            }
            else
            {
              updateActiveRow('firstServeIn', '0');
              if (data.x > 0) 
              {
                updateActiveRow('firstServeZone', 'T');
              }
              else 
              {
                updateActiveRow('firstServeZone', 'Wide')
              }
              setCurrentPage('SecondServe');
            }
          }
          else // wide and T inverted for Deuce side
          {  // Assuming coordinate range of x: 0-157, y: 0-245
            if (data.x >= 0 & data.x < 50)
            {
              updateActiveRow('firstServeZone', 'T');
              if (data.y <= -10 & data.y >= -245)
              {
                if (data.table[data.activeRowIndex]['isAce'] == '1') {
                  ace(data.table[data.activeRowIndex]['serverName']);
                  if (serverScore == 0 && returnerScore == 0) {
                    setCurrentPage('ServerName');
                  }
                  else {
                    addNewRow();
                    if (serverScore == 40 && returnerScore == 40) {
                      setCurrentPage('PointScore');
                    }
                    else {
                      if (data.activeRowIndex > 0)
                      {
                        updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                        updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                      }
                      else {
                        updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                        updateActiveRow('serverName', data.table[0]['serverName']); 
                      }
                      updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                      updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                      updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                      updateActiveRow('isPointStart', 1);
                      updateActiveRow('shotInRally', 1);
                      updateActiveRow('side', chooseSide());
                      setCurrentPage('FirstServe');  
                    }   
                  }
                }
                else {
                  setCurrentPage('GroundstrokeContact');
                }
              }
              else
              {
                updateActiveRow('firstServeIn', '0');
                setCurrentPage('SecondServe');
              }
            }
            else if (data.x >= 50 & data.x <= 105)
            {
              updateActiveRow('firstServeZone', 'Body');
              if (data.y <= -10 & data.y >= -245)
              {
                if (data.table[data.activeRowIndex]['isAce'] == '1') {
                  ace(data.table[data.activeRowIndex]['serverName']);
                  if (serverScore == 0 && returnerScore == 0) {
                    setCurrentPage('ServerName');
                  }
                  else {
                    addNewRow();
                    if (serverScore == 40 && returnerScore == 40) {
                      setCurrentPage('PointScore');
                    }
                    else {
                      if (data.activeRowIndex > 0)
                      {
                        updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                        updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                      }
                      else {
                        updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                        updateActiveRow('serverName', data.table[0]['serverName']); 
                      }
                      updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                      updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                      updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                      updateActiveRow('isPointStart', 1);
                      updateActiveRow('shotInRally', 1);
                      updateActiveRow('side', chooseSide());
                      setCurrentPage('FirstServe');  
                    }   
                  }
                }
                else {
                  setCurrentPage('GroundstrokeContact');
                }
              }
              else
              {
                updateActiveRow('firstServeIn', '0');
                setCurrentPage('SecondServe');
              }
            }
            else if (data.x > 105 & data.x <= 157)
            {
              updateActiveRow('firstServeZone', 'Wide');
              if (data.y <= -10 & data.y >= -245)
              {
                if (data.table[data.activeRowIndex]['isAce'] == '1') {
                  ace(data.table[data.activeRowIndex]['serverName']);
                  if (serverScore == 0 && returnerScore == 0) {
                    setCurrentPage('ServerName');
                  }
                  else {
                    addNewRow();
                    if (serverScore == 40 && returnerScore == 40) {
                      setCurrentPage('PointScore');
                    }
                    else {
                      if (data.activeRowIndex > 0)
                      {
                        updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                        updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                      }
                      else {
                        updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                        updateActiveRow('serverName', data.table[0]['serverName']); 
                      }
                      updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                      updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                      updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                      updateActiveRow('isPointStart', 1);
                      updateActiveRow('shotInRally', 1);
                      updateActiveRow('side', chooseSide());
                      setCurrentPage('FirstServe');  
                    }   
                  }
                }
                else {
                  setCurrentPage('GroundstrokeContact');
                }
              }
              else
              {
                updateActiveRow('firstServeIn', '0');
                setCurrentPage('SecondServe');
              }
            }
            else
            {
              updateActiveRow('firstServeIn', '0');
              if (data.x <= 0) 
              {
                updateActiveRow('firstServeZone', 'T');
              }
              else 
              {
                updateActiveRow('firstServeZone', 'Wide')
              }
              setCurrentPage('SecondServe');
            }   
          }  
        }
      }
    },
  ],
  'SecondServe': [
    {
      label: 'Ace',
      action: () => {
        updateActiveRow('isAce', '1');
        updateActiveRow('isPointEnd', '1');
        updateActiveRow('isWinner', '1');
      }
    },
    {
      courtImage: 'serve',
      label: 'Select Second Serve Position',
      action: (data) => {
        updateActiveRow('secondServeXCoord', data.x);
        updateActiveRow('secondServeYCoord', data.y);
        // Depending on coordinates, fill location of serve, etc...
        if (data.table[data.activeRowIndex]['serverFarNear'] == 'Near') {
          if ((data.table[data.activeRowIndex])['side'] == 'Deuce') // split by side
          {
            // Assuming coordinate range of x: 0-(-157), y: 0-245
            if (data.x >= -157 & data.x < -101)
            {
              updateActiveRow('secondServeZone', 'Wide');
              if (data.y >= 10 & data.y <= 245)
              {
                // if (data.table[data.activeRowIndex]['isAce'] == '1') { 
                //   ace(data.table[data.activeRowIndex]['serverName']);
                //   if (serverScore == 0 && returnerScore == 0) {
                //     setCurrentPage('ServerName');
                //   } else {
                //     setCurrentPage('FirstServe'); s
                //   }
                // } else 
                updateActiveRow('secondServeIn', '1');
                setCurrentPage('GroundstrokeContact');
              }
              else
              {
                updateActiveRow('secondServeIn', '0');
                updateActiveRow('isPointEnd', '1');
                doubleFault(data.table[data.activeRowIndex]['serverName']);
                if (serverScore == 0 && returnerScore == 0) {
                  setCurrentPage('ServerName');
                }
                else {
                  addNewRow();
                  if (serverScore == 40 && returnerScore == 40) {
                    setCurrentPage('PointScore');
                  }
                  else {
                    if (data.activeRowIndex > 0) {
                      updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                      updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                    }
                    else {
                      updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                      updateActiveRow('serverName', data.table[0]['serverName']);
                    }
                    updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                    updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                    updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                    updateActiveRow('isPointStart', 1);
                    updateActiveRow('shotInRally', 1);
                    updateActiveRow('side', chooseSide());
                    setCurrentPage('FirstServe');  
                  }   
                }
              }
            }
            else if (data.x >= -101 & data.x <= -54)
            {
              updateActiveRow('secondServeZone', 'Body');
              if (data.y >= 10 & data.y <= 245)
              {
                updateActiveRow('secondServeIn', '1');
                setCurrentPage('GroundstrokeContact');
              }
              else
              {
                updateActiveRow('secondServeIn', '0');
                updateActiveRow('isPointEnd', '1');
                doubleFault(data.table[data.activeRowIndex]['serverName']);
                if (serverScore == 0 && returnerScore == 0) {
                  setCurrentPage('ServerName');
                }
                else {
                  addNewRow();
                  if (serverScore == 40 && returnerScore == 40) {
                    setCurrentPage('PointScore');
                  }
                  else {
                    if (data.activeRowIndex > 0) {
                      updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                      updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                    }
                    else {
                      updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                      updateActiveRow('serverName', data.table[0]['serverName']);
                    }
                    updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                    updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                    updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                    updateActiveRow('isPointStart', 1);
                    updateActiveRow('shotInRally', 1);
                    updateActiveRow('side', chooseSide());
                    setCurrentPage('FirstServe');  
                  }   
                }
              }
            }
            else if (data.x > -54 & data.x <= 0)
            {
              updateActiveRow('secondServeZone', 'T');
              if (data.y >= 10 & data.y <= 245)
              {
                updateActiveRow('secondServeIn', '1');
                setCurrentPage('GroundstrokeContact');
              }
              else
              {
                updateActiveRow('secondServeIn', '0');
                updateActiveRow('isPointEnd', '1');
                doubleFault(data.table[data.activeRowIndex]['serverName']);
                if (serverScore == 0 && returnerScore == 0) {
                  setCurrentPage('ServerName');
                }
                else {
                  addNewRow();
                  if (serverScore == 40 && returnerScore == 40) {
                    setCurrentPage('PointScore');
                  }
                  else {
                    if (data.activeRowIndex > 0) {
                      updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                      updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                    }
                    else {
                      updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                      updateActiveRow('serverName', data.table[0]['serverName']);
                    }
                    updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                    updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                    updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                    updateActiveRow('isPointStart', 1);
                    updateActiveRow('shotInRally', 1);
                    updateActiveRow('side', chooseSide());
                    setCurrentPage('FirstServe');  
                  }   
                }
              }
            }
            else
            {
              if (data.x > 0) 
              {
                updateActiveRow('secondServeZone', 'T');
              }
              else 
              {
                updateActiveRow('secondServeZone', 'Wide')
              }
              updateActiveRow('secondServeIn', '0');
              updateActiveRow('isPointEnd', '1');
              doubleFault(data.table[data.activeRowIndex]['serverName']);
              if (serverScore == 0 && returnerScore == 0) {
                setCurrentPage('ServerName');
              }
              else {
                addNewRow();
                if (serverScore == 40 && returnerScore == 40) {
                  setCurrentPage('PointScore');
                }
                else {
                  if (data.activeRowIndex > 0) {
                    updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                    updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                  }
                  else {
                    updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                    updateActiveRow('serverName', data.table[0]['serverName']);
                  }
                  updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                  updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                  updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                  updateActiveRow('isPointStart', 1);
                  updateActiveRow('shotInRally', 1);
                  updateActiveRow('side', chooseSide());
                  setCurrentPage('FirstServe');  
                }   
              }
            }
          }
          else // wide and T inverted for Ad side
          {  // Assuming coordinate range of x: 0-157, y: 0-245
            if (data.x >= 0 & data.x < 55)
            {
              updateActiveRow('secondServeZone', 'T');
              if (data.y >= 10 & data.y <= 245)
              {
                updateActiveRow('secondServeIn', '1');
                setCurrentPage('GroundstrokeContact');
              }
              else
              {
                updateActiveRow('secondServeIn', '0');
                updateActiveRow('isPointEnd', '1');
                doubleFault(data.table[data.activeRowIndex]['serverName']);
                if (serverScore == 0 && returnerScore == 0) {
                  setCurrentPage('ServerName');
                }
                else {
                  addNewRow();
                  if (serverScore == 40 && returnerScore == 40) {
                    setCurrentPage('PointScore');
                  }
                  else {
                    if (data.activeRowIndex > 0) {
                      updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                      updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                    }
                    else {
                      updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                      updateActiveRow('serverName', data.table[0]['serverName']);
                    }
                    updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                    updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                    updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                    updateActiveRow('isPointStart', 1);
                    updateActiveRow('shotInRally', 1);
                    updateActiveRow('side', chooseSide());
                    setCurrentPage('FirstServe');  
                  }   
                }
              }
            }
            else if (data.x >= 55 & data.x <= 105)
            {
              updateActiveRow('secondServeZone', 'Body');
              if (data.y >= 10 & data.y <= 245)
              {
                updateActiveRow('secondServeIn', '1');
                setCurrentPage('GroundstrokeContact');
              }
              else
              {
                updateActiveRow('secondServeIn', '0');
                updateActiveRow('isPointEnd', '1');
                doubleFault(data.table[data.activeRowIndex]['serverName']);
                if (serverScore == 0 && returnerScore == 0) {
                  setCurrentPage('ServerName');
                }
                else {
                  addNewRow();
                  if (serverScore == 40 && returnerScore == 40) {
                    setCurrentPage('PointScore');
                  }
                  else {
                    if (data.activeRowIndex > 0) {
                      updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                      updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                    }
                    else {
                      updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                      updateActiveRow('serverName', data.table[0]['serverName']);
                    }
                    updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                    updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                    updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                    updateActiveRow('isPointStart', 1);
                    updateActiveRow('shotInRally', 1);
                    updateActiveRow('side', chooseSide());
                    setCurrentPage('FirstServe');  
                  }   
                }
              }
            }
            else if (data.x > 105 & data.x <= 157)
            {
              updateActiveRow('secondServeZone', 'Wide');
              if (data.y >= 10 & data.y <= 245)
              {
                updateActiveRow('secondServeIn', '1');
                setCurrentPage('GroundstrokeContact');
              }
              else
              {
                updateActiveRow('secondServeIn', '0');
                updateActiveRow('isPointEnd', '1');
                doubleFault(data.table[data.activeRowIndex]['serverName']);
                if (serverScore == 0 && returnerScore == 0) {
                  setCurrentPage('ServerName');
                }
                else {
                  addNewRow();
                  if (serverScore == 40 && returnerScore == 40) {
                    setCurrentPage('PointScore');
                  }
                  else {
                    if (data.activeRowIndex > 0) {
                      updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                      updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                    }
                    else {
                      updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                      updateActiveRow('serverName', data.table[0]['serverName']);
                    }
                    updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                    updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                    updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                    updateActiveRow('isPointStart', 1);
                    updateActiveRow('shotInRally', 1);
                    updateActiveRow('side', chooseSide());
                    setCurrentPage('FirstServe');  
                  }   
                }
              }
            }
            else
            {
              if (data.x < 0) 
              {
                updateActiveRow('secondServeZone', 'T');
              }
              else 
              {
                updateActiveRow('secondServeZone', 'Wide')
              }
              if (data.table[data.activeRowIndex]['isAce'] == '1') {
                ace(data.table[data.activeRowIndex]['serverName']);
                if (serverScore == 0 && returnerScore == 0) {
                  setCurrentPage('ServerName');
                }
                else {
                  addNewRow();
                  if (serverScore == 40 && returnerScore == 40) {
                    setCurrentPage('PointScore');
                  }
                  else {
                    if (data.activeRowIndex > 0)
                    {
                      updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                      updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                    }
                    else {
                      updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                      updateActiveRow('serverName', data.table[0]['serverName']); 
                    }
                    updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                    updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                    updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                    updateActiveRow('isPointStart', 1);
                    updateActiveRow('shotInRally', 1);
                    updateActiveRow('side', chooseSide());
                    setCurrentPage('FirstServe');  
                  }   
                }
              }
              else {
                setCurrentPage('GroundstrokeContact');
              }
            }   
          }
        }
        // FAR SIDE
        else
        {
          if ((data.table[data.activeRowIndex])['side'] == 'Ad') // split by side
          {
            // Assuming coordinate range of x: 
            if (data.x >= -157 & data.x < -105)
            {
              updateActiveRow('secondServeZone', 'Wide');
              if (data.y <= -10 & data.y >= -245)
              {
                updateActiveRow('secondServeIn', '1');
                setCurrentPage('GroundstrokeContact');
              }
              else
              {
                updateActiveRow('secondServeIn', '0');
                updateActiveRow('isPointEnd', '1');
                doubleFault(data.table[data.activeRowIndex]['serverName']);
                if (serverScore == 0 && returnerScore == 0) {
                  setCurrentPage('ServerName');
                }
                else {
                  addNewRow();
                  if (serverScore == 40 && returnerScore == 40) {
                    setCurrentPage('PointScore');
                  }
                  else {
                    if (data.activeRowIndex > 0) {
                      updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                      updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                    }
                    else {
                      updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                      updateActiveRow('serverName', data.table[0]['serverName']);
                    }
                    updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                    updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                    updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                    updateActiveRow('isPointStart', 1);
                    updateActiveRow('shotInRally', 1);
                    updateActiveRow('side', chooseSide());
                    setCurrentPage('FirstServe');  
                  }   
                }
              }
            }
            else if (data.x >= -105 & data.x <= -52)
            {
              updateActiveRow('secondServeZone', 'Body');
              if (data.y <= -10 & data.y >= -245)
              {
                updateActiveRow('secondServeIn', '1');
                setCurrentPage('GroundstrokeContact');
              }
              else
              {
                updateActiveRow('secondServeIn', '0');
                updateActiveRow('isPointEnd', '1');
                doubleFault(data.table[data.activeRowIndex]['serverName']);
                if (serverScore == 0 && returnerScore == 0) {
                  setCurrentPage('ServerName');
                }
                else {
                  addNewRow();
                  if (serverScore == 40 && returnerScore == 40) {
                    setCurrentPage('PointScore');
                  }
                  else {
                    if (data.activeRowIndex > 0) {
                      updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                      updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                    }
                    else {
                      updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                      updateActiveRow('serverName', data.table[0]['serverName']);
                    }
                    updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                    updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                    updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                    updateActiveRow('isPointStart', 1);
                    updateActiveRow('shotInRally', 1);
                    updateActiveRow('side', chooseSide());
                    setCurrentPage('FirstServe');  
                  }   
                }
              }
            }
            else if (data.x > -52 & data.x < 0)
            {
              updateActiveRow('secondServeZone', 'T');
              if (data.y <= -10 & data.y >= -245)
              {
                updateActiveRow('secondServeIn', '1');
                setCurrentPage('GroundstrokeContact');
              }
              else
              {
                if (data.table[data.activeRowIndex]['isAce'] == '1') {
                  ace(data.table[data.activeRowIndex]['serverName']);
                  if (serverScore == 0 && returnerScore == 0) {
                    setCurrentPage('ServerName');
                  }
                  else {
                    addNewRow();
                    if (serverScore == 40 && returnerScore == 40) {
                      setCurrentPage('PointScore');
                    }
                    else {
                      if (data.activeRowIndex > 0)
                      {
                        updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                        updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                      }
                      else {
                        updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                        updateActiveRow('serverName', data.table[0]['serverName']); 
                      }
                      updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                      updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                      updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                      updateActiveRow('isPointStart', 1);
                      updateActiveRow('shotInRally', 1);
                      updateActiveRow('side', chooseSide());
                      setCurrentPage('FirstServe');  
                    }   
                  }
                }
                else {
                  setCurrentPage('GroundstrokeContact');
                }
              }
            }
            else
            {
              if (data.x < 0) 
              {
                updateActiveRow('secondServeZone', 'T');
              }
              else 
              {
                updateActiveRow('secondServeZone', 'Wide')
              }
              if (data.table[data.activeRowIndex]['isAce'] == '1') {
                ace(data.table[data.activeRowIndex]['serverName']);
                if (serverScore == 0 && returnerScore == 0) {
                  setCurrentPage('ServerName');
                }
                else {
                  addNewRow();
                  if (serverScore == 40 && returnerScore == 40) {
                    setCurrentPage('PointScore');
                  }
                  else {
                    if (data.activeRowIndex > 0)
                    {
                      updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                      updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                    }
                    else {
                      updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                      updateActiveRow('serverName', data.table[0]['serverName']); 
                    }
                    updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                    updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                    updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                    updateActiveRow('isPointStart', 1);
                    updateActiveRow('shotInRally', 1);
                    updateActiveRow('side', chooseSide());
                    setCurrentPage('FirstServe');  
                  }   
                }
              }
              else {
                setCurrentPage('GroundstrokeContact');
              }
            }
          }
          else // wide and T inverted for Deuce side
          {  // Assuming coordinate range of x: 215-350, y: 470-723
            if (data.x >= 0 & data.x < 50)
            {
              updateActiveRow('secondServeZone', 'T');
              if (data.y <= -10 & data.y >= -245)
              {
                updateActiveRow('secondServeIn', '1');
                setCurrentPage('GroundstrokeContact');
              }
              else
              {
                updateActiveRow('secondServeIn', '0');
                updateActiveRow('isPointEnd', '1');
                doubleFault(data.table[data.activeRowIndex]['serverName']);
                if (serverScore == 0 && returnerScore == 0) {
                  setCurrentPage('ServerName');
                }
                else {
                  addNewRow();
                  if (serverScore == 40 && returnerScore == 40) {
                    setCurrentPage('PointScore');
                  }
                  else {
                    if (data.activeRowIndex > 0) {
                      updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                      updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                    }
                    else {
                      updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                      updateActiveRow('serverName', data.table[0]['serverName']);
                    }
                    updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                    updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                    updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                    updateActiveRow('isPointStart', 1);
                    updateActiveRow('shotInRally', 1);
                    updateActiveRow('side', chooseSide());
                    setCurrentPage('FirstServe');  
                  }   
                }
              }
            }
            else if (data.x >= 50 & data.x <= 105)
            {
              updateActiveRow('secondServeZone', 'Body');
              if (data.y <= -10 & data.y >= -245)
              {
                updateActiveRow('secondServeIn', '1');
                setCurrentPage('GroundstrokeContact');
              }
              else
              {
                updateActiveRow('secondServeIn', '0');
                updateActiveRow('isPointEnd', '1');
                doubleFault(data.table[data.activeRowIndex]['serverName']);
                if (serverScore == 0 && returnerScore == 0) {
                  setCurrentPage('ServerName');
                }
                else {
                  addNewRow();
                  if (serverScore == 40 && returnerScore == 40) {
                    setCurrentPage('PointScore');
                  }
                  else {
                    if (data.activeRowIndex > 0) {
                      updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                      updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                    }
                    else {
                      updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                      updateActiveRow('serverName', data.table[0]['serverName']);
                    }
                    updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                    updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                    updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                    updateActiveRow('isPointStart', 1);
                    updateActiveRow('shotInRally', 1);
                    updateActiveRow('side', chooseSide());
                    setCurrentPage('FirstServe');  
                  }   
                }
              }
            }
            else if (data.x > 105 & data.x <= 157)
            {
              updateActiveRow('secondServeZone', 'Wide');
              if (data.y <= -10 & data.y >= -245)
              {
                updateActiveRow('secondServeIn', '1');
                setCurrentPage('GroundstrokeContact');
              }
              else
              {
                updateActiveRow('secondServeIn', '0');
                updateActiveRow('isPointEnd', '1');
                doubleFault(data.table[data.activeRowIndex]['serverName']);
                if (serverScore == 0 && returnerScore == 0) {
                  setCurrentPage('ServerName');
                }
                else {
                  addNewRow();
                  if (serverScore == 40 && returnerScore == 40) {
                    setCurrentPage('PointScore');
                  }
                  else {
                    if (data.activeRowIndex > 0) {
                      updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                      updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                    }
                    else {
                      updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                      updateActiveRow('serverName', data.table[0]['serverName']);
                    }
                    updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                    updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                    updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                    updateActiveRow('isPointStart', 1);
                    updateActiveRow('shotInRally', 1);
                    updateActiveRow('side', chooseSide());
                    setCurrentPage('FirstServe');  
                  }   
                }
              }
            }
            else
            {
              if (data.x < 0) 
              {
                updateActiveRow('secondServeZone', 'T');
              }
              else 
              {
                updateActiveRow('secondServeZone', 'Wide')
              }
              if (data.table[data.activeRowIndex]['isAce'] == '1') {
                ace(data.table[data.activeRowIndex]['serverName']);
                if (serverScore == 0 && returnerScore == 0) {
                  setCurrentPage('ServerName');
                }
                else {
                  addNewRow();
                  if (serverScore == 40 && returnerScore == 40) {
                    setCurrentPage('PointScore');
                  }
                  else {
                    if (data.activeRowIndex > 0)
                    {
                      updateActiveRow('serverFarNear', data.table[data.activeRowIndex - 1]['serverFarNear']);
                      updateActiveRow('serverName', data.table[data.activeRowIndex - 1]['serverName']);
                    }
                    else {
                      updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);
                      updateActiveRow('serverName', data.table[0]['serverName']); 
                    }
                    updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                    updateActiveRow('gameScore', player1GameScore + '-' + player2GameScore);
                    updateActiveRow('setScore', player1SetScore + '-' + player2SetScore);
                    updateActiveRow('isPointStart', 1);
                    updateActiveRow('shotInRally', 1);
                    updateActiveRow('side', chooseSide());
                    setCurrentPage('FirstServe');  
                  }   
                }
              }
              else {
                setCurrentPage('GroundstrokeContact');
              }
            }   
          } 
        }
        
      }
    }
  ],
  'GroundstrokeContact': [
    {
      courtImage: true,
      label: 'Select Shot Contact Position',
      action: (data) => {
        addNewRow();
        updateActiveRow('shotContactX', data.x);
        updateActiveRow('shotContactY', data.y);
        if (data.activeRowIndex > 0) {
          updateActiveRow('shotInRally', parseInt(data.table[data.activeRowIndex]['shotInRally']) + 1);
          // Need to copy down: pointScore, gameScore, setScore, serverName, serverSide
          updateActiveRow('serverName', data.table[data.activeRowIndex]['serverName']);
          updateActiveRow('pointScore', data.table[data.activeRowIndex]['pointScore']);
          updateActiveRow('gameScore', data.table[data.activeRowIndex]['gameScore']);
          updateActiveRow('setScore', data.table[data.activeRowIndex]['setScore']);
          updateActiveRow('tiebreakScore', data.table[data.activeRowIndex]['tiebreakScore']);
          updateActiveRow('serverFarNear', data.table[data.activeRowIndex]['serverFarNear']);
        }
        else {
          updateActiveRow('shotInRally', parseInt(data.table[0]['shotInRally']) + 1);
          // Need to copy down: pointScore, gameScore, setScore, serverName, serverSide
          updateActiveRow('serverName', data.table[0]['serverName']);
          updateActiveRow('pointScore', data.table[0]['pointScore']);
          updateActiveRow('gameScore', data.table[0]['gameScore']);
          updateActiveRow('setScore', data.table[0]['setScore']);
          updateActiveRow('tiebreakScore', data.table[0]['tiebreakScore']);
          updateActiveRow('serverFarNear', data.table[0]['serverFarNear']);  
        }
        if (data.y > 0) 
        { // assuming 0 is halfway point
          if (data.x < 0) 
          {
            updateActiveRow('side', 'Deuce');
            setCurrentPage('GroundstrokeShotInfo')
          }
          else
          {
            updateActiveRow('side', 'Ad');
            setCurrentPage('GroundstrokeShotInfo')
          }
        }
        else
        {
          if (data.x < 0) 
          {
            updateActiveRow('side', 'Ad');
            setCurrentPage('GroundstrokeShotInfo')
          }
          else
          {
            updateActiveRow('side', 'Deuce');
            setCurrentPage('GroundstrokeShotInfo')
    
          } 
        }
      },
    }
  ],
  'GroundstrokeShotInfo': [
    {
      label: 'Forehand',
      action: () => {
        updateActiveRow('shotFhBh', 'Forehand');
        setCurrentPage('GroundstrokeLocation');
      }
    },
    {
      label: 'Backhand',
      action: () => {
        updateActiveRow('shotFhBh', 'Backhand');
        setCurrentPage('GroundstrokeLocation');
      }
    },

  ],
  'GroundstrokeLocation': [
    {
      label: 'Slice',
      action: () => {
        updateActiveRow('isSlice', '1');
      }
    },
    {
      label: 'Dropshot',
      action: () => {
        updateActiveRow('isDropshot', '1');
      }
    },
    {
      label: 'Approach',
      action: () => {
        updateActiveRow('isApproach', '1');
      }
    },
    {
      label: 'Volley',
      action: () => {
        updateActiveRow('isVolley', '1');
      }
    },
    {
      label: 'Overhead',
      action: () => {
        updateActiveRow('isOverhead', '1');
      }
    },
    {
      label: 'Lob',
      action: () => {
        updateActiveRow('isLob', '1');
      }
    },
    {
      label: 'Player1AtNet',
      action: () => {
        updateActiveRow('atNetPlayer1', '1');
      }
    },
    {
      label: 'Player2AtNet',
      action: () => {
        updateActiveRow('atNetPlayer2', '1');
      }
    },
    {
      label: 'Winner',
      action: () => {
        updateActiveRow('isWinner', '1');
        updateActiveRow('isPointEnd', '1');
      }
    },
    {
      label: 'Exciting Point',
      action: () => {
        updateActiveRow('isExcitingPoint', '1');
      }
    },
    {
      courtImage: true,
      label: 'Select Shot Result Location',
      action: (data) => {
        updateActiveRow('shotLocationX', data.x);
        updateActiveRow('shotLocationY', data.y);
        // assuming 0 is halfway point
        if (data.x <= 0 & data.table[data.activeRowIndex]["shotContactX"] <= 0) {
          updateActiveRow('shotDirection', "Down the Line");
        }
        else if (data.x <= 0 & data.table[data.activeRowIndex]["shotContactX"] > 0) {
          updateActiveRow('shotDirection', "Crosscourt");
        }
        else if (data.x >= 0 & data.table[data.activeRowIndex]["shotContactX"] < 0) {
          updateActiveRow('shotDirection', "Crosscourt");
        }
        else {
          updateActiveRow('shotDirection', "Down the Line");
        }
        if (data.table[data.activeRowIndex]["shotContactY"] >= 0) {
          if (data.y >= 0) {
            updateActiveRow('isErrorNet', '1');
            updateActiveRow('isPointEnd', '1');
          }
          if (data.x > 157) {
            updateActiveRow('isErrorWideL', '1');
            updateActiveRow('isPointEnd', '1');
          }
          if (data.x < -157) {
            updateActiveRow('isErrorWideR', '1');
            updateActiveRow('isPointEnd', '1');
          }
          if (data.y < -455) {
            updateActiveRow('isErrorLong', '1');
            updateActiveRow('isPointEnd', '1');
          }

        }
        else {
          if (data.y <= 0) {
            updateActiveRow('isErrorNet', '1');
            updateActiveRow('isPointEnd', '1');
          }
          if (data.x < -157) {
            updateActiveRow('isErrorWideL', '1');
            updateActiveRow('isPointEnd', '1');
          }
          if (data.x > 157) {
            updateActiveRow('isErrorWideR', '1');
            updateActiveRow('isPointEnd', '1');
          }
          if (data.y > 455) {
            updateActiveRow('isErrorLong', '1');
            updateActiveRow('isPointEnd', '1');
          }
        }

        if ((data.table[data.activeRowIndex]["shotContactY"] >= 0 & ((data.y >= 0 || data.y <-455) || (data.x > 157 || data.x < -157))) ||
                (data.table[data.activeRowIndex]["shotContactY"] < 0 & ((data.y <= 0 || data.y > 455) || (data.x > 157 || data.x < -157))) ||
                (data.table[data.activeRowIndex]["isWinner"] == "1")) {
          serverScore =  parseInt(data.table[data.activeRowIndex]['pointScore'].split("-")[0]);
          returnerScore =  parseInt(data.table[data.activeRowIndex]['pointScore'].split("-")[1]);
          player1GameScore =  parseInt(data.table[data.activeRowIndex]['gameScore'].split("-")[0]);
          player2GameScore = parseInt(data.table[data.activeRowIndex]['gameScore'].split("-")[1]); 
          player1SetScore =  parseInt(data.table[data.activeRowIndex]['setScore'].split("-")[0]);
          player2SetScore = parseInt(data.table[data.activeRowIndex]['setScore'].split("-")[1]);
          if (player1GameScore == 6 && player2GameScore == 6) {
            updateTiebreakScore(parseInt(data.table[data.activeRowIndex]["shotInRally"]), 
              data.table[data.activeRowIndex]["isWinner"], 
              data.table[data.activeRowIndex]["serverName"]);
            if (serverScore >= 7 && (serverScore - returnerScore) >= 2 ) {
              player1SetScore += 1;
              player1GameScore = 0;
              player2GameScore = 0;
              serverScore = 0;
              returnerScore = 0;
              setCurrentPage('ServerName');
            }
            else if (returnerScore >= 7 && (returnerScore - serverScore) >= 2 ) {
              player1SetScore += 1;
              player1GameScore = 0;
              player2GameScore = 0;
              returnerScore = 0;
              serverScore = 0;
              setCurrentPage('ServerName');
            }
            else {
              if ((serverScore + returnerScore) % 2 == 1) { // need to switch scores cuz server switches
                var tempServeScore = serverScore;
                serverScore = returnerScore;
                returnerScore = tempServeScore;
              }
              setCurrentPage('ServerName');
            }
          }   
          else {
            updateScore(parseInt(data.table[data.activeRowIndex]["shotInRally"]), 
              data.table[data.activeRowIndex]["isWinner"], 
              data.table[data.activeRowIndex]["serverName"]);
            if (serverScore == 0 && returnerScore == 0) {
              if (player1GameScore >= 6) {
                if (player1GameScore - player2GameScore >= 2) {
                  player1SetScore += 1;
                  player1GameScore = 0;
                  player2GameScore = 0;
                }
              }
              else if (player2GameScore >= 6) {
                if (player2GameScore - player1GameScore >= 2) {
                  player2SetScore += 1;
                  player2GameScore = 0;
                  player1GameScore = 0;
                }                
              }
              setCurrentPage('ServerName');
            }
            else {
              addNewRow();
              if (serverScore == 40 && returnerScore == 40) {
                updateActiveRow('serverName', data.table[data.activeRowIndex]['serverName'])
                updateActiveRow('serverFarNear', data.table[data.activeRowIndex]['serverFarNear'])
                setCurrentPage('PointScore');
              }
              else {
                updateActiveRow('serverFarNear', data.table[data.activeRowIndex]['serverFarNear']);
                updateActiveRow('serverName', data.table[data.activeRowIndex]['serverName']);
                updateActiveRow('pointScore', serverScore + '-' + returnerScore);
                updateActiveRow('gameScore', data.table[data.activeRowIndex]['gameScore']);
                updateActiveRow('setScore', data.table[data.activeRowIndex]['setScore']);
                updateActiveRow('isPointStart', 1);
                updateActiveRow('shotInRally', 1);
                updateActiveRow('side', chooseSide());
                setCurrentPage('FirstServe');  
              }   
            }
          }
        }
        else 
        {
          setCurrentPage('GroundstrokeContact');
        }
            
      }
            
    },
  ],
});

export const columnNamesUpdated = [
  'pointScore',
  'gameScore',
  'setScore',
  'isPointStart',
  'pointStartTime',
  'isPointEnd',
  'pointEndTime',
  'pointNumber',
  'isBreakPoint',
  'shotInRally',
  'side',
  'serverName',
  'serverFarNear',
  'firstServeIn',
  'firstServeZone',
  'firstServeXCoord',
  'firstServeYCoord',
  'secondServeIn',
  'secondServeZone',
  'secondServeXCoord',
  'secondServeYCoord',
  'isAce',
  'shotContactX',
  'shotContactY',
  'shotDirection',
  'shotFhBh',
  'isSlice',
  'isVolley',
  'isOverhead',
  'isApproach',
  'isDropshot',
  'isExcitingPoint',
  'atNetPlayer1',
  'atNetPlayer2',
  'isLob',
  'shotLocationX',
  'shotLocationY',
  'isWinner',
  'isErrorWideR',
  'isErrorWideL',
  'isErrorNet',
  'isErrorLong',
  'clientTeam',
  'Date',
  'Division',
  'Event',
  'lineupPosition',
  'matchDetails',
  'matchVenue',
  'opponentTeam',
  'player1Name',
  'player2Name',
  'player1Hand',
  'player2Hand',
  'Round',
  'Surface',
  'Notes',
];
