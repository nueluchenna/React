import React from 'react';
import BlockCard from './base-components/blockCard';

const BlockCardList = ({ onBuildingSelect }) => {
  // Your Building Data
  const buildings = [
    {
      id: 1,
      name: 'K Building',
      roomsFree: 2,
      image: '../../public/img/k-building.png' // Make sure to add this image to your assets folder
    },
    {
      id: 2,
      name: 'E Building',
      roomsFree: 1,
      image: '../../public/img/e-building.png' // Make sure to add this image to your assets folder
    },
    {
      id: 3,
      name: 'A Building',
      roomsFree: 1,
      image: '../../public/img/a-building.png' // Make sure to add this image to your assets folder
    }
  ];

  return (
    // 'max-w-md' limits the width on desktop so it looks like a mobile app
    // 'mx-auto' centers it
    <div className="flex flex-col gap-4 p-4 max-w-md mx-auto w-full">
      {buildings.map((building) => (
        // 2. Wrap the card in a div that handles the click
        <div key={building.id} onClick={() => onBuildingSelect(building)}>
          <BlockCard 
            name={building.name}
            roomsFree={building.roomsFree}
            image={building.image}
          />
        </div>
      ))}
    </div>
  );
};

export default BlockCardList;