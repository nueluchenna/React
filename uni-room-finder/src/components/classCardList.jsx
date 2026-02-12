import React from 'react';
import ClassCard from './base-components/classCard'; // Make sure this matches your file path

const ClassCardList = () => {
  // This is your "Database" for now. 
  // Later, you can fetch this from a real backend.
  const classes = [
    {
      id: 1,
      roomNumber: 'E001',
      capacity: 100,
      status: 'free',
      timeInfo: '2h:15m',
      image: '../../public/img/e201-class.png' // Make sure to add this image to your assets folder
    },
    {
      id: 2,
      roomNumber: 'E101',
      capacity: 40,
      status: 'free',
      timeInfo: '45m',
      image: '../../public/img/e201-class.png'
    },
    {
      id: 3,
      roomNumber: 'E006',
      capacity: 60,
      status: 'occupied',
      timeInfo: '14:00',
      image: null // Triggers the shapes/placeholder icon
    },
    {
      id: 4,
      roomNumber: 'E204',
      capacity: 25,
      status: 'occupied',
      timeInfo: '15:30',
      image: null
    }
  ];

  return (
    <div className="flex flex-col gap-5 p-4 pb-20"> 
      {/* The map() function loops through your data */}
      {classes.map((room) => (
        <ClassCard 
          key={room.id} // React needs a unique key for lists
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