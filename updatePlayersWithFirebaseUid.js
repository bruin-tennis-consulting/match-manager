import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { v4 as uuidv4 } from 'uuid'

const serviceAccountKeyPath =
  './match-viewing-dashboard-firebase-adminsdk-aq6ab-baa0bd2aa1.json'
const teamDocumentId = 'swEvkaa5GttlK7bmtpqm' // The ID of the UCLA team document

try {
  // Initialize Firebase Admin SDK
  initializeApp({
    credential: cert(serviceAccountKeyPath)
  })

  const db = getFirestore()
  const teamDocRef = db.collection('teams').doc(teamDocumentId)

  console.log(
    `Attempting to update players in team document: ${teamDocumentId}`
  )

  await db.runTransaction(async (transaction) => {
    const teamDocSnap = await transaction.get(teamDocRef)

    if (!teamDocSnap.exists) {
      throw new Error(
        `Document ${teamDocumentId} does not exist in the teams collection.`
      )
    }

    const teamData = teamDocSnap.data()
    const players = teamData.players || []
    let modified = false

    if (!Array.isArray(players)) {
      console.warn(
        `The 'players' field in document ${teamDocumentId} is not an array. Skipping update.`
      )
      return
    }

    const updatedPlayers = players.map((player, index) => {
      if (typeof player !== 'object' || player === null) {
        console.warn(
          `Player at index ${index} is not a valid object. Skipping.`
        )
        return player // Keep non-object player data as is
      }
      if (!player.firebaseUid) {
        const newFirebaseUid = uuidv4()
        console.log(
          `Adding firebaseUid '${newFirebaseUid}' to player: ${player.firstName} ${player.lastName}`
        )
        modified = true
        return { ...player, firebaseUid: newFirebaseUid }
      } else {
        console.log(
          `Player ${player.firstName} ${player.lastName} already has firebaseUid: ${player.firebaseUid}. Skipping.`
        )
        return player
      }
    })

    if (modified) {
      transaction.update(teamDocRef, {
        players: updatedPlayers,
        updatedAt: new Date()
      }) // Using new Date() for server timestamp via SDK
      console.log(
        `Successfully updated players array in document ${teamDocumentId} with new firebaseUids.`
      )
    } else {
      console.log(`No players needed updating in document ${teamDocumentId}.`)
    }
  })

  console.log('Firestore transaction completed successfully.')
} catch (error) {
  console.error('Error updating Firestore document:', error)
  if (
    error.message.includes('ENOENT') &&
    error.message.includes(serviceAccountKeyPath)
  ) {
    console.error(
      `\n[IMPORTANT] Service account key not found at: ${serviceAccountKeyPath}`
    )
    console.error(
      'Please ensure the path to your service account key is correct in the script.'
    )
  } else if (
    error.code === 'PERMISSION_DENIED' ||
    (error.errorInfo && error.errorInfo.code === 'auth/invalid-credential')
  ) {
    console.error('\n[IMPORTANT] Permission denied or invalid credential.')
    console.error(
      'This might be due to an incorrect or improperly configured service account key, or Firestore security rules.'
    )
  }
}
