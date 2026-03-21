import React from 'react';
import BlockCard from './base-components/blockCard';

const BlockCardList = ({ buildings, onBuildingSelect }) => {
  return (
    <div className="flex flex-col gap-4 p-4 max-w-md mx-auto w-full">
      {buildings.map((building, index) => (
        <div key={index} onClick={() => onBuildingSelect(building)} className="cursor-pointer hover:opacity-90 transition-opacity">
          <BlockCard 
            name={`${building.name} Building`}
            roomsFree={building.roomsFree}
            // dynamically grabs standard images like 'k-building.png'
            image={`../../public/img/${building.name.toLowerCase()}-building.png`} 
          />
        </div>
      ))}
    </div>
  );
};

export default BlockCardList;