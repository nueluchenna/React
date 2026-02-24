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
    // 1. Get the exact current time to fetch today's schedule
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    
    // Format: YYYY-MM-DD%20HH:mm (The %20 is the URL code for a space)
    const currentTimeString = `${yyyy}-${mm}-${dd}%20${hh}:${min}`;

    // 2. Define both Thabella APIs
    const allRoomsUrl = 'https://thabella.th-deg.de/thabella/opn/room/findRooms';
    const dailyEventsUrl = `https://thabella.th-deg.de/thabella/opn/period/findByDate/${currentTimeString}`;

    // 3. Fetch BOTH lists at the exact same time
    const [allRoomsResponse, eventsResponse] = await Promise.all([
      axios.get(allRoomsUrl),
      axios.get(dailyEventsUrl)
    ]);

    const allRooms = allRoomsResponse.data;
    const dailyEvents = eventsResponse.data; 
    const currentTimeMs = now.getTime(); // Current time in milliseconds for math

    // 4. Merge the data and calculate "Free until" or "Occupied until"
    const mergedRooms = allRooms.map(room => {
      
      // Find all events today that are happening in this specific room
      const roomEvents = dailyEvents.filter(event => 
        event.room_ident && event.room_ident[room.ident]
      );

      // Sort them chronologically (earliest to latest)
      roomEvents.sort((a, b) => {
        return new Date(a.startDateTime.replace(' ', 'T')).getTime() - new Date(b.startDateTime.replace(' ', 'T')).getTime();
      });

      let isOccupied = false;
      let timeInfo = "Free for the rest of the day"; // Default assumption

      // Loop through the schedule to see what is happening right now
      for (let event of roomEvents) {
        // Convert Thabella's time format into standard JavaScript milliseconds
        const startTimeMs = new Date(event.startDateTime.replace(' ', 'T')).getTime();
        const durationMs = event.duration * 60 * 1000; 
        const endTimeMs = startTimeMs + durationMs;

        // Condition 1: An event is happening RIGHT NOW
        if (currentTimeMs >= startTimeMs && currentTimeMs < endTimeMs) {
          isOccupied = true;
          
          // Calculate when it ends and format it as HH:mm
          const endDate = new Date(endTimeMs);
          const endHH = String(endDate.getHours()).padStart(2, '0');
          const endMM = String(endDate.getMinutes()).padStart(2, '0');
          
          timeInfo = `Occupied until ${endHH}:${endMM}`;
          break; // Stop checking other events since we know the room is currently busy
        }
      }

      // Condition 2: The room is free right now, but might be booked later today
      if (!isOccupied) {
        // Find the first event whose start time is in the future
        const nextEvent = roomEvents.find(event => {
          return new Date(event.startDateTime.replace(' ', 'T')).getTime() > currentTimeMs;
        });
        
        if (nextEvent) {
          // Extract just the "HH:mm" part from the string (e.g., "2026-02-23 14:00")
          const nextStartTime = nextEvent.startDateTime.split(' ')[1];
          timeInfo = `Free until ${nextStartTime}`;
        }
      }

      return {
        id: room.id,
        roomNumber: room.name,
        capacity: room.seatsRegular,
        status: isOccupied ? 'occupied' : 'free',
        timeInfo: timeInfo,
        image: null
      };
    });

    // 5. Send the perfectly formatted list to React
    res.json(mergedRooms);

  } catch (error) {
    console.error("Error fetching Thabella API:", error.message);
    res.status(500).json({ error: 'Failed to fetch data from Thabella' });
  }
});

app.listen(3000, () => {
  console.log('Backend server running on http://localhost:3000');
});