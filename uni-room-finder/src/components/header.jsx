import React from 'react';

const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600">
    <line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>
  </svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/>
  </svg>
);

const Header = ({ title = "Find a room", searchTerm, onSearchChange }) => {
  return (
    <header className="sticky top-0 z-50 w-full bg-white/75 backdrop-blur-xl border-b border-slate-200/60 pt-4 pb-3 px-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => alert("Menu coming soon!")}
          className="p-2 -ml-2 rounded-full text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
        >
          <MenuIcon />
        </button>

        <h1 className="text-slate-900 text-lg font-bold font-Rubik tracking-tight">
          {title}
        </h1>

        <button 
          onClick={() => alert("Profile coming soon!")}
          className="p-2 -mr-2 rounded-full text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
        >
          <UserIcon />
        </button>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        </div>
      </div>
    </header>
  );
};

export default Header;