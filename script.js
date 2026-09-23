/* ==============================================
   ระบบนำทางหน่วยงานรัฐ - JavaScript Core
   Version: 3.0 - Complete Edition
   Date: 2026-09-02
   Author: กรมส่งเสริมการปกครองท้องถิ่น
   License: MIT - ใช้งานฟรี 100%
=============================================== */

// ========== 1. GLOBAL VARIABLES & CONFIGURATION ==========
const CONFIG = {
    // Map Configuration
    MAP_CENTER: [13.8763, 100.5518], // ศูนย์ราชการแจ้งวัฒนะ (ปรับตามหน่วยงานคุณ)
    MAP_ZOOM: 17,
    MAP_MIN_ZOOM: 15,
    MAP_MAX_ZOOM: 20,
    
    // App Configuration
    APP_NAME: 'ระบบนำทางหน่วยงานรัฐ',
    DEPARTMENT_NAME: 'กรมส่งเสริมการปกครองท้องถิ่น',
    CONTACT_PHONE: '02-123-4567',
    CONTACT_EMAIL: 'contact@dla.go.th',
    
    // Navigation Settings
    WALKING_SPEED: 1.4, // เมตร/วินาที
    AUTO_NEXT_DISTANCE: 20, // เมตร (ระยะเปลี่ยนขั้นตอนอัตโนมัติ)
    GPS_UPDATE_INTERVAL: 3000, // มิลลิวินาที
    
    // Storage Keys
    STORAGE_KEYS: {
        THEME: 'nav_system_theme',
        LAST_ROUTE: 'last_route',
        USER_PREFERENCES: 'user_prefs',
        BUILDING_DATA: 'building_data_cache'
    }
};

// Global State Variables
let map = null;
let userMarker = null;
let buildingMarkers = [];
let routeLine = null;
let userPath = [];
let currentRoute = null;
let currentStep = 0;
let buildings = [];
let routes = [];
let realtimeWatchId = null;
let isRealtimeTracking = false;
let speechEnabled = true;
let darkMode = false;

// DOM Elements Cache
let domCache = {};

// ========== 2. INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    showLoading(true);
    
    try {
        // Initialize DOM Cache
        initializeDOMCache();
        
        // Initialize Map
        initializeMap();
        
        // Load Data
        await loadData();
        
        // Initialize UI Components
        initializeUI();
        
        // Load User Preferences
        loadUserPreferences();
        
        // Check Geolocation Support
        checkGeolocationSupport();
        
        // Show Welcome Message
        setTimeout(() => {
            showToast('ระบบนำทางหน่วยงานรัฐพร้อมใช้งาน', 'success');
        }, 1000);
        
    } catch (error) {
        console.error('Initialization error:', error);
        showToast('เกิดข้อผิดพลาดในการโหลดระบบ', 'danger');
    } finally {
        showLoading(false);
    }
}

function initializeDOMCache() {
    domCache = {
        // Form Elements
        fromBuilding: document.getElementById('fromBuilding'),
        toBuilding: document.getElementById('toBuilding'),
        
        // Route Info
        routeInfo: document.getElementById('routeInfo'),
        routeName: document.getElementById('routeName'),
        routeDistance: document.getElementById('routeDistance'),
        routeTime: document.getElementById('routeTime'),
        routeSteps: document.getElementById('routeSteps'),
        routeDescText: document.getElementById('routeDescText'),
        routeStatus: document.getElementById('routeStatus'),
        
        // Buttons
        previewBtn: document.getElementById('previewBtn'),
        startNavBtn: document.getElementById('startNavBtn'),
        prevBtn: document.getElementById('prevBtn'),
        nextBtn: document.getElementById('nextBtn'),
        speakBtn: document.getElementById('speakBtn'),
        realtimeBtn: document.getElementById('realtimeBtn'),
        
        // Navigation Panel
        navigationPanel: document.getElementById('navigationPanel'),
        navTitle: document.getElementById('navTitle'),
        navSubtitle: document.getElementById('navSubtitle'),
        currentStepText: document.getElementById('currentStepText'),
        stepProgress: document.getElementById('stepProgress'),
        stepDistance: document.getElementById('stepDistance'),
        stepImage: document.getElementById('stepImage'),
        imageCaption: document.getElementById('imageCaption'),
        instructionText: document.getElementById('instructionText'),
        landmarksText: document.getElementById('landmarksText'),
        accessibilityText: document.getElementById('accessibilityText'),
        
        // Real-time Stats
        realtimeStats: document.getElementById('realtimeStats'),
        remainingDistance: document.getElementById('remainingDistance'),
        remainingTime: document.getElementById('remainingTime'),
        currentSpeed: document.getElementById('currentSpeed'),
        
        // Building List
        buildingTable: document.getElementById('buildingTable'),
        buildingCount: document.getElementById('buildingCount'),
        
        // Loading
        loadingOverlay: document.getElementById('loadingOverlay'),
        
        // Toast
        toastMessage: document.getElementById('toastMessage')
    };
}

function initializeMap() {
    // Create Map
    map = L.map('map', {
        center: CONFIG.MAP_CENTER,
        zoom: CONFIG.MAP_ZOOM,
        minZoom: CONFIG.MAP_MIN_ZOOM,
        maxZoom: CONFIG.MAP_MAX_ZOOM,
        zoomControl: true,
        attributionControl: false
    });
    
    // Add OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: CONFIG.MAP_MAX_ZOOM,
        minZoom: CONFIG.MAP_MIN_ZOOM
    }).addTo(map);
    
    // Add Scale Control
    L.control.scale({ imperial: false }).addTo(map);
    
    // Add Attribution
    L.control.attribution({ prefix: false })
        .addAttribution('ระบบนำทางหน่วยงานรัฐ')
        .addTo(map);
    
    // Add Fullscreen Control
    map.addControl(new L.Control.Fullscreen());
    
    // Map Events
    map.on('click', onMapClick);
    map.on('zoomend', onMapZoom);
}

async function loadData() {
    try {
        // Try to load from localStorage first (for offline support)
        const cachedData = localStorage.getItem(CONFIG.STORAGE_KEYS.BUILDING_DATA);
        if (cachedData) {
            const data = JSON.parse(cachedData);
            buildings = data.buildings || [];
            routes = data.routes || [];
            
            // Check if cache is still valid (less than 1 day old)
            const cacheDate = new Date(data.timestamp);
            const now = new Date();
            const hoursDiff = Math.abs(now - cacheDate) / 36e5;
            
            if (hoursDiff < 24) {
                console.log('Using cached data');
                updateBuildingUI();
                return;
            }
        }
        
        // Load from JSON file
        const response = await fetch('locations.json');
        if (!response.ok) throw new Error('Failed to load data');
        
        const data = await response.json();
        buildings = data.buildings || [];
        routes = data.routes || [];
        
        // Cache the data
        const cacheData = {
            buildings: buildings,
            routes: routes,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem(CONFIG.STORAGE_KEYS.BUILDING_DATA, JSON.stringify(cacheData));
        
        updateBuildingUI();
        
    } catch (error) {
        console.error('Error loading data:', error);
        
        // Load sample data if file not found
        loadSampleData();
        showToast('โหลดข้อมูลตัวอย่าง (กรุณาแก้ไขไฟล์ locations.json)', 'warning');
    }
}

function loadSampleData() {
    // Sample buildings data
    buildings = [
        {
            id: 1,
            name: "อาคารรัฐประศาสนภักดี",
            description: "อาคารหลักสำหรับบริหารงาน",
            lat: 13.8765,
            lng: 100.5520,
            category: "อาคารหลัก",
            contact: "02-123-4001",
            opening_hours: "08:30-16:30 น.",
            services: ["บริหารงาน", "ผู้อำนวยการ", "ฝ่ายบุคคล"],
            floors: 8
        },
        {
            id: 2,
            name: "ศูนย์บริการประชาชน",
            description: "ให้บริการบัตรประชาชนและทะเบียน",
            lat: 13.8760,
            lng: 100.5515,
            category: "บริการ",
            contact: "02-123-4002",
            opening_hours: "08:30-15:30 น.",
            services: ["ทำบัตรประชาชน", "ทะเบียนราษฎร์", "ใบขับขี่"],
            floors: 3
        },
        {
            id: 3,
            name: "หอประชุมใหญ่",
            description: "สำหรับการประชุมสัมมนา",
            lat: 13.8758,
            lng: 100.5525,
            category: "หอประชุม",
            contact: "02-123-4003",
            opening_hours: "จองล่วงหน้า",
            services: ["ห้องประชุม 500 ที่นั่ง", "ระบบเสียง"],
            capacity: 500
        },
        {
            id: 6,
            name: "อาคารฝึกอบรม",
            description: "ศูนย์ฝึกอบรมและพัฒนาบุคลากร",
            lat: 13.8768,
            lng: 100.5508,
            category: "ฝึกอบรม",
            contact: "02-123-4006",
            opening_hours: "08:30-16:30 น.",
            services: ["ห้องอบรม", "ห้องสัมมนา"],
            classrooms: 10
        }
    ];
    
    // Sample routes data
    routes = [
        {
            id: "2-3",
            from: 2,
            to: 3,
            name: "ศูนย์บริการ → หอประชุม",
            distance: "180 เมตร",
            time: "4 นาที",
            image: "https://via.placeholder.com/400x200/198754/ffffff?text=เส้นทาง2-3",
            instructions: [
                "ออกจากศูนย์บริการทางประตูด้านหน้า",
                "เดินตรงไปตามทางเดิน 80 เมตร",
                "เลี้ยวขวาที่สวนน้ำพุ",
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
            image: "https://via.placeholder.com/400x200/0d6efd/ffffff?text=เส้นทาง2-6",
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
        }
    ];
    
    updateBuildingUI();
}

function initializeUI() {
    // Populate building dropdowns
    populateBuildingDropdowns();
    
    // Setup event listeners
    setupEventListeners();
    
    // Display buildings on map
    displayBuildingsOnMap();
    
    // Setup building table
    populateBuildingTable();
    
    // Check for last route
    loadLastRoute();
}

function loadUserPreferences() {
    // Load theme preference
    const savedTheme = localStorage.getItem(CONFIG.STORAGE_KEYS.THEME);
    if (savedTheme === 'dark') {
        toggleTheme();
    }
    
    // Load speech preference
    const prefs = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.USER_PREFERENCES) || '{}');
    speechEnabled = prefs.speechEnabled !== false;
    
    // Update UI based on preferences
    updateSpeechButton();
}

function checkGeolocationSupport() {
    if (!navigator.geolocation) {
        showToast('อุปกรณ์ของคุณไม่รองรับการระบุตำแหน่ง', 'warning');
    }
}

// ========== 3. MAP FUNCTIONS ==========
function displayBuildingsOnMap() {
    // Clear existing markers
    buildingMarkers.forEach(marker => map.removeLayer(marker));
    buildingMarkers = [];
    
    // Add markers for each building
    buildings.forEach(building => {
        const marker = createBuildingMarker(building);
        marker.addTo(map);
        buildingMarkers.push(marker);
    });
}

function createBuildingMarker(building) {
    // Determine marker color based on category
    let markerColor = getMarkerColor(building.category);
    
    // Create custom marker icon
    const icon = L.divIcon({
        html: `
            <div class="map-marker marker-${markerColor}" 
                 style="background-color: var(--${markerColor}-color);"
                 data-building-id="${building.id}">
                ${building.id}
            </div>
        `,
        className: `building-marker building-${building.id}`,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40]
    });
    
    // Create marker
    const marker = L.marker([building.lat, building.lng], { icon });
    
    // Create popup content
    const popupContent = createBuildingPopup(building);
    marker.bindPopup(popupContent);
    
    // Add click event
    marker.on('click', function() {
        highlightBuildingOnTable(building.id);
    });
    
    return marker;
}

function getMarkerColor(category) {
    const colorMap = {
        'อาคารหลัก': 'primary',
        'บริการ': 'success',
        'หอประชุม': 'warning',
        'ข้อมูล': 'info',
        'ฝึกอบรม': 'secondary',
        'โรงอาหาร': 'danger'
    };
    return colorMap[category] || 'dark';
}

function createBuildingPopup(building) {
    return `
        <div class="building-popup">
            <div class="popup-header">
                <h6>อาคาร ${building.id}: ${building.name}</h6>
            </div>
            <div class="popup-body">
                <p><i class="fas fa-info-circle"></i> ${building.description}</p>
                <p><i class="fas fa-phone"></i> ${building.contact || 'ไม่ระบุ'}</p>
                <p><i class="fas fa-clock"></i> ${building.opening_hours || 'ไม่ระบุ'}</p>
                
                ${building.services ? `
                    <p><strong>บริการ:</strong> ${building.services.join(', ')}</p>
                ` : ''}
                
                <div class="popup-actions mt-2">
                    <button class="btn btn-sm btn-primary w-100 mb-1" 
                            onclick="setBuildingAsStart(${building.id})">
                        <i class="fas fa-play me-1"></i>เป็นจุดเริ่มต้น
                    </button>
                    <button class="btn btn-sm btn-success w-100" 
                            onclick="setBuildingAsDestination(${building.id})">
                        <i class="fas fa-flag me-1"></i>เป็นจุดหมาย
                    </button>
                </div>
            </div>
        </div>
    `;
}

function onMapClick(e) {
    // Future: Add custom point functionality
    console.log('Map clicked at:', e.latlng);
}

function onMapZoom(e) {
    // Future: Adjust marker sizes based on zoom level
}

function showRouteOnMap(fromBuilding, toBuilding) {
    // Clear existing route
    if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
    }
    
    // Create polyline between buildings
    const latlngs = [
        [fromBuilding.lat, fromBuilding.lng],
        [toBuilding.lat, toBuilding.lng]
    ];
    
    routeLine = L.polyline(latlngs, {
        color: '#198754',
        weight: 4,
        opacity: 0.7,
        dashArray: '10, 10',
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(map);
    
    // Fit map to show both buildings
    const bounds = L.latLngBounds(latlngs);
    map.fitBounds(bounds, { padding: [50, 50] });
    
    // Add popup to route
    routeLine.bindPopup(`
        <div class="route-popup">
            <h6>เส้นทางนำทาง</h6>
            <p>จาก: ${fromBuilding.name}</p>
            <p>ไปยัง: ${toBuilding.name}</p>
            <button class="btn btn-sm btn-success w-100 mt-2" onclick="startNavigation()">
                <i class="fas fa-play me-1"></i>เริ่มนำทาง
            </button>
        </div>
    `).openPopup();
}

function clearMapRoute() {
    if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
    }
}

// ========== 4. BUILDING MANAGEMENT ==========
function populateBuildingDropdowns() {
    if (!domCache.fromBuilding || !domCache.toBuilding) return;
    
    // Clear existing options (keep first option)
    domCache.fromBuilding.innerHTML = '<option value="">-- เลือกอาคารเริ่มต้น --</option>';
    domCache.toBuilding.innerHTML = '<option value="">-- เลือกอาคารปลายทาง --</option>';
    
    // Add building options
    buildings.forEach(building => {
        const option1 = document.createElement('option');
        option1.value = building.id;
        option1.textContent = `อาคาร ${building.id}: ${building.name}`;
        domCache.fromBuilding.appendChild(option1);
        
        const option2 = document.createElement('option');
        option2.value = building.id;
        option2.textContent = `อาคาร ${building.id}: ${building.name}`;
        domCache.toBuilding.appendChild(option2);
    });
}

function populateBuildingTable() {
    if (!domCache.buildingTable) return;
    
    domCache.buildingTable.innerHTML = '';
    domCache.buildingCount.textContent = buildings.length;
    
    buildings.forEach(building => {
        const row = document.createElement('tr');
        row.id = `building-row-${building.id}`;
        row.className = 'fade-in';
        
        row.innerHTML = `
            <td>
                <div class="building-number">${building.id}</div>
            </td>
            <td>
                <div class="fw-bold">${building.name}</div>
                <small class="text-muted">${building.description}</small>
            </td>
            <td>
                <span class="badge bg-${getMarkerColor(building.category)}">
                    ${building.category}
                </span>
            </td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" 
                            onclick="setBuildingAsStart(${building.id})"
                            title="ตั้งเป็นจุดเริ่มต้น">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="btn btn-outline-success" 
                            onclick="setBuildingAsDestination(${building.id})"
                            title="ตั้งเป็นจุดหมาย">
                        <i class="fas fa-flag"></i>
                    </button>
                </div>
            </td>
        `;
        
        domCache.buildingTable.appendChild(row);
    });
}

function highlightBuildingOnTable(buildingId) {
    // Remove highlight from all rows
    document.querySelectorAll('#buildingTable tr').forEach(row => {
        row.classList.remove('selected');
    });
    
    // Highlight selected row
    const selectedRow = document.getElementById(`building-row-${buildingId}`);
    if (selectedRow) {
        selectedRow.classList.add('selected');
        selectedRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function updateBuildingUI() {
    populateBuildingDropdowns();
    populateBuildingTable();
    displayBuildingsOnMap();
}

// ========== 5. ROUTE MANAGEMENT ==========
function updateRouteSelection() {
    const fromId = parseInt(domCache.fromBuilding.value);
    const toId = parseInt(domCache.toBuilding.value);
    
    // Update destination dropdown to exclude selected start building
    updateDestinationOptions(fromId);
    
    if (fromId && toId) {
        updateRouteInfo();
    } else {
        hideRouteInfo();
    }
}

function updateDestinationOptions(excludedId) {
    if (!domCache.toBuilding) return;
    
    const options = domCache.toBuilding.options;
    for (let i = 0; i < options.length; i++) {
        const option = options[i];
        if (option.value == excludedId) {
            option.disabled = true;
            option.style.display = 'none';
        } else {
            option.disabled = false;
            option.style.display = '';
        }
    }
    
    // Select first enabled option
    for (let i = 0; i < options.length; i++) {
        if (!options[i].disabled && options[i].value) {
            domCache.toBuilding.value = options[i].value;
            break;
        }
    }
}

function updateRouteInfo() {
    const fromId = parseInt(domCache.fromBuilding.value);
    const toId = parseInt(domCache.toBuilding.value);
    
    if (!fromId || !toId) {
        hideRouteInfo();
        return;
    }
    
    const fromBuilding = buildings.find(b => b.id === fromId);
    const toBuilding = buildings.find(b => b.id === toId);
    
    if (!fromBuilding || !toBuilding) {
        hideRouteInfo();
        return;
    }
    
    // Find route
    currentRoute = findRoute(fromId, toId);
    
    if (!currentRoute) {
        hideRouteInfo();
        showToast('ยังไม่มีข้อมูลเส้นทางนี้', 'warning');
        return;
    }
    
    // Update route info display
    domCache.routeInfo.classList.remove('d-none');
    domCache.routeName.textContent = currentRoute.name;
    domCache.routeDistance.textContent = currentRoute.distance;
    domCache.routeTime.textContent = currentRoute.time;
    domCache.routeSteps.textContent = `${currentRoute.instructions.length} ขั้น`;
    domCache.routeDescText.textContent = currentRoute.notes || 'เส้นทางแนะนำภายในหน่วยงาน';
    
    // Enable buttons
    domCache.previewBtn.disabled = false;
    domCache.startNavBtn.disabled = false;
    
    // Save as last route
    saveLastRoute(fromId, toId);
}

function findRoute(fromId, toId) {
    // Try to find direct route
    let route = routes.find(r => 
        (r.from === fromId && r.to === toId) || 
        (r.from === toId && r.to === fromId)
    );
    
    if (route) return route;
    
    // If no direct route, create a generic one
    const fromBuilding = buildings.find(b => b.id === fromId);
    const toBuilding = buildings.find(b => b.id === toId);
    
    if (!fromBuilding || !toBuilding) return null;
    
    // Calculate approximate distance
    const distance = calculateDistance(
        fromBuilding.lat, fromBuilding.lng,
        toBuilding.lat, toBuilding.lng
    );
    
    // Create generic route
    return {
        id: `${fromId}-${toId}`,
        from: fromId,
        to: toId,
        name: `${fromBuilding.name} → ${toBuilding.name}`,
        distance: `${Math.round(distance)} เมตร`,
        time: `${Math.round(distance / (CONFIG.WALKING_SPEED * 60))} นาที`,
        image: "https://via.placeholder.com/400x200/6c757d/ffffff?text=เส้นทางสำรวจเพิ่มเติม",
        instructions: [
            `ออกจาก ${fromBuilding.name}`,
            "เดินตามทางเดินหลัก",
            `ไปยัง ${toBuilding.name}`,
            "คำแนะนำเพิ่มเติมต้องสำรวจเส้นทางจริง"
        ],
        landmarks: "ต้องสำรวจจุดสังเกตเพิ่มเติม",
        accessibility: "ไม่ทราบสภาพเส้นทาง",
        notes: "กรุณาติดต่อเจ้าหน้าที่เพื่อสำรวจเส้นทางนี้"
    };
}

function hideRouteInfo() {
    domCache.routeInfo.classList.add('d-none');
    domCache.previewBtn.disabled = true;
    domCache.startNavBtn.disabled = true;
    currentRoute = null;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Radius of Earth in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
}

function saveLastRoute(fromId, toId) {
    const lastRoute = { fromId, toId, timestamp: new Date().toISOString() };
    localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_ROUTE, JSON.stringify(lastRoute));
}

function loadLastRoute() {
    const lastRouteJson = localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_ROUTE);
    if (!lastRouteJson) return;
    
    try {
        const lastRoute = JSON.parse(lastRouteJson);
        const fromBuilding = buildings.find(b => b.id === lastRoute.fromId);
        const toBuilding = buildings.find(b => b.id === lastRoute.toId);
        
        if (fromBuilding && toBuilding) {
            domCache.fromBuilding.value = lastRoute.fromId;
            domCache.toBuilding.value = lastRoute.toId;
            updateRouteSelection();
            updateRouteInfo();
        }
    } catch (error) {
        console.error('Error loading last route:', error);
    }
}

// ========== 6. NAVIGATION FUNCTIONS ==========
function startNavigation() {
    if (!currentRoute) {
        showToast('กรุณาเลือกเส้นทางก่อน', 'warning');
        return;
    }
    
    // Get buildings
    const fromBuilding = buildings.find(b => b.id === currentRoute.from);
    const toBuilding = buildings.find(b => b.id === currentRoute.to);
    
    if (!fromBuilding || !toBuilding) {
        showToast('ไม่พบข้อมูลอาคาร', 'danger');
        return;
    }
    
    // Reset navigation state
    currentStep = 0;
    userPath = [];
    
    // Show navigation panel
    showNavigationPanel();
    
    // Update navigation panel
    updateNavigationPanel(fromBuilding, toBuilding);
    
    // Show route on map
    showRouteOnMap(fromBuilding, toBuilding);
    
    // Start with first step
    showStep(0);
    
    // Speak first instruction if enabled
    if (speechEnabled) {
        speakInstruction();
    }
    
    // Show success message
    showToast('เริ่มระบบนำทางเรียบร้อยแล้ว', 'success');
}

function showNavigationPanel() {
    domCache.navigationPanel.classList.remove('d-none');
    domCache.navigationPanel.classList.add('show');
    
    // Scroll to navigation panel
    setTimeout(() => {
        domCache.navigationPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
}

function updateNavigationPanel(fromBuilding, toBuilding) {
    domCache.navTitle.textContent = currentRoute.name;
    domCache.navSubtitle.textContent = `${fromBuilding.name} → ${toBuilding.name}`;
    
    // Update real-time stats if tracking
    if (isRealtimeTracking) {
        domCache.realtimeStats.classList.remove('d-none');
    } else {
        domCache.realtimeStats.classList.add('d-none');
    }
}

function showStep(stepIndex) {
    if (!currentRoute || !currentRoute.instructions) return;
    
    const instructions = currentRoute.instructions;
    
    // Validate step index
    if (stepIndex < 0 || stepIndex >= instructions.length) {
        return;
    }
    
    currentStep = stepIndex;
    
    // Update step display
    domCache.currentStepText.textContent = `ขั้นตอนที่ ${stepIndex + 1}/${instructions.length}`;
    domCache.stepDistance.textContent = currentRoute.distance;
    
    // Update progress
    const progressPercent = ((stepIndex + 1) / instructions.length) * 100;
    domCache.stepProgress.style.width = `${progressPercent}%`;
    
    // Update instruction
    domCache.instructionText.textContent = instructions[stepIndex];
    
    // Update image (show different images for different steps if available)
    if (currentRoute.image) {
        domCache.stepImage.src = currentRoute.image;
        domCache.imageCaption.textContent = `ภาพประกอบขั้นตอนที่ ${stepIndex + 1}`;
    }
    
    // Update landmarks (show only for first step)
    if (stepIndex === 0 && currentRoute.landmarks) {
        domCache.landmarksText.textContent = currentRoute.landmarks;
    } else {
        domCache.landmarksText.textContent = '-';
    }
    
    // Update accessibility info
    if (currentRoute.accessibility) {
        domCache.accessibilityText.textContent = currentRoute.accessibility;
    }
    
    // Update button states
    domCache.prevBtn.disabled = stepIndex === 0;
    domCache.nextBtn.disabled = stepIndex === instructions.length - 1;
    
    // Update real-time button
    updateRealtimeButton();
}

function nextStep() {
    if (!currentRoute || !currentRoute.instructions) return;
    
    if (currentStep < currentRoute.instructions.length - 1) {
        showStep(currentStep + 1);
        
        // Speak instruction if enabled
        if (speechEnabled) {
            speakInstruction();
        }
    } else {
        // Reached destination
        showDestinationReached();
    }
}

function previousStep() {
    if (currentStep > 0) {
        showStep(currentStep - 1);
        
        // Speak instruction if enabled
        if (speechEnabled) {
            speakInstruction();
        }
    }
}

function showDestinationReached() {
    domCache.instructionText.innerHTML = `
        <div class="text-center text-success">
            <i class="fas fa-check-circle fa-2x mb-2"></i>
            <h6 class="mb-1">ถึงจุดหมายแล้ว!</h6>
            <p class="mb-0 small">คุณมาถึงปลายทางเรียบร้อยแล้ว</p>
        </div>
    `;
    
    domCache.stepImage.src = "https://via.placeholder.com/400x200/198754/ffffff?text=ถึงจุดหมายแล้ว!";
    domCache.imageCaption.textContent = "ปลายทางถึงแล้ว";
    
    domCache.nextBtn.disabled = true;
    
    // Speak destination reached
    if (speechEnabled) {
        speakText("ถึงจุดหมายแล้ว คุณมาถึงปลายทางเรียบร้อยแล้ว");
    }
    
    // Stop real-time tracking if active
    if (isRealtimeTracking) {
        stopRealtimeTracking();
    }
    
    showToast('ถึงจุดหมายปลายทางเรียบร้อยแล้ว', 'success');
}

function stopNavigation() {
    // Hide navigation panel
    domCache.navigationPanel.classList.remove('show');
    setTimeout(() => {
        domCache.navigationPanel.classList.add('d-none');
    }, 300);
    
    // Clear current route
    currentRoute = null;
    currentStep = 0;
    
    // Clear map route
    clearMapRoute();
    
    // Stop real-time tracking
    if (isRealtimeTracking) {
        stopRealtimeTracking();
    }
    
    // Clear user path
    userPath = [];
    
    // Reset user marker if exists
    if (userMarker) {
        map.removeLayer(userMarker);
        userMarker = null;
    }
    
    showToast('หยุดการนำทางเรียบร้อยแล้ว', 'info');
}

// ========== 7. REAL-TIME TRACKING ==========
function toggleRealtimeTracking() {
    if (isRealtimeTracking) {
        stopRealtimeTracking();
    } else {
        startRealtimeTracking();
    }
}

function startRealtimeTracking() {
    if (!navigator.geolocation) {
        showToast('อุปกรณ์ของคุณไม่รองรับ GPS', 'warning');
        return;
    }
    
    if (!currentRoute) {
        showToast('กรุณาเริ่มนำทางก่อน', 'warning');
        return;
    }
    
    // Request permission
    navigator.permissions.query({ name: 'geolocation' }).then(permissionStatus => {
        if (permissionStatus.state === 'denied') {
            showToast('โปรดอนุญาตการเข้าถึงตำแหน่งในเบราว์เซอร์', 'warning');
            return;
        }
        
        // Start watching position
        realtimeWatchId = navigator.geolocation.watchPosition(
            updateUserPosition,
            handleGeolocationError,
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
        
        isRealtimeTracking = true;
        updateRealtimeButton();
        domCache.realtimeStats.classList.remove('d-none');
        
        showToast('เริ่มติดตามตำแหน่งเรียลไทม์แล้ว', 'success');
        
    }).catch(error => {
        console.error('Geolocation permission error:', error);
        showToast('ไม่สามารถขออนุญาตตำแหน่งได้', 'danger');
    });
}

function stopRealtimeTracking() {
    if (realtimeWatchId) {
        navigator.geolocation.clearWatch(realtimeWatchId);
        realtimeWatchId = null;
    }
    
    isRealtimeTracking = false;
    updateRealtimeButton();
    domCache.realtimeStats.classList.add('d-none');
    
    // Clear accuracy circle if exists
    if (window.accuracyCircle) {
        map.removeLayer(window.accuracyCircle);
        window.accuracyCircle = null;
    }
    
    showToast('หยุดติดตามตำแหน่งเรียลไทม์แล้ว', 'info');
}

function updateUserPosition(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy;
    const heading = position.coords.heading;
    const speed = position.coords.speed;
    
    // Update user marker
    updateUserMarker(lat, lng);
    
    // Add to user path
    userPath.push([lat, lng]);
    
    // Update accuracy circle
    updateAccuracyCircle(lat, lng, accuracy);
    
    // Update real-time stats
    updateRealtimeStats(position);
    
    // Check if close to destination for auto-next
    if (currentRoute) {
        const toBuilding = buildings.find(b => b.id === currentRoute.to);
        if (toBuilding) {
            const distanceToTarget = calculateDistance(lat, lng, toBuilding.lat, toBuilding.lng);
            
            if (distanceToTarget < CONFIG.AUTO_NEXT_DISTANCE && 
                currentStep < currentRoute.instructions.length - 1) {
                nextStep();
            }
        }
    }
    
    // Center map on user (optional)
    // map.setView([lat, lng], map.getZoom());
}

function updateUserMarker(lat, lng) {
    if (!userMarker) {
        // Create user marker
        const userIcon = L.divIcon({
            html: `
                <div class="user-marker">
                    <div class="pulse"></div>
                    <div class="dot"></div>
                </div>
            `,
            className: 'user-marker-icon',
            iconSize: [40, 40],
            iconAnchor: [20, 40]
        });
        
        userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(map);
    } else {
        // Update existing marker position
        userMarker.setLatLng([lat, lng]);
    }
    
    // Draw user path
    drawUserPath();
}

function drawUserPath() {
    // Clear existing path if too long
    if (userPath.length > 100) {
        userPath.shift();
    }
    
    // Draw path
    if (userPath.length > 1) {
        if (window.userPathLine) {
            map.removeLayer(window.userPathLine);
        }
        
        window.userPathLine = L.polyline(userPath, {
            color: '#0d6efd',
            weight: 3,
            opacity: 0.7,
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(map);
    }
}

function updateAccuracyCircle(lat, lng, accuracy) {
    // Clear existing circle
    if (window.accuracyCircle) {
        map.removeLayer(window.accuracyCircle);
    }
    
    // Create new accuracy circle
    window.accuracyCircle = L.circle([lat, lng], {
        radius: accuracy,
        color: 'rgba(13, 110, 253, 0.3)',
        fillColor: 'rgba(13, 110, 253, 0.1)',
        fillOpacity: 0.2,
        weight: 1
    }).addTo(map);
}

function updateRealtimeStats(position) {
    if (!currentRoute) return;
    
    const toBuilding = buildings.find(b => b.id === currentRoute.to);
    if (!toBuilding) return;
    
    // Calculate remaining distance
    const remainingDist = calculateDistance(
        position.coords.latitude,
        position.coords.longitude,
        toBuilding.lat,
        toBuilding.lng
    );
    
    domCache.remainingDistance.textContent = `${Math.round(remainingDist)} ม.`;
    
    // Calculate remaining time
    const remainingTime = Math.round(remainingDist / (CONFIG.WALKING_SPEED * 60));
    domCache.remainingTime.textContent = `${remainingTime} นาที`;
    
    // Update speed if available
    if (position.coords.speed !== null) {
        const speedKmh = Math.round(position.coords.speed * 3.6);
        domCache.currentSpeed.textContent = speedKmh;
    }
}

function handleGeolocationError(error) {
    let message = 'GPS Error: ';
    
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = 'ไม่ได้อนุญาตให้เข้าถึงตำแหน่ง';
            break;
        case error.POSITION_UNAVAILABLE:
            message = 'ไม่สามารถรับข้อมูลตำแหน่งได้';
            break;
        case error.TIMEOUT:
            message = 'ขอข้อมูลตำแหน่งนานเกินไป';
            break;
        default:
            message = 'เกิดข้อผิดพลาดกับ GPS';
            break;
    }
    
    showToast(message, 'warning');
    stopRealtimeTracking();
}

function updateRealtimeButton() {
    if (!domCache.realtimeBtn) return;
    
    if (isRealtimeTracking) {
        domCache.realtimeBtn.innerHTML = '<i class="fas fa-satellite-dish"></i>';
        domCache.realtimeBtn.classList.remove('btn-outline-info');
        domCache.realtimeBtn.classList.add('btn-danger');
        domCache.realtimeBtn.title = 'หยุดติดตามตำแหน่ง';
    } else {
        domCache.realtimeBtn.innerHTML = '<i class="fas fa-satellite"></i>';
        domCache.realtimeBtn.classList.remove('btn-danger');
        domCache.realtimeBtn.classList.add('btn-outline-info');
        domCache.realtimeBtn.title = 'ติดตามตำแหน่งเรียลไทม์';
    }
}

// ========== 8. SPEECH FUNCTIONS ==========
function speakInstruction() {
    if (!speechEnabled || !currentRoute || !currentRoute.instructions) return;
    
    const text = currentRoute.instructions[currentStep];
    speakText(text);
}

function speakText(text) {
    if (!('speechSynthesis' in window)) {
        console.warn('Speech synthesis not supported');
        return;
    }
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    // Create utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'th-TH';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Speak
    window.speechSynthesis.speak(utterance);
}

function toggleSpeech() {
    speechEnabled = !speechEnabled;
    
    // Save preference
    const prefs = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.USER_PREFERENCES) || '{}');
    prefs.speechEnabled = speechEnabled;
    localStorage.setItem(CONFIG.STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(prefs));
    
    updateSpeechButton();
    
    showToast(speechEnabled ? 'เปิดใช้งานเสียงแล้ว' : 'ปิดใช้งานเสียงแล้ว', 'info');
}

function updateSpeechButton() {
    if (!domCache.speakBtn) return;
    
    if (speechEnabled) {
        domCache.speakBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
        domCache.speakBtn.title = 'ปิดเสียงคำแนะนำ';
    } else {
        domCache.speakBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
        domCache.speakBtn.title = 'เปิดเสียงคำแนะนำ';
    }
}

// ========== 9. UI HELPER FUNCTIONS ==========
function showLoading(show) {
    if (!domCache.loadingOverlay) return;
    
    if (show) {
        domCache.loadingOverlay.style.display = 'flex';
    } else {
        setTimeout(() => {
            domCache.loadingOverlay.style.display = 'none';
        }, 300);
    }
}

function showToast(message, type = 'info') {
    const toastEl = document.getElementById('liveToast');
    const toastMessage = document.getElementById('toastMessage');
    
    if (!toastEl || !toastMessage) return;
    
    // Update message
    toastMessage.textContent = message;
    
    // Update toast class based on type
    const toast = new bootstrap.Toast(toastEl);
    
    // Change background based on type
    const toastHeader = toastEl.querySelector('.toast-header');
    if (toastHeader) {
        const bgClass = {
            'success': 'bg-success text-white',
            'danger': 'bg-danger text-white',
            'warning': 'bg-warning text-dark',
            'info': 'bg-info text-white'
        }[type] || 'bg-primary text-white';
        
        toastHeader.className = `toast-header ${bgClass}`;
    }
    
    // Show toast
    toast.show();
}

function toggleTheme() {
    darkMode = !darkMode;
    document.body.classList.toggle('dark-mode', darkMode);
    
    // Save preference
    localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, darkMode ? 'dark' : 'light');
    
    showToast(darkMode ? 'เปลี่ยนเป็นโหมดกลางคืน' : 'เปลี่ยนเป็นโหมดปกติ', 'info');
}

function showAbout() {
    const aboutModal = new bootstrap.Modal(document.getElementById('aboutModal'));
    aboutModal.show();
}

// ========== 10. EVENT LISTENERS SETUP ==========
function setupEventListeners() {
    // Route selection events
    if (domCache.fromBuilding) {
        domCache.fromBuilding.addEventListener('change', updateRouteSelection);
    }
    
    if (domCache.toBuilding) {
        domCache.toBuilding.addEventListener('change', updateRouteInfo);
    }
    
    // Button events
    if (domCache.previewBtn) {
        domCache.previewBtn.addEventListener('click', showRoutePreview);
    }
    
    if (domCache.startNavBtn) {
        domCache.startNavBtn.addEventListener('click', startNavigation);
    }
    
    if (domCache.prevBtn) {
        domCache.prevBtn.addEventListener('click', previousStep);
    }
    
    if (domCache.nextBtn) {
        domCache.nextBtn.addEventListener('click', nextStep);
    }
    
    if (domCache.speakBtn) {
        domCache.speakBtn.addEventListener('click', toggleSpeech);
    }
    
    if (domCache.realtimeBtn) {
        domCache.realtimeBtn.addEventListener('click', toggleRealtimeTracking);
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Online/offline detection
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOfflineStatus);
    
    // Before unload
    window.addEventListener('beforeunload', handleBeforeUnload);
}

function handleKeyboardShortcuts(e) {
    // Only handle if not in input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
        return;
    }
    
    switch(e.key) {
        case 'ArrowRight':
            if (!e.ctrlKey && !e.altKey) {
                e.preventDefault();
                nextStep();
            }
            break;
            
        case 'ArrowLeft':
            if (!e.ctrlKey && !e.altKey) {
                e.preventDefault();
                previousStep();
            }
            break;
            
        case ' ':
            if (!e.ctrlKey && !e.altKey) {
                e.preventDefault();
                speakInstruction();
            }
            break;
            
        case 'Escape':
            if (currentRoute) {
                e.preventDefault();
                stopNavigation();
            }
            break;
    }
}

function handleOnlineStatus() {
    showToast('เชื่อมต่ออินเทอร์เน็ตแล้ว', 'success');
}

function handleOfflineStatus() {
    showToast('กำลังทำงานแบบออฟไลน์', 'warning');
}

function handleBeforeUnload(e) {
    if (isRealtimeTracking) {
        // Stop tracking before leaving
        stopRealtimeTracking();
    }
    
    // Optional: Save current state
    // saveCurrentState();
}

// ========== 11. UTILITY FUNCTIONS ==========
function showRoutePreview() {
    const fromId = parseInt(domCache.fromBuilding.value);
    const toId = parseInt(domCache.toBuilding.value);
    
    if (!fromId || !toId) {
        showToast('กรุณาเลือกเส้นทางก่อน', 'warning');
        return;
    }
    
    const fromBuilding = buildings.find(b => b.id === fromId);
    const toBuilding = buildings.find(b => b.id === toId);
    
    if (!fromBuilding || !toBuilding) {
        showToast('ไม่พบข้อมูลอาคาร', 'danger');
        return;
    }
    
    showRouteOnMap(fromBuilding, toBuilding);
    showToast('แสดงเส้นทางบนแผนที่เรียบร้อยแล้ว', 'info');
}

function useMyLocationAsStart() {
    if (!navigator.geolocation) {
        showToast('อุปกรณ์ไม่รองรับการระบุตำแหน่ง', 'warning');
        return;
    }
    
    showLoading(true);
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            // Find nearest building
            const nearestBuilding = findNearestBuilding(lat, lng);
            
            if (nearestBuilding) {
                setBuildingAsStart(nearestBuilding.id);
                showToast(`ตั้งอาคาร ${nearestBuilding.name} เป็นจุดเริ่มต้น`, 'success');
            } else {
                showToast('ไม่พบอาคารใกล้เคียง', 'warning');
            }
            
            showLoading(false);
        },
        (error) => {
            console.error('Geolocation error:', error);
            showToast('ไม่สามารถระบุตำแหน่งได้', 'danger');
            showLoading(false);
        },
        { timeout: 10000 }
    );
}

function findNearestBuilding(lat, lng) {
    let nearestBuilding = null;
    let minDistance = Infinity;
    
    buildings.forEach(building => {
        const distance = calculateDistance(lat, lng, building.lat, building.lng);
        if (distance < minDistance) {
            minDistance = distance;
            nearestBuilding = building;
        }
    });
    
    return nearestBuilding;
}

function swapBuildings() {
    const fromValue = domCache.fromBuilding.value;
    const toValue = domCache.toBuilding.value;
    
    if (!fromValue || !toValue) {
        showToast('กรุณาเลือกทั้งจุดเริ่มต้นและจุดหมาย', 'warning');
        return;
    }
    
    // Swap values
    domCache.fromBuilding.value = toValue;
    domCache.toBuilding.value = fromValue;
    
    // Update UI
    updateRouteSelection();
    updateRouteInfo();
    
    showToast('สลับจุดเริ่มต้นและจุดหมายเรียบร้อยแล้ว', 'info');
}

function setBuildingAsStart(buildingId) {
    domCache.fromBuilding.value = buildingId;
    updateRouteSelection();
    highlightBuildingOnTable(buildingId);
}

function setBuildingAsDestination(buildingId) {
    domCache.toBuilding.value = buildingId;
    updateRouteInfo();
    highlightBuildingOnTable(buildingId);
}

// ========== 12. GLOBAL FUNCTIONS (for HTML onclick) ==========
// These functions need to be globally accessible for HTML onclick attributes
window.showAbout = showAbout;
window.toggleTheme = toggleTheme;
window.useMyLocationAsStart = useMyLocationAsStart;
window.swapBuildings = swapBuildings;
window.setBuildingAsStart = setBuildingAsStart;
window.setBuildingAsDestination = setBuildingAsDestination;
window.showRoutePreview = showRoutePreview;
window.startNavigation = startNavigation;
window.previousStep = previousStep;
window.nextStep = nextStep;
window.speakInstruction = speakInstruction;
window.toggleRealtimeTracking = toggleRealtimeTracking;
window.stopNavigation = stopNavigation;

// ========== 13. SERVICE WORKER REGISTRATION ==========
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('ServiceWorker registered:', registration);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
    });
}

// ========== 14. PWA INSTALL PROMPT ==========
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    
    // Show install button (optional)
    // showInstallPromotion();
});

function installPWA() {
    if (deferredPrompt) {
        // Show the install prompt
        deferredPrompt.prompt();
        
        // Wait for the user to respond to the prompt
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            } else {
                console.log('User dismissed the install prompt');
            }
            deferredPrompt = null;
        });
    }
}

// ========== 15. INITIALIZATION COMPLETE ==========
console.log('ระบบนำทางหน่วยงานรัฐ - Initialized successfully');
