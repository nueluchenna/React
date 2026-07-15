import React from 'react';

// Simple Icon for Capacity
const UsersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ClassCard = ({ roomNumber, capacity, status, timeInfo, image }) => {
  const isFree = status === 'free';

  return (
    <div className="flex w-full h-[88px] bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
      
      {/* Left: Image OR Smart Fallback */}
      <div className="w-[88px] h-full flex-shrink-0 relative border-r border-gray-100">
        {image ? (
          // If you have a photo, it fills the left box completely
          <img 
            src={image} 
            alt={roomNumber} 
            className="w-full h-full object-cover"
          />
        ) : (
          // If you don't have a photo yet, it safely falls back to the clean status emoji
          <div 
            className={`w-full h-full flex items-center justify-center text-3xl transition-colors ${
              isFree 
                ? 'bg-green-50 text-green-600' 
                : 'bg-red-50 text-red-500'
            }`}
          >
            {isFree ? '✓' : '🔒'}
          </div>
        )}
      </div>

      {/* Right: Content */}
      <div className="flex-1 px-4 py-2 flex flex-col justify-center gap-1">
        
        {/* Header: Room Name + Capacity */}
        <div className="flex justify-between items-start">
          <h3 className="text-gray-900 text-lg font-bold font-Rubik leading-tight">
            {roomNumber}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            <UsersIcon />
            <span className="text-gray-500 text-xs font-medium font-Rubik">
              Capacity : {capacity}
            </span>
          </div>
        </div>

        {/* Footer: Status */}
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isFree ? 'bg-green-500' : 'bg-red-500'}`} />
          
          {/* Render timeInfo directly without the hardcoded prefix */}
          <p className="text-gray-900 font-medium text-sm font-Rubik">
            {timeInfo}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ClassCard;