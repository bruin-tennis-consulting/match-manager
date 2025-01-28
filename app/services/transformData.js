// This takes in matchData
function transformData(matchData) {
  const pointsData = matchData.points
  let dataVersion = -1

  // This is the original Dartfish format we used.
  if (Object.prototype.hasOwnProperty.call(pointsData[0], 'Position')) {
    dataVersion = 0
  }
  // This is the new format Leo made.
  else if (pointsData[0].serverName) {
    dataVersion = 1
  }

  if (dataVersion === 0) {
    // Do nothing, this is the original format
  } else if (dataVersion === 1) {
    matchData.points = transformDataVersion1(pointsData)
  }
  return matchData
}

function transformDataVersion1(pointsData) {
  const pointsArray = []
  let currentPoint = {}
  let shotCounter = 1

  pointsData.forEach((shot, index) => {
    // Prefix each key with "Shot N:" and add to currentPoint, with special handling for certain keys
    for (const key in shot) {
      let newKey = `Shot ${shotCounter}: ${key}`
      if (shotCounter === 1) {
        if (key === 'isPointStartTime') newKey = 'Position'
        else if (key === 'pointScore') newKey = 'Name'
      }
      currentPoint[newKey] = shot[key]
    }

    shotCounter++

    // If it's the last shot in the data or the end of a point
    if (index === pointsData.length - 1 || shot.isPointEnd === 1) {
      pointsArray.push(currentPoint)
      currentPoint = {}
      shotCounter = 1
    }
  })

  return pointsArray
}

export default transformData
