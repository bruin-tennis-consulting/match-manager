import Navbar from '@/app/components/Navbar'
import Footer from '@/app/components/Footer'
import { AuthProvider } from '@/app/AuthWrapper'
import { DataProvider } from '@/app/DataProvider'

import '@/app/styles/globals.css'
// eslint-disable-next-line camelcase
import { DM_Sans } from 'next/font/google'

const dmSans = DM_Sans({
  subsets: ['latin'], // Only include the Latin subset (can be expanded)
  weights: ['400', '500', '700'], // Include desired font weights
  display: 'swap' // Ensure the text remains visible during font loading
})

export const metadata = {
  title: 'Tennis Video Viewer',
  description: 'Next13 App Router for UCLA D1 Tennis'
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <title>Match Viewer</title>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <div className={dmSans.className} style={{ width: '100%' }}>
          <AuthProvider>
            <Navbar />
            <DataProvider>{children}</DataProvider>
          </AuthProvider>
        </div>
        <Footer />
      </body>
    </html>
  )
}
