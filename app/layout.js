import Footer from '@/app/components/Footer'
import { AuthProvider } from '@/app/AuthWrapper'
import { DataProvider } from '@/app/DataProvider'
import ConditionalNavbar from './components/ConditonalNavBar'

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
        <link
          href="https://api.fontshare.com/css?f[]=clash-display@100,300,400,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className={`${dmSans.className} root`}>
          <AuthProvider>
            <ConditionalNavbar />
            <DataProvider>{children}</DataProvider>
          </AuthProvider>
        </div>
        <Footer />
      </body>
    </html>
  )
}
