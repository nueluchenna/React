import React, { useState, useMemo } from "react";
import BlockCardList from "../components/blockCardList";
import ClassCardList from "../components/classCardList";
import BuildingHeader from "../components/buildingHeader";
import Header from "../components/header.jsx";

const ALLOWED_BUILDINGS = ["A", "B", "C", "D", "E", "I", "J", "K", "L"];

// Building letter followed by at least 3 digits
const ROOM_FORMAT_REGEX = /^[ABCDEIJKL]\d{3,}$/;

const HomePage = ({ rooms = [] }) => {
  const [selectedBuilding, setSelectedBuilding] = useState(null);

  const isValidRoom = (roomNumber) => {
    if (!roomNumber) return false;

    const value = roomNumber.trim().toUpperCase();

    return ROOM_FORMAT_REGEX.test(value);
  };

  // Generate building cards and count free rooms
  const availableBuildings = useMemo(() => {
    const validRooms = rooms.filter((room) =>
      isValidRoom(room.roomNumber)
    );

    const uniqueBuildings = [
      ...new Set(
        validRooms.map((room) =>
          room.roomNumber.trim().charAt(0).toUpperCase()
        )
      ),
    ].sort();

    return uniqueBuildings.map((buildingLetter) => {
      const roomsInBuilding = validRooms.filter(
        (room) =>
          room.roomNumber
            .trim()
            .charAt(0)
            .toUpperCase() === buildingLetter
      );

      const freeCount = roomsInBuilding.filter(
        (room) => room.status === "free"
      ).length;

      return {
        name: buildingLetter,
        roomsFree: freeCount,
      };
    });
  }, [rooms]);

  // Filter rooms for the selected building
  const roomsForSelectedBuilding = useMemo(() => {
    if (!selectedBuilding) return [];

    return rooms.filter((room) => {
      if (!isValidRoom(room.roomNumber)) {
        return false;
      }

      return (
        room.roomNumber
          .trim()
          .charAt(0)
          .toUpperCase() ===
        selectedBuilding.name.toUpperCase()
      );
    });
  }, [rooms, selectedBuilding]);

  return (
    <div className="bg-white min-h-screen relative">
      {!selectedBuilding ? (
        <>
          <Header title="Find a room" />
          <BlockCardList
            buildings={availableBuildings}
            onBuildingSelect={setSelectedBuilding}
          />
        </>
      ) : (
        <>
          <BuildingHeader
            title={`${selectedBuilding.name} Building`}
            onBack={() => setSelectedBuilding(null)}
          />
          <ClassCardList rooms={roomsForSelectedBuilding} />
        </>
      )}
    </div>
  );
};

export default HomePage;