// const extractSingleSetScore = (setObject) => {
//   // no third set
//   if (!setObject) return { score: '', type: '' }
//   const setType =
//     setObject.tiebreakScore !== null &&
//     setObject.tiebreakScore !== '' &&
//     setObject.tiebreakScore !== undefined
//       ? 'tiebreakScore'
//       : 'gameScore'
//   return {
//     // score: setType === "gameScore" ? setObject.gameScore : setObject.tiebreakScore,
//     score: setObject.gameScore,
//     type: setType
//   }
// }

// // score: '5-6', score[0] is 5 and score[2] is 6
// const extractPlayerFinalScores = (setScores, playerName, i) => {
//   return setScores.map((setScore) => ({
//     score: parseInt(setScore.score[i]),
//     playerName
//   }))
// }

// const extractSetScores = (finalScore) => {
//   let isUnfinished = false
//   // Extract Final Scores from Each Set
//   const firstSetObject = finalScore.filter((score) => score.setNum === 1).pop()
//   const secondSetObject = finalScore.filter((score) => score.setNum === 2).pop()
//   const thirdSetObject = finalScore.filter((score) => score.setNum === 3).pop()
//   const setObjects = [firstSetObject, secondSetObject, thirdSetObject]
//   // // Extract Scores and type of Each Set
//   const setScores = [
//     extractSingleSetScore(firstSetObject),
//     extractSingleSetScore(secondSetObject),
//     extractSingleSetScore(thirdSetObject)
//   ]

//   // Extract Player Names and Assign Scores for Each Player
//   // player1 is client, player2 is opponent
//   const player1Name = firstSetObject.player1Name
//   const player2Name = firstSetObject.player2Name
//   const player1FinalScores = extractPlayerFinalScores(setScores, player1Name, 0)
//   const player2FinalScores = extractPlayerFinalScores(setScores, player2Name, 2)

//   // Tiebreaker scores array
//   const player1TieScores = Array(3)
//   const player2TieScores = Array(3)

//   // Check if sets are tiebreaks
//   // Non tiebreak score winners are given winning point
//   const processSet = (
//     setScores,
//     setObjects,
//     player1FinalScores,
//     player2FinalScores,
//     player1TieScores,
//     player2TieScores,
//     index
//   ) => {
//     if (setScores[index].type === 'gameScore') {
//       // Check if unfinished match
//       if (
//         player1FinalScores[index].score < 5 &&
//         player2FinalScores[index].score < 5 &&
//         !isUnfinished
//       ) {
//         isUnfinished = true
//       }
//       // Increment winners score by 1
//       if (player1FinalScores[index].score > player2FinalScores[index].score) {
//         player1FinalScores[index].score++
//       } else {
//         player2FinalScores[index].score++
//       }
//     } else if (setScores[index].type === 'tiebreakScore') {
//       // Compare tiebreak scores and increment winner
//       player1TieScores[index] = parseInt(setObjects[index].tiebreakScore[0])
//       player2TieScores[index] = parseInt(setObjects[index].tiebreakScore[2])
//       // check if unfinished match
//       if (
//         player1FinalScores[index].score < 5 &&
//         player2FinalScores[index].score < 5 &&
//         !isUnfinished
//       ) {
//         isUnfinished = true
//       }
//       if (player1TieScores[index] > player2TieScores[index]) {
//         player1FinalScores[index].score++
//         // Tiebreak more than 7 points
//         if (player1TieScores[index] >= 6) {
//           player1TieScores[index]++
//         }
//       } else {
//         if (player2TieScores[index] >= 6) {
//           player2TieScores[index]++
//         }
//         player2FinalScores[index].score++
//       }
//     } else {
//       console.log('unrecognized setscore type')
//     }
//   }

//   // Process each set score.
//   setScores.forEach((_, index) => {
//     processSet(
//       setScores,
//       setObjects,
//       player1FinalScores,
//       player2FinalScores,
//       player1TieScores,
//       player2TieScores,
//       index
//     )
//   })

//   return {
//     player1Name,
//     player2Name,
//     player1FinalScores,
//     player2FinalScores,
//     player1TieScores,
//     player2TieScores,
//     isUnfinished
//   }
// }

// export default extractSetScores
//empty functions

extractsetScores = () => {
  return null;
}
