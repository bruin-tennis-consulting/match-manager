import { collection, getDocs } from 'firebase/firestore'
import { db } from './initializeFirebase'
import JSZip from 'jszip'

export async function downloadCollectionAsZip(collectionName) {
  try {
    const colRef = collection(db, collectionName)
    const snapshot = await getDocs(colRef)

    if (snapshot.empty) {
      alert(`No documents found in '${collectionName}'`)
      return
    }

    const zip = new JSZip()

    snapshot.forEach((doc) => {
      const data = doc.data()
      const content = JSON.stringify(data, null, 2)
      zip.file(`${doc.id}.json`, content)
    })

    const blob = await zip.generateAsync({ type: 'blob' })

    // Trigger download
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${collectionName}.zip`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Failed to export collection:', error)
    alert('Something went wrong. Check the console.')
  }
}
