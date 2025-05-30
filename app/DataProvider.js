'use client'
import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useContext
} from 'react'
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  getDoc,
  query,
  where
} from 'firebase/firestore'
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

  // Optimized fetchMatches version with query filtering
  const fetchMatches = useCallback(async () => {
    if (!userProfile?.collections?.length) return

    setLoading(true)
    setError(null)

    try {
      // Create all promises at once instead of awaiting each one sequentially
      const collectionPromises = userProfile.collections.map(async (col) => {
        const colRef = collection(db, col)
        const filteredQuery = query(colRef, where('_deleted', '==', false))
        const querySnapshot = await getDocs(filteredQuery)

        // Process documents in bulk rather than in forEach
        return querySnapshot.docs.map((doc) => ({
          id: doc.id,
          collection: col,
          ...doc.data()
        }))
      })

      // Wait for all promises to resolve
      const matchesArrays = await Promise.all(collectionPromises)

      // Flatten the array of arrays
      setMatches(matchesArrays.flat())
    } catch (err) {
      console.error('Error fetching matches:', err)
      setError(err)
    } finally {
      setLoading(false)
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
        newMatchData._deleted = false

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

  const {
    matches,
    logos,
    loading,
    error,
    refresh,
    fetchMatchDetails,
    updateMatch,
    createMatch
  } = context

  // Optionally keep `refresh` available for manual use in components
  return {
    matches,
    logos,
    loading,
    error,
    refresh,
    fetchMatchDetails,
    updateMatch,
    createMatch
  }
}
