import React from 'react';

const BlockCard = ({ name, roomsFree, image, onClick }) => {
  const isAvailable = roomsFree > 0;

  // Uses your default 'a-building.png' from the public/img folder if no image is passed
  const defaultImage = "/img/a-building.png"; 
  const displayImage = typeof image === 'string' && image.length > 0 ? image : defaultImage;

  return (
    <button 
      onClick={onClick}
      className="group relative w-full h-56 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 active:scale-[0.98] text-left bg-slate-200 border border-slate-300/50"
    >
      {/* BACKGROUND LAYER */}
      <img 
        src={displayImage} 
        alt={name} 
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 z-0"
      />

      {/* GRADIENT OVERLAY */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/30 to-transparent z-10"></div>

      {/* CONTENT LAYER AT THE BOTTOM */}
      <div className="absolute bottom-0 left-0 w-full p-5 z-20 flex flex-col gap-2">
        <h3 className="text-white text-3xl font-bold tracking-tight font-Rubik">
          {name}
        </h3>

        {isAvailable ? (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 backdrop-blur-md w-max">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
            <span className="text-emerald-300 text-xs font-bold uppercase tracking-wide font-Rubik">
              {roomsFree} {roomsFree === 1 ? 'Room' : 'Rooms'} Free
            </span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-500/30 border border-slate-400/20 backdrop-blur-md w-max">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span className="text-slate-200 text-xs font-bold uppercase tracking-wide font-Rubik">
              Fully Booked
            </span>
          </div>
        )}
      </div>
    </button>
  );
};

export default BlockCard;