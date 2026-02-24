import React, { useState, useEffect } from 'react';
import ClassCard from './base-components/classCard'; // Kept your exact file path

const ClassCardList = () => {
  // 1. Replace the hardcoded array with React State
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  // 2. Fetch the live data from your Node.js server when the component loads
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/rooms');
        const data = await response.json();
        
        setRooms(data); // Save the live Thabella data to our state
      } catch (error) {
        console.error("Failed to fetch rooms:", error);
      } finally {
        setLoading(false); // Turn off the loading screen
      }
    };

    fetchRooms();
  }, []); // The empty array [] means this runs exactly once when the page opens

  // 3. Show a quick loading message while waiting for the server
  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <p className="text-zinc-500 font-rubik animate-pulse">Loading live room data...</p>
      </div>
    );
  }

  // 4. Return the exact same visual structure as your previous code
  return (
    <div className="flex flex-col gap-5 p-4 pb-20"> 
      {/* The map() function now loops through the live 'rooms' data instead of 'classes' */}
      {rooms.map((room) => (
        <ClassCard 
          key={room.id} // React still gets its unique key
          roomNumber={room.roomNumber}
          capacity={room.capacity}
          status={room.status}
          timeInfo={room.timeInfo}
          image={room.image} // This will be null from the backend, triggering your placeholder
        />
      ))}
    </div>
  );
};

export default ClassCardList;