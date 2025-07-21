const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors({
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
}));
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    }
});

// 🎯 Hàm tạo tên tài xế tiếng Việt có ý nghĩa
function generateVietnameseName() {
    const lastNames = [
        "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng",
        "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý", "Tô", "Tạ", "Quách", "Trịnh"
    ];
    const middleNames = ["Văn", "Thị", "Hữu", "Minh", "Ngọc", "Gia", "Anh", "Phúc", "Thanh", "Tuấn"];
    const firstNames = [
        "An", "Bình", "Chi", "Dũng", "Đạt", "Hà", "Hùng", "Hương", "Khoa", "Khánh",
        "Lan", "Linh", "Long", "Mai", "Nam", "Nhung", "Phát", "Phúc", "Quân", "Quỳnh",
        "Sơn", "Thảo", "Thắng", "Trang", "Trí", "Tú", "Tuấn", "Vy", "Yến", "Vinh"
    ];

    const last = lastNames[Math.floor(Math.random() * lastNames.length)];
    const middle = middleNames[Math.floor(Math.random() * middleNames.length)];
    const first = firstNames[Math.floor(Math.random() * firstNames.length)];

    return `${last} ${middle} ${first}`;
}

// 📍 Hàm tạo vị trí ngẫu nhiên quanh TP.HCM
function generateRandomLocation() {
    const baseLat = 10.7769;
    const baseLng = 106.7009;
    const latOffset = (Math.random() - 0.5) * 0.1;
    const lngOffset = (Math.random() - 0.5) * 0.1;
    return {
        lat: baseLat + latOffset,
        lng: baseLng + lngOffset,
    };
}

// Bảng chữ cái tiếng Việt (24 chữ) → số lượng tài xế
const vietnameseAlphabet = ['a', 'ă', 'â', 'b', 'c', 'd', 'đ', 'e', 'ê', 'g', 'h', 'i', 'k', 'l', 'm', 'n', 'o', 'ô', 'ơ', 'p', 'q', 'r', 's', 't'];

// 🧑‍✈️ Tạo danh sách tài xế
let drivers = vietnameseAlphabet.map((_, index) => ({
    id: `driver${index + 1}`,
    name: generateVietnameseName(),
    location: generateRandomLocation(),
}));

let currentRide = null;

// 📏 Tính khoảng cách Haversine
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

// 📡 API lấy danh sách tài xế
app.get("/api/drivers", (req, res) => {
    res.json({ drivers });
});

// 🚕 API đặt xe
app.post("/api/book", (req, res) => {
    const { currentLocation, destination } = req.body;

    if (
        !currentLocation || !destination ||
        typeof currentLocation.lat !== "number" || typeof currentLocation.lng !== "number" ||
        typeof destination.lat !== "number" || typeof destination.lng !== "number"
    ) {
        return res.status(400).json({ message: "Dữ liệu không hợp lệ" });
    }

    if (currentRide) {
        return res.status(400).json({ message: "Hệ thống đang bận, vui lòng thử lại sau" });
    }

    let closestDriver = null;
    let minDistance = Infinity;

    drivers.forEach((driver) => {
        const distance = calculateDistance(
            currentLocation.lat, currentLocation.lng,
            driver.location.lat, driver.location.lng
        );
        if (distance < minDistance) {
            minDistance = distance;
            closestDriver = driver;
        }
    });

    if (closestDriver) {
        currentRide = { driver: closestDriver, destination };
        console.log(`📲 Đặt xe với ${closestDriver.name} tới (${destination.lat}, ${destination.lng})`);
        res.json({ message: "Đặt xe thành công", driver: closestDriver });

        simulateDriverMovement(closestDriver, currentLocation, destination);
    } else {
        res.status(404).json({ message: "Không tìm thấy tài xế" });
    }
});

// 🛣️ Giả lập di chuyển tài xế
function simulateDriverMovement(driver, userLocation, destination) {
    let target = userLocation;
    let phase = "toUser";
    const speedFactor = 0.05 + Math.random() * 0.5;

    const moveInterval = setInterval(() => {
        driver.location.lat += (target.lat - driver.location.lat) * speedFactor;
        driver.location.lng += (target.lng - driver.location.lng) * speedFactor;

        io.emit("locationUpdate", {
            driverId: driver.id,
            location: driver.location,
        });

        const distance = calculateDistance(
            driver.location.lat, driver.location.lng,
            target.lat, target.lng
        );

        if (distance < 10) {
            if (phase === "toUser") {
                io.emit("rideStatus", {
                    message: `Tài xế ${driver.name} đã đến vị trí người dùng`,
                });
                phase = "toDestination";
                target = destination;
            } else {
                clearInterval(moveInterval);
                io.emit("rideStatus", {
                    message: `Tài xế ${driver.name} đã đến đích`,
                });
                currentRide = null;
            }
        }
    }, 1000);
}

// ⚡ Socket.IO connection
io.on("connection", (socket) => {
    console.log(`🔗 User connected: ${socket.id}`);
    socket.on("disconnect", () => {
        console.log(`❌ User disconnected: ${socket.id}`);
    });
});

// 🚀 Khởi chạy server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
