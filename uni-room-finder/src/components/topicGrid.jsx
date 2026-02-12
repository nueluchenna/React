import React from 'react';

const TopicGrid = () => {
  // We list the topics here so you can easily add or change them later
  const topics = [
    "TIERHALTUNG",
    "NACHHALTIGE LANDWIRTSCHAFT",
    "REGIONALE\nPROJEKTE",
    "AGROTOURISMUS",
    "NEUE\nTECHNOLOGIEN"
  ];

  return (
    <div className="flex flex-col items-start gap-5 w-full max-w-[1240px] mx-auto px-4 my-12">
      
      {/* Section Title */}
      <h3 className="font-['Roboto'] font-semibold text-gray-900 text-lg">
        Alle beliebten Themen anzeigen
      </h3>

      {/* Grid of Topic Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5 w-full">
        {topics.map((topic, index) => (
          <button
            key={index}
            className="flex h-[190px] items-center justify-center bg-gradient-to-br from-green-100 to-green-200 hover:from-green-200 hover:to-green-300 rounded-lg shadow-md cursor-pointer transition-all border-none hover:shadow-lg hover:-translate-y-1 group"
          >
            <span className="font-['Roboto'] font-semibold text-green-800 text-lg text-center leading-tight whitespace-pre-line px-4 group-hover:scale-105 transition-transform">
              {topic}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TopicGrid;