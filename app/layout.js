import Navbar from '@/app/components/Navbar'
import Footer from '@/app/components/Footer'
import { AuthProvider } from '@/app/AuthWrapper'
import { DataProvider } from '@/app/DataProvider'

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
        <div style={{ width: '100%' }}>
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
