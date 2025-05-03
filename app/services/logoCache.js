// In-memory cache
const logoCache = new Map()
const CACHE_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours

export const getLogoFromCache = (teamName) => {
  // Check in-memory cache first
  const cachedLogo = logoCache.get(teamName)
  if (cachedLogo && Date.now() - cachedLogo.timestamp < CACHE_EXPIRY) {
    return cachedLogo.url
  }

  // Check localStorage
  const storedCache = localStorage.getItem('logoCache')
  if (storedCache) {
    const parsedCache = JSON.parse(storedCache)
    const storedLogo = parsedCache[teamName]
    if (storedLogo && Date.now() - storedLogo.timestamp < CACHE_EXPIRY) {
      // Update in-memory cache
      logoCache.set(teamName, storedLogo)
      return storedLogo.url
    }
  }

  return null
}

export const setLogoInCache = (teamName, logoUrl) => {
  const cacheEntry = {
    url: logoUrl,
    timestamp: Date.now()
  }

  // Update in-memory cache
  logoCache.set(teamName, cacheEntry)

  // Update localStorage
  const storedCache = localStorage.getItem('logoCache')
  const parsedCache = storedCache ? JSON.parse(storedCache) : {}
  parsedCache[teamName] = cacheEntry
  localStorage.setItem('logoCache', JSON.stringify(parsedCache))
}

export const clearLogoCache = () => {
  logoCache.clear()
  localStorage.removeItem('logoCache')
}
