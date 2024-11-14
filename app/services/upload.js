import {
  collection,
  addDoc,
  query,
  where,
  getDoc,
  getDocs,
  updateDoc,
  doc,
  arrayUnion
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage' // Import storage functions
import { db, storage } from '../services/initializeFirebase.js' // Ensure storage is exported from initializeFirebase.js
import { useData } from '../components/DataProvider.js' // Import the hook

async function useUploadMatch(
  sets,
  videoId,
  pointsJson,
  pdfFile,
  teams,
  players,
  matchDate,
  singles,
  matchDetails,
  collectionName
) {
  // Use the createMatch function from the useMatchData hook
  const { createMatch } = useData()
  if (
    !sets ||
    !videoId ||
    !teams ||
    !players ||
    !matchDate ||
    !singles ||
    !matchDetails ||
    !collectionName
  ) {
    console.error('All fields are required.')
    return // Exit the function if any field is empty
  }

  try {
    let pdfUrl = null
    if (pdfFile) {
      // First, upload the PDF to Firebase Storage
      const pdfRef = ref(storage, `match-pdfs/${pdfFile.name}`)
      const snapshot = await uploadBytes(pdfRef, pdfFile)
      pdfUrl = await getDownloadURL(snapshot.ref)
    }

    // untagged matches
    let published = true
    if (pointsJson === null) published = false

    // matchName: P1 T1 vs. P2 T2
    const matchName = `${players.client.firstName} ${players.client.lastName} ${teams.clientTeam} vs. ${players.opponent.firstName} ${players.opponent.lastName} ${teams.opponentTeam}`

    await createMatch(collectionName, {
      name: matchName,
      videoId,
      sets,
      pdfUrl,
      matchDate,
      teams,
      players,
      published,
      singles,
      matchDetails,
      points: pointsJson || []
    })

    console.log('Match Document uploaded successfully.')
  } catch (e) {
    console.error('Error uploading Match Document: ', e)
  }
}

async function uploadTeam(teamName, logoFile) {
  if (!teamName || !logoFile) {
    console.error('All fields are required.')
    return // Exit the function if any field is empty
  }

  try {
    let logoUrl = null
    if (logoFile) {
      // First, upload the PNG/JPG to Firebase Storage
      const logoRef = ref(storage, `logos/${logoFile.name}`)
      const snapshot = await uploadBytes(logoRef, logoFile)
      logoUrl = await getDownloadURL(snapshot.ref)
    }

    // Then, save the match data along with the Logo URL to Firestore
    const mens = teamName + ' (M)'
    const womens = teamName + ' (W)'
    const docRefM = await addDoc(collection(db, 'teams'), {
      name: mens,
      logoUrl,
      players: []
    })
    const docRefW = await addDoc(collection(db, 'teams'), {
      name: womens,
      logoUrl,
      players: []
    })
    console.log(
      'Team Document(M) written with ID: ',
      docRefM.id,
      ' and (W): ',
      docRefW.id
    )
  } catch (e) {
    console.error('Error adding Team Document: ', e)
  }
}

async function uploadPlayer(
  playerFirstName,
  playerLastName,
  playerHand,
  playerPhoto,
  teamName
) {
  if (!playerFirstName || !playerLastName || !teamName) {
    console.error('All fields are required.')
    return // Exit the function if any field is empty
  }

  try {
    let playerPhotoUrl = null
    if (playerPhoto) {
      // First, upload the PNG/JPG to Firebase Storage
      const playerPhotoRef = ref(storage, `player-photos/${playerPhoto.name}`)
      const snapshot = await uploadBytes(playerPhotoRef, playerPhoto)
      playerPhotoUrl = await getDownloadURL(snapshot.ref)
    }
    // Check if the team exists
    const teamRef = collection(db, 'teams')
    const teamQuery = query(teamRef, where('name', '==', teamName))
    const teamSnapshot = await getDocs(teamQuery)

    if (teamSnapshot.empty) {
      console.log('Team does not exist')
      return
    }

    // Get the document reference
    const teamDoc = doc(db, 'teams', teamSnapshot.docs[0].id)

    // Check if the 'players' field exists
    const teamData = (await getDoc(teamDoc)).data()
    if (!teamData.players) {
      // If 'players' field doesn't exist, create it and initialize it as an array
      // backwards support for old storage schema
      await updateDoc(teamDoc, {
        players: [
          {
            firstName: playerFirstName,
            lastName: playerLastName,
            playerHand,
            photo: playerPhotoUrl
          }
        ]
      })
    } else {
      // If 'players' field exists, append the playerName to the array
      await updateDoc(teamDoc, {
        players: arrayUnion({
          firstName: playerFirstName,
          lastName: playerLastName,
          photo: playerPhotoUrl
        })
      })
    }
  } catch (e) {
    console.error('Error adding Player Field: ', e)
  }
}

export { useUploadMatch, uploadTeam, uploadPlayer }
