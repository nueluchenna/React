import React from 'react';

const BottomNav = () => {
  // Function to scroll the page to the top smoothly
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <div className="flex w-full h-[85px] items-center justify-between px-6 md:px-[85px] py-[30px] bg-gray-100 rounded-lg max-w-[1240px] mx-auto my-10">
      
      {/* 1. Back Button */}
      <button 
        onClick={() => window.history.back()} 
        className="flex items-center gap-2 hover:text-green-600 transition-colors group cursor-pointer"
      >
        <svg className="w-6 h-6 transform transition-transform group-hover:-translate-x-1" viewBox="0 0 25 25" fill="none">
          <path d="M15.5 18.5L9.5 12.5L15.5 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="font-semibold text-gray-800 group-hover:text-green-600 text-sm font-['Roboto']">
          Zurück zur Übersicht NETZWERK
        </span>
      </button>

      {/* 2. Scroll to Top Button */}
      <button 
        onClick={scrollToTop} 
        className="flex items-center gap-2 hover:text-green-600 transition-colors group cursor-pointer"
      >
        <span className="font-semibold text-gray-800 group-hover:text-green-600 text-sm font-['Roboto']">
          Nach oben
        </span>
        <svg className="w-6 h-6 transform transition-transform group-hover:-translate-y-1" viewBox="0 0 25 25" fill="none">
          <path d="M18.5 15.5L12.5 9.5L6.5 15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

    </div>
  );
};

export default BottomNav;