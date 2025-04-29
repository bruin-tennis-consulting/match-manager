'use client'
import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useContext
} from 'react'
import { collection, getDocs, doc, updateDoc, addDoc, getDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

import { db, storage } from '@/app/services/initializeFirebase.js'
import { useAuth } from '@/app/AuthWrapper.js'
import getTeams from '@/app/services/getTeams.js'
import { getLogoFromCache, setLogoInCache } from '@/app/services/logoCache'

const DataContext = createContext()

export const DataProvider = ({ children }) => {
  // For Match Data
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // For Logos
  const [logos, setLogos] = useState(() => {
    const storedLogos = localStorage.getItem('teamLogos')
    return storedLogos ? JSON.parse(storedLogos) : {}
  })
  const [logosLoading, setLogosLoading] = useState(!Object.keys(logos).length)
  const [logosError, setLogosError] = useState(null)

  const { userProfile } = useAuth()

  const fetchMatches = useCallback(async () => {
    if (userProfile && userProfile.collections) {
      setLoading(true)
      setError(null)
      const allMatches = []

      try {
        for (const col of userProfile.collections) {
          const colRef = collection(db, col)
          const querySnapshot = await getDocs(colRef)

          querySnapshot.docs.forEach((doc) => {
            const matchData = doc.data()
            // Only add matches that are not marked as deleted
            if (!matchData._deleted) {
              // Only include essential match data, exclude points data
              const { points, pointsJson, ...essentialData } = matchData
              allMatches.push({
                id: doc.id,
                collection: col, // Track which collection this match belongs to
                ...essentialData
              })
            }
          })
        }

        setMatches(allMatches)
      } catch (err) {
        setError(err)
      } finally {
        setLoading(false)
      }
    }
  }, [userProfile])

  // Function to fetch detailed match data including points
  const fetchMatchDetails = useCallback(async (matchId, collectionName) => {
    try {
      const matchRef = doc(db, collectionName, matchId)
      const matchDoc = await getDoc(matchRef)
      if (matchDoc.exists()) {
        return matchDoc.data()
      }
      return null
    } catch (error) {
      console.error('Error fetching match details:', error)
      return null
    }
  }, [])

  const updateMatch = useCallback(
    async (matchId, updatedData) => {
      try {
        // Get the match collection reference
        const matchToUpdate = matches.find((match) => match.id === matchId)
        if (!matchToUpdate) {
          throw new Error('Match not found')
        }

        setMatches((prevMatches) =>
          prevMatches.map((match) =>
            match.id === matchId ? { ...match, ...updatedData } : match
          )
        )

        const matchDocRef = doc(db, matchToUpdate.collection, matchId)
        await updateDoc(matchDocRef, updatedData)

        await fetchMatches()
      } catch (err) {
        setError(err)
        console.error('Error updating match:', err)
      }
    },
    [fetchMatches, matches]
  )

  const createMatch = useCallback(
    async (collectionName, newMatchData) => {
      try {
        let pdfUrl = null
        if (newMatchData.pdfFile) {
          const pdfRef = ref(storage, `match-pdfs/${newMatchData.pdfFile.name}`)
          const metadata = {
            contentType: 'application/pdf'
          }

          const snapshot = await uploadBytes(
            pdfRef,
            newMatchData.pdfFile.blob,
            metadata
          )
          pdfUrl = await getDownloadURL(snapshot.ref)
        }
        console.log(pdfUrl)
        newMatchData.pdfFile = pdfUrl

        const newMatch = {
          id: 'temp-id',
          collection: collectionName,
          ...newMatchData
        }
        setMatches((prevMatches) => [...prevMatches, newMatch])

        // Actual Firestore addition
        const colRef = collection(db, collectionName)
        await addDoc(colRef, newMatchData)
        await fetchMatches()
      } catch (err) {
        setError(err)
        console.error('DataProvider: Error creating new match:', err)
        throw err
      }
    },
    [fetchMatches, setMatches, setError]
  )

  const fetchLogos = useCallback(async () => {
    setLogosLoading(true)
    setLogosError(null)

    try {
      const teams = await getTeams()
      const logosMap = teams.reduce((acc, team) => {
        // Check cache first
        const cachedLogo = getLogoFromCache(team.name)
        if (cachedLogo) {
          acc[team.name] = cachedLogo
        } else {
          acc[team.name] = team.logoUrl
          // Cache the logo
          setLogoInCache(team.name, team.logoUrl)
        }
        return acc
      }, {})

      setLogos(logosMap)
    } catch (err) {
      setLogosError(err)
      console.error('Error fetching team logos:', err)
    } finally {
      setLogosLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMatches()
    fetchLogos()
  }, [fetchMatches, fetchLogos])

  return (
    <DataContext.Provider
      value={{
        matches,
        logos,
        loading: loading || logosLoading,
        error: error || logosError,
        refresh: fetchMatches,
        fetchMatchDetails,
        updateMatch,
        createMatch
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export const useData = () => {
  const context = useContext(DataContext)

  if (!context) {
    throw new Error('useData must be used within a MatchDataProvider')
  }

  const { matches, logos, loading, error, refresh, fetchMatchDetails, updateMatch, createMatch } =
    context

  // Optionally keep `refresh` available for manual use in components
  return { matches, logos, loading, error, refresh, fetchMatchDetails, updateMatch, createMatch }
}
