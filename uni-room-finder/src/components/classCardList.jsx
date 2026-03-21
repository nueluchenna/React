import React from 'react';
import ClassCard from './base-components/classCard'; 

// 1. We now accept 'rooms' as a prop from HomePage!
const ClassCardList = ({ rooms }) => {
  
  // 2. We removed the useState and useEffect. 
  // No more fetching happens here; it's handled higher up in the app.

  // 3. Fallback UI if there are no rooms to show
  if (!rooms || rooms.length === 0) {
    return (
      <div className="flex justify-center items-center h-40">
        <p className="text-zinc-500 font-rubik">No rooms found for this building.</p>
      </div>
    );
  }

  // 4. We keep your exact same visual structure and map over the passed-in rooms
  return (
    <div className="flex flex-col gap-5 p-4 pb-20"> 
      {rooms.map((room) => (
        <ClassCard 
          key={room.id} 
          roomNumber={room.roomNumber}
          capacity={room.capacity}
          status={room.status}
          timeInfo={room.timeInfo}
          image={room.image} 
        />
      ))}
    </div>
  );
};

export default ClassCardList;