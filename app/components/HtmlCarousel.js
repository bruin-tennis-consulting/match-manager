import React, { useState, useEffect } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, Pagination, Keyboard } from 'swiper/modules'

import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'

import styles from '@/app/styles/HtmlCarousel.module.css'

const HtmlCarousel = ({ htmlUrl, onSlideChange }) => {
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchAndParseHtml = async () => {
      if (!htmlUrl) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        // Use proxy API to avoid CORS issues with Firebase Storage
        const proxyUrl = `/api/proxy-html?url=${encodeURIComponent(htmlUrl)}`
        const response = await fetch(proxyUrl)
        if (!response.ok) {
          throw new Error('Failed to fetch HTML content')
        }

        const htmlText = await response.text()

        // Parse the HTML
        const parser = new DOMParser()
        const doc = parser.parseFromString(htmlText, 'text/html')

        // Extract all section elements from the body
        const sectionElements = doc.querySelectorAll('body > section')
        const sectionData = Array.from(sectionElements).map(
          (section, index) => ({
            id: section.id || `section-${index}`,
            content: section.innerHTML,
            className: section.className
          })
        )

        setSections(sectionData)
        setError(null)
      } catch (err) {
        console.error('Error parsing HTML:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchAndParseHtml()
  }, [htmlUrl])

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading visualizations...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.error}>
        <p>Error loading content: {error}</p>
      </div>
    )
  }

  if (sections.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No sections found in the document.</p>
      </div>
    )
  }

  return (
    <div className={styles.carouselContainer}>
      <Swiper
        modules={[Navigation, Pagination, Keyboard]}
        navigation
        pagination={{
          clickable: true,
          dynamicBullets: true
        }}
        keyboard={{
          enabled: true
        }}
        spaceBetween={30}
        slidesPerView={1}
        className={styles.swiper}
        onSlideChange={(swiper) =>
          onSlideChange && onSlideChange(swiper.activeIndex)
        }
      >
        {sections.map((section, index) => (
          <SwiperSlide key={section.id} className={styles.slide}>
            <div className={styles.slideContent}>
              <div className={styles.slideNumber}>
                {index + 1} / {sections.length}
              </div>
              <div
                className={`${styles.sectionWrapper} ${section.className || ''}`}
                dangerouslySetInnerHTML={{ __html: section.content }}
              />
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  )
}

export default HtmlCarousel
