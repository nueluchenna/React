// src/components/Person.jsx
import React from 'react';

const Person = ({ 
  name = "Guest User", 
  location = "Unknown Location", 
  role = "New Member", 

  lastUpdated = "Just now" 
}) => {
    return (
      <div className="self-stretch h-14 inline-flex justify-start items-center gap-3.5">
            
            <img 
              src="https://i.pravatar.cc/150?img=5" 
              alt={name} 
              className="w-14 h-14 rounded-full object-cover" 
            />

            <div className="flex-1 inline-flex flex-col justify-start items-start gap-[5px]">
              <div className="self-stretch inline-flex justify-between items-center">
                <div className="justify-start text-black text-base font-medium font-['Roboto']">
                  {name}
                </div>
                <div className="justify-start text-black text-sm font-normal font-['Roboto']">
                  {lastUpdated}
                </div>
              </div>
              <div className="self-stretch justify-start text-black text-sm font-normal font-['Roboto']">
                {role} • {location}
              </div>
            </div>
      </div>
    );
};

export default Person;