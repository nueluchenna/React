import React from 'react'
import Hero from '../components/Hero.jsx'
import HomeCards from '../components/HomeCards.jsx'
import Joblistings from '../components/Joblistings.jsx'
import ViewAllJobs from '../components/viewAllJobs.jsx'

function HomePage() {
  return (
    <>
        <Hero />
        <HomeCards />
        <Joblistings isHome='true'/>
        <ViewAllJobs />
    </>
  )
}

export default HomePage