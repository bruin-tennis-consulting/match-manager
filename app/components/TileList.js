'use client'

import { useEffect, useState } from 'react'
import DashboardMatch from '@/app/components/DashboardMatch.js'
import { db } from '@/app/services/initializeFirebase.js'
import transformData from '@/app/services/transformData.js'
// import MatchTiles from './MatchTiles.js'
import { getDocs, collection } from 'firebase/firestore'

const groupByDate = (matches) => {
  const grouped = {}
  // Group matches into arrays by date
  matches.forEach((match) => {
    const date = match.matchDate || 'unknown'
    if (!grouped[date]) {
      grouped[date] = []
    }
    grouped[date].push(match)
  })
  // Convert the object into an array of arrays and sort by date descending
  return Object.entries(grouped)
    .sort((a, b) => {
      // Convert date strings to Date objects for comparison
      // 'unknown' dates are treated as the earliest possible date
      const dateA = a[0] === 'unknown' ? new Date(0) : new Date(a[0])
      const dateB = b[0] === 'unknown' ? new Date(0) : new Date(b[0])
      return dateB - dateA // Sort descending
    })
    .map((entry) => entry[1]) // Extract only the arrays of matches
}

const TileList = () => {
  const [matchList, setMatchList] = useState([])

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'UCLA (W)'))
        // Iterate over each document, transform the data, and collect the results
        const transformedMatches = querySnapshot.docs.map((doc) => {
          const data = doc.data() // Get the data of each document
          return transformData(data) // Assuming transformData is a function you have that processes each document's data
        })
        const sortedDate = groupByDate(transformedMatches)
        setMatchList(sortedDate) // Update your state with the transformed matches
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }

    fetchMatches()
  }, [])

  return (
    <div>
      {matchList &&
        matchList.map(
          (matches, index) =>
            matches.length > 0 && (
              <DashboardMatch key={index} matchInfo={matches} />
            )
        )}
    </div>
  )
}

export default TileList
