import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore'

const db = getFirestore()

/**
 * Creates a user profile in Firestore.
 *
 * @param {Object} authUser - The user object containing user details.
 * @param {string} authUser.uid - The user's unique identifier.
 * @param {string} authUser.email - The user's email address.
 * @param {string} authUser.displayName - The user's display name.
 * @param {Array} authUser.collections - The collections the user is part of.
 * @param {Array} authUser.teams - The teams the user is part of.
 */
export async function createUserProfile(user) {
  await setDoc(doc(db, 'users', user.uid), {
    email: user.email,
    displayName: user.displayName,
    collections: user.collections,
    teams: user.teams
  })
}

/**
 * Fetches a user profile from Firestore.
 *
 * @param {string} userUid - The user's unique identifier.
 * @returns {Promise<Object|null>} The user profile data or null if not found.
 */
export async function getUserProfile(userUid) {
  const userDocRef = doc(db, 'users', userUid)
  const userDoc = await getDoc(userDocRef)

  if (userDoc.exists()) {
    return userDoc.data()
  } else {
    console.log('No such document!')
    return null
  }
}

// user = {
//   uid: 'a3u4V8FDlgQWyf05g5mWf05rpYX2',
//   email: 'uclamens@ucla.edu',
//   displayName: 'UCLA Men\'s Tennis',
//   collections: ['UCLA (W)'],
//   teams: ['Apr1R0VX8AxAU5ODIk5h']
// };

// createUserProfile(user)
//   .then(() => {
//     console.log('User profile created successfully!');
//   })
//   .catch((error) => {
//     console.error('Error creating user profile:', error);
//   });
