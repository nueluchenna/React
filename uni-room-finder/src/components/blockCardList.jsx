import React from 'react';
import BlockCard from './base-components/blockCard';

const BlockCardList = ({ buildings, onBuildingSelect }) => {
  return (
    <main className="p-4 flex flex-col gap-5 mt-2 max-w-md mx-auto w-full">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider font-Rubik">Campus Buildings</h2>
      </div>

      {buildings.map((building, index) => (
        <BlockCard 
          key={index}
          name={`${building.name} Building`}
          roomsFree={building.roomsFree}
          // Use root-relative public path so Vite resolves it correctly in production/Vercel
          image={`/img/${building.name.toLowerCase()}-building.png`}
          onClick={() => onBuildingSelect(building)}
        />
      ))}
    </main>
  );
};

export default BlockCardList;