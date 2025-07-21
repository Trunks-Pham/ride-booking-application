import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import axios from "axios";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

// URL constants
const API_BASE_URL = "https://ride-booking-application-x3wy.onrender.com:5000";

// Sửa biểu tượng mặc định của Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

// Array of car driver icon URLs
const driverIconUrls = [
  "https://cdn-icons-png.flaticon.com/512/14703/14703768.png",
  "https://cdn-icons-png.flaticon.com/512/1048/1048315.png",
  "https://cdn-icons-png.flaticon.com/512/1048/1048313.png",
  "https://cdn-icons-png.flaticon.com/512/10740/10740612.png",
];

// Function to get a random icon from the array
const getRandomDriverIcon = () => {
  const randomIndex = Math.floor(Math.random() * driverIconUrls.length);
  return L.icon({
    iconUrl: driverIconUrls[randomIndex],
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

// Biểu tượng cho điểm đón
const pickupIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// Biểu tượng cho điểm đến
const destinationIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/3082/3082383.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

function App() {
  const mapContainerRef = useRef(null);
  const mapInstance = useRef(null);
  const [drivers, setDrivers] = useState([]);
  const [driverMarkers, setDriverMarkers] = useState({});
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [tempClickedPosition, setTempClickedPosition] = useState(null);
  const [clickCount, setClickCount] = useState(0);
  const socket = useRef(null);
  const fetchTimerRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const routeControlRef = useRef(null);

  // Khởi tạo bản đồ và kết nối socket
  useEffect(() => {
    // Giả lập socket nếu không cần kết nối thực
    socket.current = { connected: false };

    // Bỏ comment phần dưới nếu muốn kết nối socket thực
    socket.current = io(API_BASE_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.current.on("connect", () => {
      console.log("Socket đã kết nối thành công");
      setStatus("Đã kết nối tới máy chủ");
    });

    socket.current.on("connect_error", (error) => {
      console.error("Lỗi kết nối socket:", error);
      setStatus("Lỗi kết nối - đang thử lại...");
    });

    socket.current.on("locationUpdate", (data) => {
      console.log("Đã nhận cập nhật vị trí:", data);
      updateDriverMarker(data.driverId, data.location);
    });

    socket.current.on("rideStatus", (data) => {
      console.log("Cập nhật trạng thái chuyến đi:", data);
      setStatus(data.message);
    });

    // Khởi tạo bản đồ Leaflet
    if (!mapInstance.current && mapContainerRef.current) {
      // Tạo bản đồ Leaflet
      mapInstance.current = L.map(mapContainerRef.current).setView(
        [10.7765, 106.6932],
        13
      );

      // Thêm OpenStreetMap tile layer
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(mapInstance.current);

      // Xử lý sự kiện click trên bản đồ - QUAN TRỌNG
      mapInstance.current.on("click", (e) => {
        const position = {
          lat: e.latlng.lat,
          lng: e.latlng.lng,
        };

        console.log("Đã click bản đồ:", position);

        // Lưu tọa độ vào state tạm thời và tăng số lần click
        setTempClickedPosition(position);
        setClickCount((prevCount) => prevCount + 1);
      });

      fetchDrivers();

      // Khởi động cập nhật định kỳ
      fetchTimerRef.current = setInterval(fetchDrivers, 5000);
    }

    return () => {
      if (socket.current && socket.current.disconnect) {
        socket.current.disconnect();
      }

      if (fetchTimerRef.current) {
        clearInterval(fetchTimerRef.current);
      }

      // Dọn dẹp bản đồ khi component unmount
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Theo dõi và xử lý khi có click vào bản đồ
  useEffect(() => {
    if (!tempClickedPosition) return;

    console.log("Xử lý click thứ", clickCount, "tại:", tempClickedPosition);

    // Click đầu tiên - đặt điểm đón
    if (clickCount === 1) {
      console.log("Đặt điểm đón");

      // Xóa marker cũ nếu có
      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.remove();
      }

      // Tạo marker mới
      if (mapInstance.current) {
        pickupMarkerRef.current = L.marker(
          [tempClickedPosition.lat, tempClickedPosition.lng],
          {
            icon: pickupIcon,
            draggable: true,
          }
        )
          .addTo(mapInstance.current)
          .bindPopup("Điểm đón")
          .openPopup();

        // Xử lý sự kiện kéo marker
        pickupMarkerRef.current.on("dragend", (event) => {
          const marker = event.target;
          const position = marker.getLatLng();
          const updatedPosition = {
            lat: position.lat,
            lng: position.lng,
          };
          console.log("Cập nhật điểm đón sau kéo:", updatedPosition);
          setCurrentLocation(updatedPosition);
        });
      }

      // Cập nhật state điểm đón
      setCurrentLocation(tempClickedPosition);
      setStatus("Đã đặt điểm đón. Bây giờ, chọn điểm đến trên bản đồ.");
    }
    // Click thứ hai - đặt điểm đến
    else if (clickCount === 2) {
      console.log("Đặt điểm đến");

      // Xóa marker cũ nếu có
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove();
      }

      // Tạo marker mới
      if (mapInstance.current) {
        destinationMarkerRef.current = L.marker(
          [tempClickedPosition.lat, tempClickedPosition.lng],
          {
            icon: destinationIcon,
            draggable: true,
          }
        )
          .addTo(mapInstance.current)
          .bindPopup("Điểm đến")
          .openPopup();

        // Xử lý sự kiện kéo marker
        destinationMarkerRef.current.on("dragend", (event) => {
          const marker = event.target;
          const position = marker.getLatLng();
          const updatedPosition = {
            lat: position.lat,
            lng: position.lng,
          };
          console.log("Cập nhật điểm đến sau kéo:", updatedPosition);
          setDestination(updatedPosition);

          // Cập nhật đường đi sau khi kéo điểm đến
          setTimeout(() => {
            updateRoute();
          }, 100);
        });
      }

      // Cập nhật state điểm đến
      setDestination(tempClickedPosition);
      setStatus("Đã đặt điểm đến. Bây giờ bạn có thể đặt xe.");

      // Cập nhật đường đi
      setTimeout(() => {
        updateRoute();
      }, 100);
    }
    // Click thứ ba trở đi - chỉ hiển thị thông báo
    else {
      console.log("Cả điểm đón và điểm đến đã được thiết lập");
      setStatus(
        "Điểm đón và điểm đến đã được thiết lập. Bạn có thể đặt xe hoặc đặt lại để chọn tọa độ mới."
      );
    }
  }, [tempClickedPosition, clickCount]);

  // Cập nhật đường đi khi thay đổi vị trí
  useEffect(() => {
    if (currentLocation && destination) {
      console.log(
        "State cập nhật - currentLocation:",
        currentLocation,
        "destination:",
        destination
      );
      updateRoute();
    }
  }, [currentLocation, destination]);

  // Cập nhật đường đi giữa điểm đón và điểm đến
  const updateRoute = () => {
    console.log("updateRoute được gọi với:", currentLocation, destination);

    if (!currentLocation || !destination || !mapInstance.current) {
      console.log("Không thể tạo đường đi: thiếu điểm đón hoặc điểm đến");
      return;
    }

    // Xóa đường đi cũ nếu có
    if (routeControlRef.current) {
      console.log("Xóa đường đi cũ");
      mapInstance.current.removeControl(routeControlRef.current);
      routeControlRef.current = null;
    }

    console.log("Tạo đường đi mới từ", currentLocation, "đến", destination);

    // Tạo đường đi mới
    try {
      routeControlRef.current = L.Routing.control({
        waypoints: [
          L.latLng(currentLocation.lat, currentLocation.lng),
          L.latLng(destination.lat, destination.lng),
        ],
        routeWhileDragging: true,
        showAlternatives: false,
        fitSelectedRoutes: true,
        show: false, // Không hiển thị hướng dẫn
        lineOptions: {
          styles: [{ color: "#4285F4", weight: 6 }],
        },
        createMarker: function () {
          return null;
        }, // Không tạo marker mới
      }).addTo(mapInstance.current);

      // Xử lý sự kiện khi tìm thấy đường đi
      routeControlRef.current.on("routesfound", function (e) {
        const routes = e.routes;
        if (routes && routes.length > 0) {
          const summary = routes[0].summary;

          // Hiển thị thông tin về chuyến đi
          const distance = (summary.totalDistance / 1000).toFixed(1);
          const duration = Math.round(summary.totalTime / 60);

          console.log(`Tìm thấy đường đi: ${distance} km, ${duration} phút`);
          setStatus(
            `Quãng đường: ${distance} km. Thời gian ước tính: ${duration} phút.`
          );
        } else {
          console.log("Không tìm thấy đường đi");
          setStatus(
            "Không thể tìm đường đi giữa hai điểm. Vui lòng chọn vị trí khác."
          );
        }
      });

      // Xử lý lỗi khi không tìm thấy đường đi
      routeControlRef.current.on("routingerror", function (e) {
        console.log("Lỗi khi tìm đường đi:", e.error);
        setStatus("Không thể tìm đường đi. Vui lòng chọn vị trí khác.");
      });

      console.log("Đã thiết lập routing control");
    } catch (error) {
      console.error("Lỗi khi tạo đường đi:", error);
      setStatus("Lỗi khi tạo đường đi: " + error.message);
    }
  };

  // Lấy danh sách tài xế
  const fetchDrivers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/drivers`);
      console.log("Đã lấy danh sách tài xế:", response.data);
      const newDrivers = response.data.drivers;

      // Cập nhật markers
      const newDriverMarkers = { ...driverMarkers };

      // Cập nhật marker hiện có hoặc thêm mới với icon ngẫu nhiên
      for (const driver of newDrivers) {
        if (newDriverMarkers[driver.id]) {
          // Cập nhật vị trí marker
          const latlng = [driver.location.lat, driver.location.lng];
          newDriverMarkers[driver.id].setLatLng(latlng);
        } else if (mapInstance.current) {
          // Thêm marker mới với icon ngẫu nhiên
          const marker = L.marker([driver.location.lat, driver.location.lng], {
            icon: getRandomDriverIcon(),
          })
            .addTo(mapInstance.current)
            .bindPopup(`<b>${driver.name}</b>`);

          newDriverMarkers[driver.id] = marker;
        }
      }

      // Xóa markers của tài xế đã không còn trong danh sách
      Object.keys(newDriverMarkers).forEach((driverId) => {
        if (!newDrivers.some((d) => d.id === driverId)) {
          if (mapInstance.current) {
            mapInstance.current.removeLayer(newDriverMarkers[driverId]);
          }
          delete newDriverMarkers[driverId];
        }
      });

      setDriverMarkers(newDriverMarkers);
      setDrivers(newDrivers);
    } catch (error) {
      console.error("Lỗi khi lấy danh sách tài xế:", error);
      setStatus(`Không thể lấy danh sách tài xế: ${error.message}`);
    }
  };

  // Cập nhật vị trí tài xế
  const updateDriverMarker = (driverId, location) => {
    setDriverMarkers((prevMarkers) => {
      const newMarkers = { ...prevMarkers };
      if (newMarkers[driverId] && mapInstance.current) {
        newMarkers[driverId].setLatLng([location.lat, location.lng]);
      }
      return newMarkers;
    });

    // Cập nhật trạng thái tài xế
    setDrivers((prevDrivers) => {
      return prevDrivers.map((driver) => {
        if (driver.id === driverId) {
          return { ...driver, location };
        }
        return driver;
      });
    });

    // Cập nhật tài xế đã chọn nếu đây là tài xế đó
    if (selectedDriver && selectedDriver.id === driverId) {
      setSelectedDriver((prev) => ({ ...prev, location }));
    }
  };

  // Đặt xe
  const bookRide = async () => {
    if (!currentLocation || !destination) {
      setStatus("Vui lòng chọn cả điểm đón và điểm đến");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/book`, {
        currentLocation,
        destination,
      });

      console.log("Kết quả đặt xe:", response.data);
      setSelectedDriver(response.data.driver);
      setStatus(`Đặt xe thành công với ${response.data.driver.name}`);

      // Ngừng cập nhật định kỳ khi đã đặt xe
      if (fetchTimerRef.current) {
        clearInterval(fetchTimerRef.current);
        fetchTimerRef.current = null;
      }

      // Đặt view bản đồ tập trung vào tài xế
      if (mapInstance.current && driverMarkers[response.data.driver.id]) {
        mapInstance.current.setView(
          [
            response.data.driver.location.lat,
            response.data.driver.location.lng,
          ],
          15
        );

        // Mở popup cho tài xế được chọn
        driverMarkers[response.data.driver.id].openPopup();
      }
    } catch (error) {
      console.error("Lỗi khi đặt xe:", error);
      setStatus(
        error.response?.data?.message || `Lỗi khi đặt xe: ${error.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  // Đặt lại quá trình đặt xe
  const resetBooking = () => {
    setCurrentLocation(null);
    setDestination(null);
    setSelectedDriver(null);
    setStatus("");
    setClickCount(0);

    // Xóa markers và đường đi
    if (mapInstance.current) {
      // Xóa marker điểm đón và điểm đến
      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.remove();
        pickupMarkerRef.current = null;
      }

      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove();
        destinationMarkerRef.current = null;
      }

      // Xóa đường đi
      if (routeControlRef.current) {
        mapInstance.current.removeControl(routeControlRef.current);
        routeControlRef.current = null;
      }

      // Đặt lại view bản đồ
      mapInstance.current.setView([10.7765, 106.6932], 13);

      // Lấy lại danh sách tài xế
      fetchDrivers();

      // Khởi động lại cập nhật định kỳ
      if (!fetchTimerRef.current) {
        fetchTimerRef.current = setInterval(fetchDrivers, 5000);
      }
    }
  };

  // Làm mới danh sách tài xế
  const refreshDrivers = () => {
    fetchDrivers();
    setStatus("Đang làm mới vị trí tài xế...");

    // Xóa trạng thái sau 2 giây
    setTimeout(() => {
      setStatus(
        currentLocation && destination
          ? "Sẵn sàng đặt xe"
          : currentLocation
          ? "Bây giờ chọn điểm đến trên bản đồ."
          : "Chọn điểm đón trên bản đồ"
      );
    }, 2000);
  };

  // Get the 24 drivers with alphabet-based names, sorted alphabetically
  const getAlphabetDrivers = () => {
    const vietnameseAlphabet = ['a', 'ă', 'â', 'b', 'c', 'd', 'đ', 'e', 'ê', 'g', 'h', 'i', 'k', 'l', 'm', 'n', 'o', 'ô', 'ơ', 'p', 'q', 'r', 's', 't'];
    return drivers
      .filter(driver => 
        vietnameseAlphabet.some(letter => driver.name.toLowerCase().startsWith(letter))
      )
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
  };

  return (
    <div className="App">
      <div className="content">
        <div className="map-container" ref={mapContainerRef}></div>

        <div className="booking-panel">
          <div className="panel-header">
            <h2>Đặt Xe Siêu Tốc</h2>
          </div>

          <div className="panel-content">
            <div className="status-section">
              <div className="status-box">
                <strong>Trạng thái:</strong> {status || "Chọn điểm đón trên bản đồ"}
                <button onClick={refreshDrivers} className="refresh-button">
                  Làm mới Tài xế
                </button>
              </div>
            </div>

            <div className="location-section">
              <div className="location-info">
                {currentLocation && (
                  <div className="location-item">
                    <strong>Điểm đón:</strong> {currentLocation.lat.toFixed(6)},{" "}
                    {currentLocation.lng.toFixed(6)}
                  </div>
                )}
                {destination && (
                  <div className="location-item">
                    <strong>Điểm đến:</strong> {destination.lat.toFixed(6)},{" "}
                    {destination.lng.toFixed(6)}
                  </div>
                )}
              </div>
            </div>

            {selectedDriver && (
              <div className="driver-section">
                <div className="driver-info">
                  <h3>Tài xế của bạn</h3>
                  <p>
                    <strong>Tên:</strong> {selectedDriver.name}
                  </p>
                  <p>
                    <strong>ID:</strong> {selectedDriver.id}
                  </p>
                  <p>
                    <strong>Vị trí hiện tại:</strong>
                  </p>
                  <p>
                    {selectedDriver.location?.lat.toFixed(6)},{" "}
                    {selectedDriver.location?.lng.toFixed(6)}
                  </p>
                </div>
              </div>
            )}

            <div className="action-section">
              <div className="action-buttons">
                <button
                  onClick={bookRide}
                  disabled={
                    !currentLocation || !destination || loading || selectedDriver
                  }
                  className="book-button"
                >
                  {loading ? "Đang đặt..." : "Đặt Xe"}
                </button>
                <button onClick={resetBooking} className="reset-button">
                  Đặt lại
                </button>
              </div>
            </div>

            <div className="driver-list-section">
              <div className="driver-list">
                <h3>Tài xế đang hoạt động ({getAlphabetDrivers().length})</h3>
                <ul>
                  {getAlphabetDrivers().map((driver) => (
                    <li key={driver.id}>
                      <div className="driver-list-item">
                        <div className="driver-name">{driver.name}</div>
                        <div className="driver-distance">
                          {calculateDistance(
                            currentLocation?.lat || 0,
                            currentLocation?.lng || 0,
                            driver.location.lat,
                            driver.location.lng
                          ).toFixed(2)}{" "}
                          km
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hàm tính khoảng cách giữa hai điểm
function calculateDistance(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lng1) return 0;

  const R = 6371; // Bán kính trái đất (km)
  const dLat = deg2rad(lat2 - lat1);
  const dLng = deg2rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Khoảng cách (km)
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

export default App;