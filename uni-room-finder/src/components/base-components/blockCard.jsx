import React from 'react';

const BlockCard = ({ name, roomsFree, image, onClick }) => {
  // Determine text color for availability based on how many rooms are free
  const isAvailable = roomsFree > 0;

  return (
    <button 
      onClick={onClick}
      className="relative w-full h-52 rounded-xl border border-stone-200 overflow-hidden group shadow-sm hover:shadow-md transition-all text-left"
    >
      {/* Fallback approach: If image is provided, show it. 
        If not, show a solid color background. 
      */}
      {image ? (
        <img 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
          src={image} 
          alt={name} 
        />
      ) : (
        <div className={`w-full h-full flex items-center justify-center ${isAvailable ? 'bg-green-100' : 'bg-stone-100'}`}>
          <span className="text-stone-400 font-Rubik">No Photo</span>
        </div>
      )}

      {/* Overlay Bar */}
      <div className="absolute top-0 left-0 w-full h-16 bg-black/50 backdrop-blur-[4px] px-4 flex items-center">
        <div className="flex flex-col">
          <h3 className="text-white text-xl font-bold font-Rubik leading-7">
            {name}
          </h3>
          <span className={`text-xs font-bold font-Rubik uppercase tracking-wide ${isAvailable ? 'text-green-400' : 'text-stone-300'}`}>
            {roomsFree} {roomsFree === 1 ? 'Room' : 'Rooms'} free
          </span>
        </div>
      </div>
    </button>
  );
};

export default BlockCard;