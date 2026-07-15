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
    // 'sticky top-0 z-50' keeps the header pinned while you scroll through room cards
    <header className="sticky top-0 z-50 w-full h-16 bg-fuchsia-50/80 backdrop-blur-md px-4 flex items-center justify-between border-b border-fuchsia-100">
      
      {/* Buttons now have 'active:scale-95' for a satisfying click feel */}
      <button 
        onClick={() => alert("Menu coming soon!")}
        className="p-2 rounded-full hover:bg-fuchsia-100/50 active:scale-95 transition-all"
      >
        <MenuIcon />
      </button>

      <h1 className="text-zinc-900 text-lg font-bold font-Rubik tracking-tight">
        {title}
      </h1>

      <button 
        onClick={() => alert("Profile coming soon!")}
        className="p-2 rounded-full hover:bg-fuchsia-100/50 active:scale-95 transition-all"
      >
        <UserIcon />
      </button>
      
    </header>
  );
};

export default Header;