import React, { useState, useEffect } from 'react';
import HomePage from './pages/homePage.jsx'; // Adjust path if necessary
import { Analytics } from '@vercel/analytics/react'; // 1. Import Vercel Analytics

const App = () => {
  // 1. The master state that holds all rooms for the entire app
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  // 2. Fetch the data ONE TIME when the app loads
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const response = await fetch('https://uni-room-backend.onrender.com/api/rooms');
        const data = await response.json();
        
        // Save the live data to our master state
        setRooms(data); 
      } catch (error) {
        console.error("Failed to fetch rooms:", error);
      } finally {
        setLoading(false); // Turn off the loading screen
      }
    };

    fetchRooms();
  }, []); // Empty array ensures this only happens once

  // 3. Show a loading screen while waiting for the backend
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-white">
        <p className="text-zinc-500 font-rubik animate-pulse">Loading live campus data...</p>
      </div>
    );
  }

  // 4. Pass the fetched rooms down into HomePage!
  return (
    <>
    <HomePage rooms={rooms} />

    // This invisible component tracks your traffic silently
    <Analytics />
    </>
  );
};

export default App;