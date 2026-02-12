import React, { useState } from "react";
import BlockCardList from '../components/blockCardList';
import ClassCardList from '../components/classCardList';
import BuildingHeader from '../components/buildingHeader';
import Header from '../components/header.jsx';
// Imagine this comes from your backend documentation


const HomePage = ({ questions }) => {
  const [selectedBuilding, setSelectedBuilding] = useState(null);

  return (
    <>
      <div className="bg-white min-h-screen relative">
        
        {/* CONDITIONAL RENDERING: Check if a building is selected */}
        
        {!selectedBuilding ? (
          // === VIEW 1: HOME PAGE ===
          <>
            <Header title="Find a room" />
            <BlockCardList onBuildingSelect={(building) => setSelectedBuilding(building)} />
          </>
        ) : (
          // === VIEW 2: INSIDE A BUILDING ===
          <>
            <BuildingHeader 
              title={selectedBuilding.name} 
              onBack={() => setSelectedBuilding(null)} // Clicking back resets state to null
            />
            {/* You can filter ClassCardList by building ID later if you want */}
            <ClassCardList />
          </>
        )}

      </div>
    </>
  );
};

export default HomePage;