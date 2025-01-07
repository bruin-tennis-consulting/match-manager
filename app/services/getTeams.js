import { collection, getDocs } from 'firebase/firestore'

import { db } from '@/app/services/initializeFirebase.js'

const getTeams = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'teams'))
    const teams = querySnapshot.docs.map((doc) => doc.data())
    const sortedTeams = teams
      .slice()
      .sort((a, b) =>
        a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
      )
    return sortedTeams
  } catch (error) {
    console.error('Error retrieving files:', error)
    throw error
  }
}

export default getTeams
