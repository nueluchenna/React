import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';

// Import your pages
import LandingPage from './pages/LandingPage.jsx';
import MainApp from './MainApp.jsx';

const App = () => {
  return (
    <>
      <Router>
        <Routes>
          {/* When users visit the root URL, show the Landing Page */}
          <Route path="/" element={<LandingPage />} />
          
          {/* When users click "Launch App", show the Room Finder */}
          <Route path="/app" element={<MainApp />} />
        </Routes>
      </Router>
      
      {/* Vercel Analytics stays here so it tracks both pages! */}
      <Analytics />
    </>
  );
};

export default App;