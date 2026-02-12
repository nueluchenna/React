import React from 'react';

const BlockCard = ({ name, roomsFree, image }) => {
  return (
    <div className="relative w-full h-52 rounded-xl border border-stone-300 overflow-hidden group cursor-pointer shadow-sm hover:shadow-md transition-all">
      
      {/* Background Image with Hover Zoom Effect */}
      <img 
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
        src={image} 
        alt={name} 
      />

      {/* Top Gradient/Overlay Bar */}
      <div className="absolute top-0 left-0 w-full h-16 bg-zinc-900/70 backdrop-blur-[2px] px-4 flex items-center">
        <div className="flex flex-col items-start">
          <h3 className="text-white text-xl font-bold font-Rubik leading-7">
            {name}
          </h3>
          <span className="text-green-400 text-xs font-bold font-Rubik uppercase tracking-wide">
            {roomsFree} {roomsFree === 1 ? 'Room' : 'Rooms'} free
          </span>
        </div>
      </div>
      
    </div>
  );
};

export default BlockCard;