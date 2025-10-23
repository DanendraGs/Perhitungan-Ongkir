// Inisialisasi peta Leaflet
const map = L.map('map').setView([-6.2088, 106.8456], 10);

// Tambahkan tile layer OpenStreetMap ke peta
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Variabel untuk menyimpan marker dan rute
let startMarker, endMarker, routePolyline;

// KOORDINAT RUMAH ANDA (Lat, Lon)
const homeCoords = [-6.242476645426871, 107.07192446114526];

// Tentukan biaya ongkir per kilometer
const COST_PER_KM = 4000; // Rp 4.000 per km

// Ambil elemen-elemen DOM
const fromInput = document.getElementById('from-input');
const toInput = document.getElementById('to-input');
const calcButton = document.getElementById('calc-button');
const resultDiv = document.getElementById('result');
// (BARU) Ambil tombol lokasi
const locationButton = document.getElementById('location-button');

/**
 * Fungsi Geocoding (Nama Lokasi -> Koordinat)
 */
async function getCoords(locationName) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json&limit=1`);
        const data = await response.json();
        if (data.length > 0) return [data[0].lat, data[0].lon]; 
        return null;
    } catch (error) {
        console.error("Error geocoding:", error);
        return null;
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
 * Fungsi inti untuk menghitung dan menggambar rute + ongkir
 */
async function calculateAndDrawRoute(fromCoords, toCoords, destinationName) {
    resultDiv.innerHTML = "Menghitung rute...";
    const route = await getRoute(fromCoords, toCoords);

    if (!route) {
        resultDiv.innerHTML = "Gagal menghitung rute. Titik mungkin tidak terjangkau.";
        return;
    }

    const distanceInKm = route.distance / 1000;
    const duration = (route.duration / 60).toFixed(0);
    const totalCost = distanceInKm * COST_PER_KM;

    const formattedDistance = distanceInKm.toFixed(2);
    const formattedCost = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(totalCost);

    resultDiv.innerHTML = `
        <strong>Jarak:</strong> ${formattedDistance} km<br>
        <strong>Perkiraan Waktu:</strong> ${duration} menit<br>
        <strong class="price-label">Estimasi Ongkir:</strong>
        <span class="price-value">${formattedCost}</span>
    `;

    if (startMarker) map.removeLayer(startMarker);
    if (endMarker) map.removeLayer(endMarker);
    if (routePolyline) map.removeLayer(routePolyline);

    startMarker = L.marker(fromCoords).addTo(map).bindPopup(`<b>Dari:</b> Rumah Anda`);
    endMarker = L.marker(toCoords).addTo(map).bindPopup(`<b>Ke:</b> ${destinationName}`).openPopup();

    const routeCoordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
    routePolyline = L.polyline(routeCoordinates, {color: 'blue'}).addTo(map);
    map.fitBounds(routePolyline.getBounds());
}

/**
 * Fungsi yang menangani klik tombol "Hitung"
 */
async function handleSearch() {
    const toLocation = toInput.value;
    if (!toLocation) {
        resultDiv.innerHTML = "Harap isi lokasi tujuan di kotak pencarian.";
        return;
    }
    resultDiv.innerHTML = "Mencari lokasi...";
    const toCoords = await getCoords(toLocation);
    if (!toCoords) {
        resultDiv.innerHTML = "Lokasi tujuan tidak ditemukan.";
        return;
    }
    await calculateAndDrawRoute(homeCoords, toCoords, toLocation);
}

/**
 * (BARU) Fungsi yang menangani klik tombol "Lokasi Saya 📍"
 */
async function handleGetLocation() {
    if (!navigator.geolocation) {
        resultDiv.innerHTML = "Browser Anda tidak mendukung Geolocation.";
        return;
    }

    resultDiv.innerHTML = "Meminta lokasi Anda...";

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            // Sukses mendapatkan lokasi
            const toCoords = [position.coords.latitude, position.coords.longitude];
            
            resultDiv.innerHTML = "Mencari nama alamat...";
            
            // Ubah koordinat jadi alamat
            const locationName = await reverseGeocode(toCoords);
            
            // Masukkan alamat ke input "Ke"
            toInput.value = locationName;

            // Langsung hitung rute dan ongkir
            await calculateAndDrawRoute(homeCoords, toCoords, locationName);
        },
        (error) => {
            // Gagal mendapatkan lokasi
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

// (BARU) Tambahkan event listener ke tombol Lokasi Saya
locationButton.addEventListener('click', handleGetLocation);

/**
 * Fungsi yang menangani klik pada Peta
 */
map.on('click', async function(e) {
    const toCoords = [e.latlng.lat, e.latlng.lng];
    resultDiv.innerHTML = "Mencari nama lokasi...";
    const locationName = await reverseGeocode(toCoords);
    toInput.value = locationName;
    await calculateAndDrawRoute(homeCoords, toCoords, locationName);
});