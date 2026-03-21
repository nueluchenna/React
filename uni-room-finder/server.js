import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors());

app.get('/', (req, res) => {
  res.send('Backend is running! Go to /api/rooms to see the live data.');
});

app.get('/api/rooms', async (req, res) => {
  try {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    
    const currentTimeString = `${yyyy}-${mm}-${dd}%20${hh}:${min}`;
    const allRoomsUrl = 'https://thabella.th-deg.de/thabella/opn/room/findRooms';
    const dailyEventsUrl = `https://thabella.th-deg.de/thabella/opn/period/findByDate/${currentTimeString}`;

    const [allRoomsResponse, eventsResponse] = await Promise.all([
      axios.get(allRoomsUrl),
      axios.get(dailyEventsUrl)
    ]);

    const allRooms = allRoomsResponse.data;
    const dailyEvents = eventsResponse.data; 
    const currentTimeMs = now.getTime();

    const mergedRooms = allRooms.map(room => {
      // Use room.ident here to link the APIs properly
      const roomEvents = dailyEvents.filter(event => 
        event.room_ident && event.room_ident[room.ident]
      );

      roomEvents.sort((a, b) => {
        return new Date(a.startDateTime.replace(' ', 'T')).getTime() - new Date(b.startDateTime.replace(' ', 'T')).getTime();
      });

      let isOccupied = false;
      let timeInfo = "Free for the rest of the day";

      for (let event of roomEvents) {
        const startTimeMs = new Date(event.startDateTime.replace(' ', 'T')).getTime();
        const durationMs = event.duration * 60 * 1000; 
        const endTimeMs = startTimeMs + durationMs;

        if (currentTimeMs >= startTimeMs && currentTimeMs < endTimeMs) {
          isOccupied = true;
          const endDate = new Date(endTimeMs);
          const endHH = String(endDate.getHours()).padStart(2, '0');
          const endMM = String(endDate.getMinutes()).padStart(2, '0');
          timeInfo = `Occupied until ${endHH}:${endMM}`;
          break; 
        }
      }

      if (!isOccupied) {
        const nextEvent = roomEvents.find(event => {
          return new Date(event.startDateTime.replace(' ', 'T')).getTime() > currentTimeMs;
        });
        if (nextEvent) {
          const nextStartTime = nextEvent.startDateTime.split(' ')[1];
          timeInfo = `Free until ${nextStartTime}`;
        }
      }

      // Format the exact object React will receive
      return {
        id: room.id,
        roomNumber: room.name, // e.g., "K101" - We will use this for the building letter!
        capacity: room.seatsRegular,
        status: isOccupied ? 'occupied' : 'free',
        timeInfo: timeInfo,
        image: null
      };
    });

    res.json(mergedRooms);

  } catch (error) {
    console.error("Error fetching Thabella API:", error.message);
    res.status(500).json({ error: 'Failed to fetch data from Thabella' });
  }
});

// This tells the server to use the host's port, or fallback to 3000 if you are testing on your laptop
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});