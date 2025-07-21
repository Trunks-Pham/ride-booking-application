const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
// Sử dụng cors cho mọi yêu cầu HTTP mà không giới hạn origin
app.use(cors({
    origin: "*", // Cho phép tất cả origin
    methods: ["GET", "POST"],
    credentials: true // Cho phép gửi cookie/credentials nếu cần
}));
app.use(express.json());

const server = http.createServer(app);
// Cấu hình Socket.IO để chấp nhận mọi kết nối WebSocket
const io = new Server(server, {
    cors: {
        origin: "*", // Cho phép tất cả origin
        methods: ["GET", "POST"], // Cho phép các phương thức
        credentials: true // Cho phép credentials nếu cần
    }
});

// Function to generate a name based on Vietnamese alphabet letters
function generateNameFromLetter(letter) {
    const suffixes = ["Anh", "Chị", "Ông", "Bà"];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    return `${letter.toUpperCase()} ${suffix}`;
}

// Function to generate random coordinates around HCMC (lat: 10.7769, lng: 106.7009)
function generateRandomLocation() {
    const baseLat = 10.7769;
    const baseLng = 106.7009;
    const latOffset = (Math.random() - 0.5) * 0.1; // ±0.05 degrees (~5-6 km)
    const lngOffset = (Math.random() - 0.5) * 0.1; // ±0.05 degrees (~5-6 km)
    return {
        lat: baseLat + latOffset,
        lng: baseLng + lngOffset,
    };
}

// Vietnamese alphabet (24 letters)
const vietnameseAlphabet = ['a', 'ă', 'â', 'b', 'c', 'd', 'đ', 'e', 'ê', 'g', 'h', 'i', 'k', 'l', 'm', 'n', 'o', 'ô', 'ơ', 'p', 'q', 'r', 's', 't'];

// Generate exactly 24 drivers with alphabet letters
let drivers = vietnameseAlphabet.map((letter, index) => ({
    id: `driver${index + 1}`,
    name: generateNameFromLetter(letter),
    location: generateRandomLocation(),
}));

let currentRide = null;

// Tính khoảng cách giữa hai điểm (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // bán kính trái đất (m)
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // khoảng cách (m)
}

// API: Lấy danh sách tài xế online
app.get("/api/drivers", (req, res) => {
    res.json({ drivers });
});

// API: Đặt xe
app.post("/api/book", (req, res) => {
    const { currentLocation, destination } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (
        !currentLocation ||
        !destination ||
        typeof currentLocation.lat !== "number" ||
        typeof currentLocation.lng !== "number" ||
        typeof destination.lat !== "number" ||
        typeof destination.lng !== "number"
    ) {
        return res.status(400).json({ message: "Dữ liệu không hợp lệ" });
    }

    // Kiểm tra nếu đang có chuyến đi
    if (currentRide) {
        return res
            .status(400)
            .json({ message: "Hệ thống đang bận, vui lòng thử lại sau" });
    }

    // Tìm tài xế gần nhất
    let closestDriver = null;
    let minDistance = Infinity;

    drivers.forEach((driver) => {
        const distance = calculateDistance(
            currentLocation.lat,
            currentLocation.lng,
            driver.location.lat,
            driver.location.lng
        );
        if (distance < minDistance) {
            minDistance = distance;
            closestDriver = driver;
        }
    });

    if (closestDriver) {
        currentRide = { driver: closestDriver, destination };
        console.log(
            `📲 Đặt xe với ${closestDriver.name} tới (${destination.lat}, ${destination.lng})`
        );
        res.json({ message: "Đặt xe thành công", driver: closestDriver });

        // Giả lập di chuyển
        simulateDriverMovement(closestDriver, currentLocation, destination);
    } else {
        res.status(404).json({ message: "Không tìm thấy tài xế" });
    }
});

function simulateDriverMovement(driver, userLocation, destination) {
    let target = userLocation;
    let phase = "toUser";
    const speedFactor = 0.05 + Math.random() * 0.5;

    const moveInterval = setInterval(() => {
        driver.location.lat += (target.lat - driver.location.lat) * speedFactor;
        driver.location.lng += (target.lng - driver.location.lng) * speedFactor;

        console.log("Sending locationUpdate to clients:", io.engine.clientsCount); // Log trước khi gửi
        io.emit("locationUpdate", {
            driverId: driver.id,
            location: driver.location,
        });
        console.log(
            `📍 Tài xế ${driver.name} đang di chuyển tới:`,
            driver.location
        );

        const distance = calculateDistance(
            driver.location.lat,
            driver.location.lng,
            target.lat,
            target.lng
        );

        if (distance < 10) {
            if (phase === "toUser") {
                console.log(`✅ Tài xế ${driver.name} đã đến vị trí người dùng`);
                console.log("Sending rideStatus to clients:", io.engine.clientsCount); // Log trước khi gửi
                io.emit("rideStatus", {
                    message: `Tài xế ${driver.name} đã đến vị trí người dùng`,
                });
                phase = "toDestination";
                target = destination;
            } else {
                clearInterval(moveInterval);
                console.log(`🏁 Tài xế ${driver.name} đã đến đích`);
                console.log("Sending rideStatus to clients:", io.engine.clientsCount); // Log trước khi gửi
                io.emit("rideStatus", { message: `Tài xế ${driver.name} đã đến đích` });
                currentRide = null;
            }
        }
    }, 1000);
}

io.on("connection", (socket) => {
    console.log(`🔗 User connected: ${socket.id}`);
    console.log("Current connected clients:", io.engine.clientsCount); // Log số client
    socket.on("disconnect", () => {
        console.log(`❌ User disconnected: ${socket.id}`);
        console.log("Current connected clients:", io.engine.clientsCount);
    });
});

// Khởi chạy server
const PORT = 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});