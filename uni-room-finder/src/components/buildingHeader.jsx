import React from 'react';

// Icons
const ArrowLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-zinc-900">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
  </svg>
);

const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-zinc-600">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);

const BuildingHeader = ({ title, onBack }) => {
  return (
    <div className="sticky top-0 z-50 w-full h-16 bg-gray-100 px-2 flex items-center justify-between shadow-sm">
      
      {/* Back Button */}
      <button onClick={onBack} className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors">
        <ArrowLeftIcon />
      </button>

      {/* Title (E Building, etc.) */}
      <h1 className="flex-1 text-left px-2 text-zinc-900 text-xl font-medium font-rubik leading-7">
        {title}
      </h1>

      {/* Right Icon */}
      <button className="w-12 h-12 opacity-40 flex items-center justify-center">
        <CalendarIcon />
      </button>

    </div>
  );
};

export default BuildingHeader;