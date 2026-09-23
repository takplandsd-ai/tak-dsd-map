// ==============================================
// ระบบนำทางระหว่างอาคาร (Inter-building Navigation)
// ==============================================

// ตัวแปรหลัก
let map;
let buildingMarkers = [];
let currentRoute = null;
let currentStep = 0;
let buildings = [];
let routes = [];
// ==============================================
// ส่วนเพิ่มเติมสำหรับ Real-time Navigation
// ==============================================
let watchId = null; // สำหรับติดตามตำแหน่ง
let userMarker = null; // เครื่องหมายผู้ใช้
let routeLine = null; // เส้นทาง
let routePolyline = null; // เส้นทางการเดินทาง
let userPath = []; // เก็บเส้นทางที่ผู้ใช้เดิน

// โหลดเมื่อหน้าเว็บพร้อม
document.addEventListener('DOMContentLoaded', function () {
    initMap();
    loadData();
    initEventListeners();
    updateSelectOptions();
});

// 1. เริ่มต้นแผนที่
function initMap() {
    // ตั้งค่าพิกัดกลาง (แก้ไขเป็นพิกัดหน่วยงานคุณ)
    const defaultCenter = [13.8763, 100.5518];

    map = L.map('map').setView(defaultCenter, 17);

    // ใช้แผนที่ OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 20,
        minZoom: 15
    }).addTo(map);

    // ควบคุมมาตราส่วน
    L.control.scale({ imperial: false }).addTo(map);

    // ตำแหน่งผู้ใช้
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(showUserLocation,
            () => console.log('ไม่สามารถเข้าถึงตำแหน่งได้'));
    }
}

// 2. โหลดข้อมูล
function loadData() {
    // ข้อมูลอาคาร (จาก locations.json)
    buildings = [
        {
            id: 1,
            name: "อาคารสำนักงานกลาง",
            description: "อาคารหลักสำหรับบริหารงาน",
            lat: 13.8765,
            lng: 100.5520,
            category: "อาคารหลัก"
        },
        {
            id: 2,
            name: "ศูนย์บริการประชาชน",
            description: "ให้บริการบัตรประชาชนและทะเบียน",
            lat: 13.8760,
            lng: 100.5515,
            category: "บริการ"
        },
        {
            id: 3,
            name: "หอประชุมใหญ่",
            description: "สำหรับการประชุมสัมมนา",
            lat: 13.8758,
            lng: 100.5525,
            category: "หอประชุม"
        },
        {
            id: 4,
            name: "ศูนย์ข้อมูลข่าวสาร",
            description: "บริการข้อมูลและเอกสารราชการ",
            lat: 13.8762,
            lng: 100.5512,
            category: "ข้อมูล"
        },
        {
            id: 5,
            name: "อาคารโรงอาหาร",
            description: "บริการอาหารและเครื่องดื่ม",
            lat: 13.8755,
            lng: 100.5510,
            category: "บริการ"
        },
        {
            id: 6,
            name: "อาคารฝึกอบรม",
            description: "ศูนย์ฝึกอบรมเจ้าหน้าที่",
            lat: 13.8768,
            lng: 100.5508,
            category: "ฝึกอบรม"
        }
    ];

    // ข้อมูลเส้นทางระหว่างอาคาร
    routes = [
        {
            id: "2-3",
            from: 2,
            to: 3,
            name: "ศูนย์บริการ → หอประชุม",
            distance: "180 เมตร",
            time: "4 นาที",
            image: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=200&fit=crop",
            instructions: [
                "ออกจากศูนย์บริการทางประตูด้านหน้า",
                "เดินตรงไปตามทางเดิน 80 เมตร",
                "เลี้ยวขวาที่สวนน้ำพุ (จุดสังเกต: น้ำพุทรงกลม)",
                "เดินตรงต่ออีก 70 เมตร",
                "เลี้ยวซ้ายก่อนถึงลานจอดรถ",
                "หอประชุมใหญ่อยู่ทางขวามือ"
            ],
            landmarks: "สวนน้ำพุ, ลานจอดรถ, ป้ายหอประชุม",
            accessibility: "มีทางลาดสำหรับรถเข็น",
            notes: "มีหลังคาตลอดทาง"
        },
        {
            id: "2-6",
            from: 2,
            to: 6,
            name: "ศูนย์บริการ → อาคารฝึกอบรม",
            distance: "250 เมตร",
            time: "5 นาที",
            image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=200&fit=crop",
            instructions: [
                "จากศูนย์บริการ เดินไปทางลานจอดรถ",
                "เลี้ยวซ้ายที่ทางแยกแรก",
                "เดินผ่านอาคารบริหาร 100 เมตร",
                "เลี้ยวขวาที่ทางเดินมีหลังคา",
                "เดินตรงไปอีก 120 เมตร",
                "อาคารฝึกอบรมอยู่ตรงหน้า"
            ],
            landmarks: "ลานจอดรถ, อาคารบริหาร, ทางเดินหลังคา",
            accessibility: "ทางราบทั้งหมด",
            notes: "ผ่านใต้ร่มไม้"
        },
        {
            id: "1-4",
            from: 1,
            to: 4,
            name: "สำนักงานกลาง → ศูนย์ข้อมูล",
            distance: "120 เมตร",
            time: "2 นาที",
            image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=400&h=200&fit=crop",
            instructions: [
                "ออกจากอาคารสำนักงานทางประตูข้าง",
                "เดินตรงไป 60 เมตร",
                "เลี้ยวซ้ายที่ทางเดินกระจก",
                "เดินขึ้นบันไดหรือใช้ลิฟต์",
                "ศูนย์ข้อมูลอยู่ชั้น 1 ทางขวา"
            ],
            landmarks: "ทางเดินกระจก, ลิฟต์กลาง",
            accessibility: "มีลิฟต์และทางลาด",
            notes: "อยู่ในร่มทั้งหมด"
        },
        {
            id: "3-5",
            from: 3,
            to: 5,
            name: "หอประชุม → โรงอาหาร",
            distance: "150 เมตร",
            time: "3 นาที",
            image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=200&fit=crop",
            instructions: [
                "จากหอประชุม เดินลงบันไดด้านข้าง",
                "เลี้ยวซ้ายที่ลานอเนกประสงค์",
                "เดินตรงไป 100 เมตร",
                "เลี้ยวขวาที่ตู้จดหมาย",
                "โรงอาหารอยู่ชั้น 1 ทางซ้าย"
            ],
            landmarks: "ลานอเนกประสงค์, ตู้จดหมาย, ป้ายโรงอาหาร",
            accessibility: "มีทางลาด",
            notes: "มีที่นั่งพักระหว่างทาง"
        }
    ];

    // แสดงข้อมูล
    displayBuildingsOnMap();
    displayBuildingList();
}

// 3. แสดงอาคารบนแผนที่
function displayBuildingsOnMap() {
    // ล้างเครื่องหมายเก่า
    buildingMarkers.forEach(marker => map.removeLayer(marker));
    buildingMarkers = [];

    // สร้างเครื่องหมายใหม่
    buildings.forEach(building => {
        // เลือกสีตามประเภทอาคาร
        let iconColor = '#198754'; // เขียว - หลัก
        if (building.category === 'บริการ') iconColor = '#0d6efd'; // น้ำเงิน
        if (building.category === 'หอประชุม') iconColor = '#ffc107'; // เหลือง
        if (building.category === 'ข้อมูล') iconColor = '#6f42c1'; // ม่วง
        if (building.category === 'ฝึกอบรม') iconColor = '#fd7e14'; // ส้ม

        const marker = L.marker([building.lat, building.lng], {
            icon: L.divIcon({
                html: `<div style="background:${iconColor};color:white;width:35px;height:35px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;border:3px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3)">
                        ${building.id}
                      </div>`,
                className: 'building-marker',
                iconSize: [35, 35]
            })
        }).addTo(map);

        marker.bindPopup(`
            <div style="min-width:200px">
                <h6>อาคาร ${building.id}: ${building.name}</h6>
                <p class="mb-1">${building.description}</p>
                <div class="mt-2">
                    <button class="btn btn-sm btn-primary w-100" onclick="setAsStartPoint(${building.id})">
                        <i class="fas fa-play me-1"></i>เป็นจุดเริ่มต้น
                    </button>
                    <button class="btn btn-sm btn-success w-100 mt-1" onclick="setAsEndPoint(${building.id})">
                        <i class="fas fa-flag me-1"></i>เป็นจุดหมาย
                    </button>
                </div>
            </div>
        `);

        buildingMarkers.push(marker);
    });
}

// 4. แสดงรายการอาคาร
function displayBuildingList() {
    const buildingList = document.getElementById('building-list');
    buildingList.innerHTML = '';

    buildings.forEach((building, index) => {
        const delay = index * 100;

        const item = document.createElement('div');
        item.className = 'list-group-item building-item';
        item.style.animationDelay = `${delay}ms`;
        item.id = `building-${building.id}`;

        item.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <div class="d-flex align-items-center">
                        <div class="building-number me-2" style="width:30px;height:30px;background:#198754;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold">
                            ${building.id}
                        </div>
                        <div>
                            <h6 class="mb-0">${building.name}</h6>
                            <p class="mb-0 text-muted small">${building.description}</p>
                        </div>
                    </div>
                </div>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline-primary" onclick="setAsStartPoint(${building.id})">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-success" onclick="setAsEndPoint(${building.id})">
                        <i class="fas fa-flag"></i>
                    </button>
                </div>
            </div>
        `;

        buildingList.appendChild(item);
    });
}

// 5. อัพเดทตัวเลือกใน dropdown
function updateSelectOptions() {
    const fromSelect = document.getElementById('fromBuilding');
    const toSelect = document.getElementById('toBuilding');

    // ล้างตัวเลือกเก่า (เก็บเฉพาะตัวเลือกแรก)
    fromSelect.innerHTML = '<option value="">-- เลือกอาคารเริ่มต้น --</option>';
    toSelect.innerHTML = '<option value="">-- เลือกอาคารปลายทาง --</option>';

    // เพิ่มตัวเลือกอาคาร
    buildings.forEach(building => {
        fromSelect.innerHTML += `<option value="${building.id}">อาคาร ${building.id}: ${building.name}</option>`;
        toSelect.innerHTML += `<option value="${building.id}">อาคาร ${building.id}: ${building.name}</option>`;
    });
}

// 6. อัพเดทตัวเลือกปลายทาง (ไม่ให้เลือกอาคารเดียวกัน)
function updateToOptions() {
    const fromId = document.getElementById('fromBuilding').value;
    const toSelect = document.getElementById('toBuilding');

    if (fromId) {
        // เปิดใช้งาน dropdown ปลายทาง
        toSelect.disabled = false;

        // ซ่อนอาคารเริ่มต้นจากรายการปลายทาง
        Array.from(toSelect.options).forEach(option => {
            if (option.value === fromId) {
                option.style.display = 'none';
            } else {
                option.style.display = '';
            }
        });

        // เลือกตัวเลือกแรกที่แสดง
        const visibleOptions = Array.from(toSelect.options).filter(opt => opt.style.display !== 'none');
        if (visibleOptions.length > 1) {
            toSelect.value = visibleOptions[1].value;
        }

        // ตรวจสอบเส้นทาง
        checkRoute();
    } else {
        toSelect.disabled = true;
        toSelect.value = '';
        document.getElementById('routeInfo').classList.add('d-none');
        document.getElementById('showRouteBtn').disabled = true;
        document.getElementById('startRouteBtn').disabled = true;
    }
}

// 7. ตรวจสอบว่ามีเส้นทางนี้หรือไม่
function checkRoute() {
    const fromId = parseInt(document.getElementById('fromBuilding').value);
    const toId = parseInt(document.getElementById('toBuilding').value);

    if (!fromId || !toId) return;

    // หาเส้นทาง
    const route = findRoute(fromId, toId);

    if (route) {
        // แสดงข้อมูลเส้นทาง
        document.getElementById('routeInfo').classList.remove('d-none');
        document.getElementById('routeDistance').textContent = route.distance;
        document.getElementById('routeTime').textContent = route.time;
        document.getElementById('routeDescription').textContent = route.name;

        // เปิดใช้งานปุ่ม
        document.getElementById('showRouteBtn').disabled = false;
        document.getElementById('startRouteBtn').disabled = false;

        currentRoute = route;
    } else {
        // แสดงข้อความว่าไม่มีเส้นทาง
        document.getElementById('routeInfo').classList.remove('d-none');
        document.getElementById('routeDistance').textContent = 'ต้องสำรวจ';
        document.getElementById('routeTime').textContent = '-';
        document.getElementById('routeDescription').textContent = 'ยังไม่มีข้อมูลเส้นทางนี้';
        document.getElementById('routeInfo').className = 'alert alert-warning';

        // ปิดการใช้งานปุ่ม
        document.getElementById('showRouteBtn').disabled = true;
        document.getElementById('startRouteBtn').disabled = true;

        currentRoute = null;
    }
}

// 8. ค้นหาเส้นทาง
function findRoute(fromId, toId) {
    // ค้นหาเส้นทางตรง
    const directRoute = routes.find(r =>
        (r.from === fromId && r.to === toId) ||
        (r.from === toId && r.to === fromId)
    );

    if (directRoute) return directRoute;

    // ถ้าไม่มีเส้นทางตรง สร้างเส้นทางอัตโนมัติ (แบบง่าย)
    const fromBuilding = buildings.find(b => b.id === fromId);
    const toBuilding = buildings.find(b => b.id === toId);

    if (!fromBuilding || !toBuilding) return null;

    // คำนวณระยะทางคร่าวๆ
    const distance = calculateDistance(fromBuilding.lat, fromBuilding.lng, toBuilding.lat, toBuilding.lng);

    return {
        id: `${fromId}-${toId}`,
        from: fromId,
        to: toId,
        name: `${fromBuilding.name} → ${toBuilding.name}`,
        distance: `${Math.round(distance)} เมตร`,
        time: `${Math.round(distance / 50)} นาที`, // เดิน 50 เมตร/นาที
        image: "https://via.placeholder.com/400x200/6c757d/ffffff?text=เส้นทางสำรวจเพิ่มเติม",
        instructions: [
            `เดินจาก ${fromBuilding.name}`,
            "เดินตามทางเดินหลัก",
            `ไปยัง ${toBuilding.name}`,
            "คำแนะนำเพิ่มเติมต้องสำรวจเส้นทางจริง"
        ],
        landmarks: "ต้องสำรวจจุดสังเกตเพิ่มเติม",
        accessibility: "ไม่ทราบสภาพเส้นทาง",
        notes: "กรุณาติดต่อเจ้าหน้าที่เพื่อสำรวจเส้นทางนี้"
    };
}

// 9. คำนวณระยะทางระหว่างสองจุด
function calculateDistance(lat1, lng1, lat2, lng2) {
    // แปลงเป็นเรเดียน
    const R = 6371000; // รัศมีโลกเป็นเมตร
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    // สูตร Haversine
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // ระยะทางเป็นเมตร
}

// 10. แสดงเส้นทางบนแผนที่
function showRouteOnMap() {
    if (!currentRoute) return;

    // ล้างเส้นทางเก่า
    if (routeLine) {
        map.removeLayer(routeLine);
    }

    const fromBuilding = buildings.find(b => b.id === currentRoute.from);
    const toBuilding = buildings.find(b => b.id === currentRoute.to);

    if (!fromBuilding || !toBuilding) return;

    // วาดเส้นตรงระหว่างอาคาร
    routeLine = L.polyline([
        [fromBuilding.lat, fromBuilding.lng],
        [toBuilding.lat, toBuilding.lng]
    ], {
        color: '#198754',
        weight: 4,
        opacity: 0.7,
        dashArray: '10, 10'
    }).addTo(map);

    // ปรับมุมมองแผนที่ให้เห็นเส้นทาง
    const bounds = L.latLngBounds([
        [fromBuilding.lat, fromBuilding.lng],
        [toBuilding.lat, toBuilding.lng]
    ]);
    map.fitBounds(bounds, { padding: [50, 50] });

    // แสดง Popup
    routeLine.bindPopup(`
        <div style="min-width:200px">
            <h6>${currentRoute.name}</h6>
            <p class="mb-1"><i class="fas fa-ruler me-1"></i> ${currentRoute.distance}</p>
            <p class="mb-1"><i class="fas fa-clock me-1"></i> ${currentRoute.time}</p>
            <button class="btn btn-sm btn-success w-100 mt-2" onclick="startRouteNavigation()">
                <i class="fas fa-play me-1"></i>เริ่มนำทาง
            </button>
        </div>
    `).openPopup();
}

// 11. เริ่มนำทางตามเส้นทาง
function startRouteNavigation() {
    if (!currentRoute) return;

    currentStep = 0;
    document.getElementById('navigationPanel').classList.remove('d-none');
    document.getElementById('routeTitle').textContent = currentRoute.name;
    document.getElementById('routeStats').textContent = `${currentRoute.distance} • ${currentRoute.time}`;

    // อัพเดทข้อมูลนำทาง
    showNavigationStep(0);

    // เลื่อนไปที่แผงนำทาง
    document.getElementById('navigationPanel').scrollIntoView({ behavior: 'smooth' });
}

// 12. แสดงขั้นตอนนำทาง
function showNavigationStep(stepIndex) {
    if (!currentRoute || !currentRoute.instructions) return;

    const instructions = currentRoute.instructions;
    currentStep = stepIndex;

    // อัพเดทขั้นตอน
    document.getElementById('currentStep').textContent = `ขั้นตอนที่ ${stepIndex + 1}/${instructions.length}`;
    document.getElementById('instructionText').textContent = instructions[stepIndex];

    // อัพเดทภาพ (แสดงเฉพาะขั้นตอนแรก)
    if (stepIndex === 0 && currentRoute.image) {
        document.getElementById('routeImage').src = currentRoute.image;
    }

    // อัพเดทจุดสังเกต (แสดงเฉพาะขั้นตอนแรก)
    if (stepIndex === 0 && currentRoute.landmarks) {
        document.getElementById('landmarksInfo').classList.remove('d-none');
        document.getElementById('landmarksText').textContent = currentRoute.landmarks;
    }

    // อัพเดทความคืบหน้า
    const progressPercent = Math.round(((stepIndex + 1) / instructions.length) * 100);
    document.getElementById('progressPercent').textContent = `${progressPercent}%`;
    document.getElementById('progressBar').style.width = `${progressPercent}%`;

    // อัพเดทปุ่ม
    document.getElementById('prevBtn').disabled = stepIndex === 0;
    document.getElementById('nextBtn').disabled = stepIndex === instructions.length - 1;

    // พูดคำแนะนำ (ถ้าผู้ใช้อนุญาต)
    if (stepIndex === 0) {
        speakInstruction();
    }
}

// 13. ฟังก์ชันนำทางขั้นตอนต่อไป
function nextStep() {
    if (!currentRoute || !currentRoute.instructions) return;

    if (currentStep < currentRoute.instructions.length - 1) {
        showNavigationStep(currentStep + 1);
    } else {
        // ถึงจุดหมาย
        document.getElementById('instructionText').innerHTML = `
            <div class="text-center">
                <i class="fas fa-check-circle text-success fa-2x mb-2"></i>
                <h6 class="mb-1">ถึงจุดหมายแล้ว!</h6>
                <p class="mb-0 small">คุณมาถึงปลายทางเรียบร้อยแล้ว</p>
            </div>
        `;
        speakText("ถึงจุดหมายแล้ว ปลายทางอยู่ตรงหน้าคุณแล้ว");
    }
}

function prevStep() {
    if (currentStep > 0) {
        showNavigationStep(currentStep - 1);
    }
}

// 14. พูดคำแนะนำ
function speakInstruction() {
    if (!currentRoute || !currentRoute.instructions) return;

    const text = currentRoute.instructions[currentStep];
    speakText(text);
}

function speakText(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'th-TH';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        speechSynthesis.speak(utterance);
    }
}

// 15. หยุดการนำทาง
function stopNavigation() {
    currentRoute = null;
    currentStep = 0;
    document.getElementById('navigationPanel').classList.add('d-none');

    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
}

// 16. ตั้งค่าจุดเริ่มต้น/สิ้นสุดจากปุ่ม
function setAsStartPoint(buildingId) {
    document.getElementById('fromBuilding').value = buildingId;
    updateToOptions();
    highlightBuilding(buildingId, 'start');
}

function setAsEndPoint(buildingId) {
    document.getElementById('toBuilding').value = buildingId;
    checkRoute();
    highlightBuilding(buildingId, 'end');
}

// 17. เน้นอาคารที่เลือก
function highlightBuilding(buildingId, type) {
    // ล้างการเน้นเก่า
    document.querySelectorAll('.building-item').forEach(item => {
        item.classList.remove('building-selected');
        item.classList.remove('bg-primary', 'bg-success', 'text-white');
    });

    // เน้นอาคารที่เลือก
    const buildingItem = document.getElementById(`building-${buildingId}`);
    if (buildingItem) {
        buildingItem.classList.add('building-selected');
        if (type === 'start') {
            buildingItem.classList.add('bg-primary', 'text-white');
        } else {
            buildingItem.classList.add('bg-success', 'text-white');
        }
    }
}

// 18. แสดงตำแหน่งผู้ใช้
function showUserLocation(position) {
    const userLatLng = [position.coords.latitude, position.coords.longitude];

    if (userMarker) {
        map.removeLayer(userMarker);
    }

    userMarker = L.marker(userLatLng, {
        icon: L.divIcon({
            html: '<div style="background:#0d6efd;color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3)"><i class="fas fa-user"></i></div>',
            className: 'user-marker',
            iconSize: [30, 30]
        })
    }).addTo(map);

    userMarker.bindPopup("<b>ตำแหน่งปัจจุบันของคุณ</b>");
}

function useMyLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(showUserLocation,
            () => alert('ไม่สามารถเข้าถึงตำแหน่งได้'));
    } else {
        alert('เบราว์เซอร์ไม่รองรับการเข้าถึงตำแหน่ง');
    }
}

// 19. แสดงอาคารทั้งหมด
function showAllBuildings() {
    if (buildings.length > 0) {
        const bounds = L.latLngBounds(
            buildings.map(b => [b.lat, b.lng])
        );
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

// 20. รีเซ็ตเส้นทาง
function resetRoute() {
    document.getElementById('fromBuilding').value = '';
    document.getElementById('toBuilding').value = '';
    document.getElementById('toBuilding').disabled = true;
    document.getElementById('routeInfo').classList.add('d-none');
    document.getElementById('showRouteBtn').disabled = true;
    document.getElementById('startRouteBtn').disabled = true;

    // ล้างเส้นทางบนแผนที่
    if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
    }

    // ล้างการเน้นอาคาร
    document.querySelectorAll('.building-item').forEach(item => {
        item.classList.remove('building-selected', 'bg-primary', 'bg-success', 'text-white');
    });

    // หยุดการนำทางถ้ากำลังทำอยู่
    stopNavigation();
}

// 21. ฟังก์ชันเสริม
function toggleDetails() {
    const landmarksInfo = document.getElementById('landmarksInfo');
    landmarksInfo.classList.toggle('d-none');
}

function toggleFullscreen() {
    const navPanel = document.getElementById('navigationPanel');
    navPanel.classList.toggle('fullscreen-navigation');
}

function showAbout() {
    new bootstrap.Modal(document.getElementById('aboutModal')).show();
}

// 22. ตั้งค่า Event Listeners
function initEventListeners() {
    // ตรวจสอบเส้นทางเมื่อเลือกอาคารปลายทาง
    document.getElementById('toBuilding').addEventListener('change', checkRoute);

    // ปุ่มกด Enter ในช่องค้นหา
    document.getElementById('searchInput')?.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') filterBuildings();
    });
}

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

    switch (error.code) {
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

// เริ่มต้นนำทางแบบเรียลไทม์
function startRealTimeRouteNavigation() {
    if (!currentRoute) {
        alert('กรุณาเลือกเส้นทางก่อน');
        return;
    }

    // เริ่มระบบนำทางปกติ
    startRouteNavigation();

    // แสดง UI แบบเรียลไทม์
    document.getElementById('realTimeInfo').classList.remove('d-none');
    document.getElementById('directionIndicator').classList.remove('d-none');
    document.getElementById('realTimeControls').classList.remove('d-none');

    // เริ่มติดตามตำแหน่ง
    startRealTimeNavigation();

    // ขออนุญาตใช้งานเสียง
    requestAudioPermission();
}

// หยุดนำทางแบบเรียลไทม์
function stopRealTimeNavigation() {
    stopRealTimeTracking();

    // ซ่อน UI แบบเรียลไทม์
    document.getElementById('realTimeInfo').classList.add('d-none');
    document.getElementById('directionIndicator').classList.add('d-none');
    document.getElementById('realTimeControls').classList.add('d-none');

    showNavigationMessage('หยุดการติดตามตำแหน่งเรียลไทม์แล้ว');
}

// ศูนย์กลางแผนที่บนผู้ใช้
function centerMapOnUser() {
    if (userMarker) {
        const latLng = userMarker.getLatLng();
        map.setView(latLng, 18);
    }
}

// ขออนุญาตใช้งานเสียง
function requestAudioPermission() {
    if ('speechSynthesis' in window) {
        // ทดสอบพูด
        const utterance = new SpeechSynthesisUtterance('');
        utterance.volume = 0.01; // เสียงเบามากๆ
        speechSynthesis.speak(utterance);
        speechSynthesis.cancel(); // หยุดทันที
    }
}

// แสดงข้อความนำทาง
function showNavigationMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `alert alert-${type} alert-dismissible fade show`;
    messageDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    // แทรกที่ต้น container
    const container = document.querySelector('.container');
    container.insertBefore(messageDiv, container.firstChild);

    // ลบอัตโนมัติหลังจาก 5 วินาที
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
}

// อัพเดททิศทาง
function updateDirection(heading) {
    const arrow = document.getElementById('directionArrow');
    if (!arrow) return;

    // แปลงองศาเป็นทิศทาง
    let direction = '↑';
    if (heading >= 337.5 || heading < 22.5) direction = '↑';
    else if (heading >= 22.5 && heading < 67.5) direction = '↗';
    else if (heading >= 67.5 && heading < 112.5) direction = '→';
    else if (heading >= 112.5 && heading < 157.5) direction = '↘';
    else if (heading >= 157.5 && heading < 202.5) direction = '↓';
    else if (heading >= 202.5 && heading < 247.5) direction = '↙';
    else if (heading >= 247.5 && heading < 292.5) direction = '←';
    else if (heading >= 292.5 && heading < 337.5) direction = '↖';

    arrow.textContent = direction;
    arrow.style.transform = `rotate(${heading}deg)`;
}

// อัพเดทฟังก์ชัน updateUserPosition
function updateUserPosition(position) {
    const userLat = position.coords.latitude;
    const userLng = position.coords.longitude;
    const accuracy = position.coords.accuracy;
    const heading = position.coords.heading;
    const speed = position.coords.speed;

    // อัพเดทข้อมูล
    updateUserMarker(userLat, userLng);
    updateAccuracyCircle(userLat, userLng, accuracy);
    if (heading) updateDirection(heading);
    updateSpeed(speed);

    // อัพเดทแผนที่
    map.setView([userLat, userLng], 18);

    // ตรวจสอบขั้นตอน
    checkForNextStep(userLat, userLng);

    // อัพเดทข้อมูลนำทาง
    updateNavigationInfo(position);
}

// อัพเดทวงกลมแสดงความแม่นยำ
function updateAccuracyCircle(lat, lng, accuracy) {
    // ลบวงกลมเก่า
    if (window.accuracyCircle) {
        map.removeLayer(window.accuracyCircle);
    }

    // สร้างวงกลมใหม่
    window.accuracyCircle = L.circle([lat, lng], {
        radius: accuracy,
        color: 'rgba(13, 110, 253, 0.3)',
        fillColor: 'rgba(13, 110, 253, 0.1)',
        fillOpacity: 0.2,
        weight: 1
    }).addTo(map);
}

// อัพเดทความเร็ว
function updateSpeed(speed) {
    if (speed !== null) {
        const speedKmh = Math.round(speed * 3.6); // แปลง m/s เป็น km/h
        document.getElementById('currentSpeed').textContent = speedKmh;
    }
}
