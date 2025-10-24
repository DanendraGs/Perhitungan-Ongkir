// Inisialisasi peta Leaflet
const map = L.map('map').setView([-6.2088, 106.8456], 10);

// Tambahkan tile layer OpenStreetMap ke peta
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Variabel untuk menyimpan marker, rute, dan hasil pencarian
let startMarker, endMarker, routePolyline;
let searchResultsList = []; 

// KOORDINAT RUMAH ANDA (Lat, Lon)
const homeCoords = [-6.242476645426871, 107.07192446114526];

// --- (Logika Harga) ---
const BASE_FEE = 20000; // Biaya Dasar Panggilan (Rp 20.000)
const COST_PER_KM_ROUND_TRIP = 1800; // Biaya per KM Pulang Pergi (Rp 1.800)
// --- (Selesai) ---

// Ambil elemen-elemen DOM
const toInput = document.getElementById('to-input');
const calcButton = document.getElementById('calc-button');
const resultDiv = document.getElementById('result');
const locationButton = document.getElementById('location-button');

/**
 * Fungsi Geocoding (Nama Lokasi -> Daftar Koordinat)
 */
async function searchLocations(locationName) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json&limit=5`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error geocoding:", error);
        return [];
    }
}

/**
 * Fungsi Reverse Geocoding (Koordinat -> Nama Lokasi)
 */
async function reverseGeocode(coords) {
    try {
        const [lat, lon] = coords;
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
        const data = await response.json();
        if (data && data.display_name) return data.display_name;
        return "Titik di Peta";
    } catch (error) {
        console.error("Error reverse geocoding:", error);
        return "Titik di Peta";
    }
}

/**
 * Fungsi Routing (Koordinat A -> Koordinat B)
 */
async function getRoute(fromCoords, toCoords) {
    try {
        const fromLonLat = `${fromCoords[1]},${fromCoords[0]}`;
        const toLonLat = `${toCoords[1]},${toCoords[0]}`;
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${fromLonLat};${toLonLat}?overview=full&geometries=geojson`);
        const data = await response.json();
        if (data.code !== 'Ok') throw new Error('Tidak dapat menemukan rute.');
        return data.routes[0]; 
    } catch (error) {
        console.error("Error routing:", error);
        return null;
    }
}

/**
 * (REVISI LOGIKA PEMBULATAN)
 * Fungsi inti untuk menghitung dan menggambar rute + ongkir
 */
async function calculateAndDrawRoute(fromCoords, toCoords, destinationName) {
    resultDiv.innerHTML = "Menghitung rute...";
    const route = await getRoute(fromCoords, toCoords);

    if (!route) {
        resultDiv.innerHTML = "Gagal menghitung rute. Titik mungkin tidak terjangkau.";
        return;
    }

    // --- (PERUBAHAN LOGIKA PERHITUNGAN) ---
    const distanceInKm = route.distance / 1000; // Jarak sekali jalan
    const duration = (route.duration / 60).toFixed(0); // Waktu sekali jalan
    const roundTripDistance = distanceInKm * 2;
    const distanceCost = roundTripDistance * COST_PER_KM_ROUND_TRIP;

    // 1. Hitung Subtotal (biaya sebelum pembulatan)
    const subtotalCost = BASE_FEE + distanceCost;

    // 2. (BARU) Bulatkan total biaya ke ribuan terdekat
    const totalCost = Math.round(subtotalCost / 1000) * 1000;
    
    // 3. Format angka untuk ditampilkan
    const formattedDistance = distanceInKm.toFixed(2);
    const formattedBaseFee = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(BASE_FEE);
    const formattedDistanceCost = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(distanceCost);
    // (BARU) Format subtotal
    const formattedSubtotal = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(subtotalCost);
    // Format total yang sudah dibulatkan
    const formattedCost = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalCost);

    // 4. (BARU) Tampilkan hasil dengan rincian subtotal
    resultDiv.innerHTML = `
        <strong>Jarak (Sekali Jalan):</strong> ${formattedDistance} km<br>
        <strong>Perkiraan Waktu (Sekali Jalan):</strong> ${duration} menit<br>
        <div class="cost-breakdown">
            <strong>Biaya Dasar:</strong> ${formattedBaseFee}<br>
            <strong>Biaya Jarak (${roundTripDistance.toFixed(2)} km PP):</strong> ${formattedDistanceCost}<br>
            <strong>Subtotal:</strong> ${formattedSubtotal}
        </div>
        <strong class="price-label">Total Ongkir (Dibulatkan):</strong>
        <span class="price-value">${formattedCost}</span>
    `;
    // --- (SELESAI PERUBAHAN) ---

    // Hapus marker dan rute lama
    if (startMarker) map.removeLayer(startMarker);
    if (endMarker) map.removeLayer(endMarker);
    if (routePolyline) map.removeLayer(routePolyline);

    // Tambahkan marker baru
    startMarker = L.marker(fromCoords).addTo(map).bindPopup(`<b>Dari:</b> Rumah Anda`);
    endMarker = L.marker(toCoords).addTo(map).bindPopup(`<b>Ke:</b> ${destinationName}`).openPopup();

    // Gambar rute di peta
    const routeCoordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
    routePolyline = L.polyline(routeCoordinates, {color: 'blue'}).addTo(map);
    map.fitBounds(routePolyline.getBounds());
}

/**
 * Fungsi yang menangani klik tombol "Hitung"
 * (Tidak berubah)
 */
async function handleSearch() {
    const toLocation = toInput.value;
    if (!toLocation) {
        resultDiv.innerHTML = "Harap isi lokasi tujuan di kotak pencarian.";
        return;
    }
    
    resultDiv.innerHTML = "Mencari lokasi...";
    
    const results = await searchLocations(toLocation);
    searchResultsList = results; 

    if (!results || results.length === 0) {
        resultDiv.innerHTML = "Lokasi tujuan tidak ditemukan. Coba kata kunci lain.";
        return;
    }

    if (results.length === 1) {
        const result = results[0];
        const toCoords = [result.lat, result.lon];
        await calculateAndDrawRoute(homeCoords, toCoords, result.display_name);
        return;
    }

    let optionsHtml = "<strong>Kami menemukan beberapa lokasi. Silakan pilih:</strong>";
    results.forEach((result, index) => {
        optionsHtml += `
            <button class="location-option" data-index="${index}">
                ${result.display_name}
            </button>
        `;
    });
    resultDiv.innerHTML = optionsHtml;
}

/**
 * Event listener untuk menangani klik pada tombol pilihan
 * (Tidak berubah)
 */
resultDiv.addEventListener('click', async function(e) {
    if (e.target && e.target.classList.contains('location-option')) {
        const index = e.target.dataset.index;
        const selectedResult = searchResultsList[index]; 
        
        if (selectedResult) {
            const toCoords = [selectedResult.lat, selectedResult.lon];
            toInput.value = selectedResult.display_name; 
            await calculateAndDrawRoute(homeCoords, toCoords, selectedResult.display_name);
        }
    }
});


/**
 * Fungsi yang menangani klik tombol "Lokasi Saya 📍"
 * (Tidak berubah)
 */
async function handleGetLocation() {
    if (!navigator.geolocation) {
        resultDiv.innerHTML = "Browser Anda tidak mendukung Geolocation.";
        return;
    }
    resultDiv.innerHTML = "Meminta lokasi Anda...";
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const toCoords = [position.coords.latitude, position.coords.longitude];
            resultDiv.innerHTML = "Mencari nama alamat...";
            const locationName = await reverseGeocode(toCoords);
            toInput.value = locationName;
            await calculateAndDrawRoute(homeCoords, toCoords, locationName);
        },
        (error) => {
            if (error.code === error.PERMISSION_DENIED) {
                resultDiv.innerHTML = "Anda menolak izin lokasi. Izinkan di pengaturan browser Anda.";
            } else {
                resultDiv.innerHTML = "Gagal mendapatkan lokasi Anda.";
            }
        }
    );
}

// Tambahkan event listener ke tombol Hitung
calcButton.addEventListener('click', handleSearch);

// Tambahkan event listener ke tombol Lokasi Saya
locationButton.addEventListener('click', handleGetLocation);

/**
 * Fungsi yang menangani klik pada Peta
 * (Tidak berubah)
 */
map.on('click', async function(e) {
    const toCoords = [e.latlng.lat, e.latlng.lng];
    resultDiv.innerHTML = "Mencari nama lokasi...";
    const locationName = await reverseGeocode(toCoords);
    toInput.value = locationName;
    await calculateAndDrawRoute(homeCoords, toCoords, locationName);
});

