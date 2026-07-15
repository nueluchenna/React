import React, { useState, useMemo } from "react";
import BlockCardList from "../components/blockCardList";
import ClassCardList from "../components/classCardList";
import BuildingHeader from "../components/buildingHeader";
import Header from "../components/header.jsx";

const ALLOWED_BUILDINGS = ["A", "B", "C", "D", "E", "I", "J", "K", "L"];

// Your original STRICT bouncer rule for all normal buildings
const STRICT_ROOM_REGEX = /^[ABCDEIJKL]\d{3,}$/;

const HomePage = ({ rooms = [] }) => {
  const [selectedBuilding, setSelectedBuilding] = useState(null);

  const isValidRoom = (room) => {
    if (!room || !room.roomNumber) return false;

    const value = room.roomNumber.trim().toUpperCase();

    // --- 1. VIP EXCEPTION FOR 'K' BUILDING ---
    if (value.startsWith("K")) {
      // Lenient check: Only accept these two exact rooms, even if they have "- EDV" attached
      if (value.includes("K106/107") || value.includes("K210")) {
        return true;
      }
      return false; // Reject every other K room (like K105, Vorplatz, etc.)
    }

    // --- 2. STRICT RULE FOR EVERY OTHER BUILDING ---
    // Returns true ONLY if it perfectly matches the strict format (e.g., "A112")
    return STRICT_ROOM_REGEX.test(value);
  };

  // Generate building cards and count free rooms
  const availableBuildings = useMemo(() => {
    const validRooms = rooms.filter((room) => isValidRoom(room));

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
      if (!isValidRoom(room)) {
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