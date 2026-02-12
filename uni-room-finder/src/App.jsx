import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/header.jsx'
import HomePage from './pages/homePage.jsx';
import LoginPage from './pages/loginPage.jsx';
// import RegisterPage from './pages/registerpage.jsx';
import Footer from './components/footer.jsx'

import React, { useState, useEffect } from 'react';
import { authAPI } from './services/api';





const App = () => {
  return (
    <Router> {/* This MUST wrap everything */}
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/netzwerk" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </main>
    </Router>

  )
}

export default App