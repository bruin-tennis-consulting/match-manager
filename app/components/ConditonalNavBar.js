// app/components/ConditionalNavbar.jsx
'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Navbar from '@/app/components/Navbar'
import NavbarMobile from '@/app/components/NavBarMobile'

export default function ConditionalNavbar() {
  const [isMobile, setIsMobile] = useState(false)
  const pathname = usePathname()
  const isHomePage = pathname === '/'
  useEffect(() => {
    const checkIfMobile = () => setIsMobile(window.innerWidth < 400)
    checkIfMobile()
    window.addEventListener('resize', checkIfMobile)
    return () => window.removeEventListener('resize', checkIfMobile)
  }, [])
  return isHomePage && isMobile ? <NavbarMobile /> : <Navbar />
}
