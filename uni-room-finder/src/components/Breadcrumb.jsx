import React from 'react';

const Breadcrumb = () => {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 mt-6">
      <p className="font-['Roboto'] text-xs font-medium text-gray-500 uppercase tracking-wide">
        <span className="hover:text-green-600 cursor-pointer">STARTSEITE</span> 
        <span className="mx-2">&gt;</span> 
        <span className="hover:text-green-600 cursor-pointer">NETZWERK</span> 
        <span className="mx-2">&gt;</span> 
        <span className="text-gray-900 font-bold">COMMUNITY-FORUM</span>
      </p>
    </div>
  );
};

export default Breadcrumb;