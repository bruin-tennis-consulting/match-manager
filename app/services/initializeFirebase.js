import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyBOvEiiwKE_Q_aTWdyOpTIDmYmbPHA9KOg',
  authDomain: 'match-viewing-dashboard.firebaseapp.com',
  projectId: 'match-viewing-dashboard',
  storageBucket: 'match-viewing-dashboard.appspot.com',
  messagingSenderId: '276222404565',
  appId: '1:276222404565:web:d295bf29156c4bb4a73f5c'
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Get the Firestore service
const db = getFirestore(app)

// Get the Firebase Storage service
const storage = getStorage(app)

const auth = getAuth(app)

export { db, storage, auth } // Export both Firestore and Storage
