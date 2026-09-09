import React from 'react';

const UsersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ClassCard = ({ roomNumber, capacity, status, timeInfo, image }) => {
  const isFree = status === 'free';

  return (
    <button className={`w-full flex items-center p-3 rounded-2xl border shadow-sm transition-all text-left ${
      isFree 
        ? "bg-white border-slate-200 hover:shadow-md hover:border-emerald-200 active:scale-[0.98] group" 
        : "bg-white/60 border-slate-200 opacity-75"
    }`}>
      
      {/* Left: Image OR SVG Icon Fallback */}
      <div className={`w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center border overflow-hidden ${
        isFree 
          ? "bg-emerald-50 text-emerald-500 border-emerald-100 group-hover:bg-emerald-100 transition-colors" 
          : "bg-slate-100 text-slate-400 border-slate-200"
      }`}>
        {image ? (
          <img 
            src={image} 
            alt={roomNumber} 
            className="w-full h-full object-cover"
          />
        ) : isFree ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        )}
      </div>

      {/* Right: Content */}
      <div className="flex-1 ml-4 flex flex-col justify-center gap-1">
        
        {/* Header: Room Name + Capacity */}
        <div className="flex justify-between items-start">
          <h3 className={`text-lg font-bold font-sans leading-none ${isFree ? "text-slate-900" : "text-slate-500"}`}>
            {roomNumber}
          </h3>
          <div className="flex items-center gap-1 text-slate-400">
            <UsersIcon />
            <span className="text-xs font-semibold">{capacity}</span>
          </div>
        </div>

        {/* Footer: Status Dot & Time */}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`w-2 h-2 rounded-full ${
            isFree ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-rose-500"
          }`}></span>
          <p className={`font-medium text-xs ${isFree ? "text-slate-600" : "text-slate-500"}`}>
            {timeInfo}
          </p>
        </div>
        
      </div>
    </button>
  );
};

export default ClassCard;