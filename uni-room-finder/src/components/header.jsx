import React from 'react';

// Simple Menu Icon (Hamburger)
const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-zinc-700">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
);

// Simple User/Profile Icon
const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-zinc-700">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);

const Header = ({ title = "Find a room" }) => {
  return (
    // 'sticky top-0' keeps it visible when scrolling
    // 'z-50' ensures it stays ON TOP of the cards
    <div className="sticky top-0 z-50 w-full h-16 bg-fuchsia-50 px-4 flex items-center justify-between shadow-sm">
      
      {/* Left Icon Button */}
      <button className="p-2 rounded-full hover:bg-black/5 transition-colors">
        <MenuIcon />
      </button>

      {/* Center Title */}
      <h1 className="text-zinc-900 text-xl font-medium font-Rubik tracking-tight">
        {title}
      </h1>

      {/* Right Icon Button */}
      <button className="p-2 rounded-full hover:bg-black/5 transition-colors">
        <UserIcon />
      </button>
      
    </div>
  );
};

export default Header;