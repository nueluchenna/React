import React, { useState, useMemo } from "react";
import BlockCardList from '../components/blockCardList';
import ClassCardList from '../components/classCardList';
import BuildingHeader from '../components/buildingHeader';
import Header from '../components/header.jsx';

// A-L, excluding F, G, H
const ALLOWED_BUILDINGS = ['A', 'B', 'C', 'D', 'E', 'I', 'J', 'K', 'L'];

const HomePage = ({ rooms = [] }) => {
  const [selectedBuilding, setSelectedBuilding] = useState(null);

  // 1. Generate homepage building cards & count free rooms
  const availableBuildings = useMemo(() => {
    // Extract first letter from roomNumber (e.g., "K101" -> "K")
    const extractedLetters = rooms
      .map(room => room.roomNumber ? room.roomNumber.charAt(0).toUpperCase() : '')
      .filter(letter => ALLOWED_BUILDINGS.includes(letter));

    // Remove duplicates
    const uniqueLetters = [...new Set(extractedLetters)].sort();

    // Map into objects with live free room counts
    return uniqueLetters.map(letter => {
      const roomsInThisBuilding = rooms.filter(r => 
        r.roomNumber && r.roomNumber.charAt(0).toUpperCase() === letter
      );
      const freeCount = roomsInThisBuilding.filter(r => r.status === 'free').length;

      return { 
        name: letter, 
        roomsFree: freeCount 
      };
    });
  }, [rooms]);

  // 2. Filter rooms for the specific building when clicked
  const roomsForSelectedBuilding = useMemo(() => {
    if (!selectedBuilding) return [];
    
    return rooms.filter(room => 
      room.roomNumber && room.roomNumber.charAt(0).toUpperCase() === selectedBuilding.name
    );
  }, [rooms, selectedBuilding]);

  return (
    <div className="bg-white min-h-screen relative">
      {!selectedBuilding ? (
        <>
          <Header title="Find a room" />
          <BlockCardList 
            buildings={availableBuildings} 
            onBuildingSelect={setSelectedBuilding} 
          />
        </>
      ) : (
        <>
          <BuildingHeader 
            title={`${selectedBuilding.name} Building`} 
            onBack={() => setSelectedBuilding(null)} 
          />
          <ClassCardList rooms={roomsForSelectedBuilding} />
        </>
      )}
    </div>
  );
};

export default HomePage;