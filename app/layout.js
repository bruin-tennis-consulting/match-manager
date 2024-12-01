import Toolbar from '@/app/components/Toolbar'
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
        <Toolbar />
        <div style={{ width: '100%' }}>
          <AuthProvider>
            <DataProvider>{children}</DataProvider>
          </AuthProvider>
        </div>
        <Footer />
      </body>
    </html>
  )
}
