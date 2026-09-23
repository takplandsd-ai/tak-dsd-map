// ==============================================
// ส่วนเพิ่มเติมสำหรับ Real-time Navigation
// ==============================================

let watchId = null; // สำหรับติดตามตำแหน่ง
let userMarker = null; // เครื่องหมายผู้ใช้
let routeLine = null; // เส้นทาง
let routePolyline = null; // เส้นทางการเดินทาง
let userPath = []; // เก็บเส้นทางที่ผู้ใช้เดิน

// เริ่มต้นติดตามตำแหน่งแบบเรียลไทม์
function startRealTimeNavigation() {
    if (!navigator.geolocation) {
        alert('อุปกรณ์ของคุณไม่รองรับ GPS แบบเรียลไทม์');
        return;
    }
    
    // หยุดการติดตามเก่าถ้ามี
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
    }
    
    // เริ่มติดตามตำแทไทม์
    watchId = navigator.geolocation.watchPosition(
        updateUserPosition, // ฟังก์ชันอัพเดทตำแหน่ง
        handlePositionError, // ฟังก์ชันจัดการข้อผิดพลาด
        {
            enableHighAccuracy: true, // ความแม่นยำสูง
            timeout: 10000, //  timeout 10 วินาที
            maximumAge: 0 // ไม่ใช้ข้อมูลเก่า
        }
    );
    
    // แสดงข้อความ
    showNavigationMessage('เริ่มติดตามตำแหน่งเรียลไทม์แล้ว');
}

// อัพเดทตำแหน่งผู้ใช้
function updateUserPosition(position) {
    const userLat = position.coords.latitude;
    const userLng = position.coords.longitude;
    
    // เพิ่มตำแหน่งลงในเส้นทาง
    userPath.push([userLat, userLng]);
    
    // อัพเดทเครื่องหมายผู้ใช้
    updateUserMarker(userLat, userLng);
    
    // อัพเดทแผนที่ให้แสดงผู้ใช้
    map.setView([userLat, userLng], 18);
    
    // ตรวจสอบว่าอยู่ใกล้จุดเปลี่ยนทางหรือไม่
    checkForNextStep(userLat, userLng);
    
    // อัพเดทข้อมูลบนหน้าจอ
    updateNavigationInfo(position);
}

// อัพเดทเครื่องหมายผู้ใช้
function updateUserMarker(lat, lng) {
    if (userMarker) {
        // ย้ายเครื่องหมายไปตำแหน่งใหม่
        userMarker.setLatLng([lat, lng]);
        
        // สร้างเส้นทางการเดิน
        if (userPath.length > 1) {
            if (routePolyline) {
                map.removeLayer(routePolyline);
            }
            routePolyline = L.polyline(userPath, {
                color: '#0d6efd',
                weight: 4,
                opacity: 0.7,
                lineCap: 'round'
            }).addTo(map);
        }
    } else {
        // สร้างเครื่องหมายใหม่
        userMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                html: `<div class="real-time-marker">
                         <div class="pulse"></div>
                         <div class="dot"></div>
                       </div>`,
                className: 'real-time-marker-div',
                iconSize: [40, 40]
            })
        }).addTo(map);
    }
}

// ตรวจสอบว่าอยู่ใกล้จุดเปลี่ยนทางหรือไม่
function checkForNextStep(userLat, userLng) {
    if (!currentRoute || !currentRoute.instructions) return;
    
    // ตรวจสอบว่าใกล้ถึงขั้นตอนถัดไปหรือไม่
    // (ตัวอย่าง: ถ้าอยู่ใกล้จุดหมาย 20 เมตร ให้เปลี่ยนขั้นตอน)
    const targetBuilding = buildings.find(b => b.id === currentRoute.to);
    if (!targetBuilding) return;
    
    const distanceToTarget = calculateDistance(
        userLat, userLng, 
        targetBuilding.lat, targetBuilding.lng
    );
    
    // ถ้าใกล้จุดหมายน้อยกว่า 20 เมตร
    if (distanceToTarget < 20 && currentStep < currentRoute.instructions.length - 1) {
        nextStep(); // เปลี่ยนขั้นตอนอัตโนมัติ
        speakText("ใกล้ถึงแล้ว อีกนิดเดียวก็ถึงจุดหมาย");
    }
}

// อัพเดทข้อมูลนำทาง
function updateNavigationInfo(position) {
    if (!currentRoute) return;
    
    const targetBuilding = buildings.find(b => b.id === currentRoute.to);
    if (!targetBuilding) return;
    
    const distance = calculateDistance(
        position.coords.latitude,
        position.coords.longitude,
        targetBuilding.lat,
        targetBuilding.lng
    );
    
    // แสดงระยะทางคงเหลือ
    document.getElementById('distanceRemaining').textContent = 
        `เหลืออีก ${Math.round(distance)} เมตร`;
    
    // คำนวณเวลาถึงโดยประมาณ
    const walkingSpeed = 1.4; // เมตร/วินาที (เดินปกติ)
    const timeRemaining = Math.round(distance / walkingSpeed / 60);
    document.getElementById('timeRemaining').textContent = 
        `ประมาณ ${timeRemaining} นาที`;
}

// จัดการข้อผิดพลาด GPS
function handlePositionError(error) {
    let message = 'GPS มีปัญหา: ';
    
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message += 'ไม่อนุญาตให้เข้าถึงตำแหน่ง';
            break;
        case error.POSITION_UNAVAILABLE:
            message += 'ไม่สามารถรับข้อมูลตำแหน่งได้';
            break;
        case error.TIMEOUT:
            message += 'ขอข้อมูลตำแหน่งนานเกินไป';
            break;
        default:
            message += 'ข้อผิดพลาดไม่ทราบสาเหตุ';
            break;
    }
    
    showNavigationMessage(message, 'warning');
}

// หยุดการติดตามตำแหน่ง
function stopRealTimeTracking() {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    
    if (routePolyline) {
        map.removeLayer(routePolyline);
        routePolyline = null;
    }
    
    userPath = [];
}
