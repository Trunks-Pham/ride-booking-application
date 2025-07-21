![App UI](/frontend/public/image.png)
# Ride Booking Application

## Overview
This project is a real-time ride booking application built with **React** and **Node.js**. It allows users to select pickup and destination locations on an interactive map, book a ride, and track the assigned driver in real-time. The application uses **Leaflet** for map rendering, **Socket.IO** for real-time communication, and **Express** for the backend API.

## Features
- **Interactive Map**: Users can click on the map to set pickup and destination points, visualized with custom markers.
- **Real-Time Driver Tracking**: Displays the locations of available drivers, updated every 5 seconds, with random icons for each driver.
- **Route Planning**: Calculates and displays the route between pickup and destination points using **Leaflet Routing Machine**.
- **Driver Assignment**: Automatically assigns the nearest driver to the user's request based on their current location.
- **Real-Time Updates**: Uses WebSocket (Socket.IO) to update driver locations and ride status in real-time.
- **Responsive UI**: Includes a booking panel showing ride status, driver details, and a list of active drivers sorted alphabetically.

## Tech Stack
### Frontend
- **React**: For building the user interface.
- **Leaflet**: For rendering interactive maps.
- **Leaflet Routing Machine**: For route calculation and visualization.
- **Socket.IO Client**: For real-time communication with the backend.
- **Axios**: For making HTTP requests to the backend API.
- **Tailwind CSS**: For styling (assumed to be included in `App.css`).

### Backend
- **Node.js**: Server-side runtime environment.
- **Express**: Web framework for building the API.
- **Socket.IO**: For real-time, bidirectional communication.
- **CORS**: To handle cross-origin requests.

## Setup Instructions

### Prerequisites
- **Node.js** (v14 or higher)
- **npm** or **yarn**
- A modern web browser

### Installation
1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd ride-booking-app
   ```

2. **Backend Setup**:
   - Navigate to the backend directory (if separate, or root if combined):
     ```bash
     cd backend
     ```
   - Install dependencies:
     ```bash
     npm install
     ```
   - Start the server:
     ```bash
     npm start
     ```
     The server will run on `http://localhost:5000`.

3. **Frontend Setup**:
   - Navigate to the frontend directory (if separate, or root if combined):
     ```bash
     cd frontend
     ```
   - Install dependencies:
     ```bash
     npm install
     ```
   - Start the development server:
     ```bash
     npm start
     ```
     The frontend will run on `http://localhost:3000` (or another port if specified).

4. **Environment Configuration**:
   - Ensure the `API_BASE_URL` in the frontend (`http://192.168.1.20:5000`) matches the backend server address.
   - Update the backend `PORT` if needed (default is 5000).

### Running the Application
- Start the backend server first (`npm start` in the backend directory).
- Then start the frontend (`npm start` in the frontend directory).
- Open `http://localhost:3000` in your browser to access the application.

## Usage
1. **Select Pickup and Destination**:
   - Click on the map to set the pickup point (first click).
   - Click again to set the destination point (second click).
   - Drag markers to adjust locations if needed.
2. **View Route**:
   - Once both points are set, the route between them is displayed with estimated distance and time.
3. **Book a Ride**:
   - Click the "Đặt Xe" (Book Ride) button to assign the nearest driver.
   - The driver’s details and real-time location will be displayed.
4. **Track Driver**:
   - The driver’s marker updates in real-time as they move toward the pickup point and then the destination.
5. **Reset Booking**:
   - Click "Đặt lại" (Reset) to clear the current booking and start over.
6. **Refresh Drivers**:
   - Click "Làm mới Tài xế" (Refresh Drivers) to update the list of available drivers.

## API Endpoints
- **GET `/api/drivers`**: Returns a list of available drivers with their names and locations.
- **POST `/api/book`**: Books a ride by sending pickup and destination coordinates. Returns the assigned driver’s details.

## Socket.IO Events
- **locationUpdate**: Emits driver location updates (`{ driverId, location }`).
- **rideStatus**: Emits ride status updates (`{ message }`).

## Notes
- The backend generates 24 drivers with names based on the Vietnamese alphabet (a, ă, â, ..., t).
- Driver locations are initialized randomly around Ho Chi Minh City (10.7769, 106.7009) with a ±0.05-degree offset.
- The application assumes a single active ride at a time for simplicity.
- Simulated driver movement uses a basic linear interpolation with random speed for demonstration purposes.

## Future Improvements
- Add authentication for users and drivers.
- Implement a database to store driver and ride data.
- Enhance the routing algorithm to account for traffic conditions.
- Add support for multiple concurrent rides.
- Improve the UI with more detailed driver profiles and ride history.

## License
All projects in this ecosystem are open-source and released under the [MIT License](https://opensource.org/licenses/MIT).