import React from 'react';

const BlockCard = ({ name, roomsFree, image, onClick }) => {
  const isAvailable = roomsFree > 0;

  return (
    <button 
      onClick={onClick}
      // Added 'bg-stone-800' as a solid base to prevent anything leaking through
      className="relative w-full h-52 rounded-xl border border-stone-300 overflow-hidden shadow-md transition-all text-left bg-stone-800"
    >
      {/* BACKGROUND LAYER */}
      {/* Strict check: Only render if image is a valid, non-empty string */}
      {typeof image === 'string' && image.length > 0 ? (
        <img 
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 hover:scale-105" 
          src={image} 
          alt={name} 
        />
      ) : (
        <div className={`absolute inset-0 w-full h-full flex items-center justify-center ${isAvailable ? 'bg-green-700' : 'bg-stone-600'}`}>
          <span className="text-white/50 font-Rubik text-sm uppercase tracking-widest">No Photo</span>
        </div>
      )}

      {/* OVERLAY LAYER (The ONLY place the name should be) */}
      <div className="absolute top-0 left-0 w-full h-16 bg-black/60 backdrop-blur-sm px-4 flex items-center z-10">
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