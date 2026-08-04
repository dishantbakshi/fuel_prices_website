/* =========================================================
   FuelPulse AU — demo data + interactions
   NOTE: prices are randomised mock data for design purposes.
   Wire CITY_DATA / fetchStations() up to a real feed
   (e.g. a state FuelCheck API or aggregator) for production.
   ========================================================= */

const AU_CITIES = [
  { name: "Sydney", state: "NSW", lat: -33.8688, lng: 151.2093 },
  { name: "Melbourne", state: "VIC", lat: -37.8136, lng: 144.9631 },
  { name: "Brisbane", state: "QLD", lat: -27.4698, lng: 153.0251 },
  { name: "Perth", state: "WA", lat: -31.9505, lng: 115.8605 },
  { name: "Adelaide", state: "SA", lat: -34.9285, lng: 138.6007 },
  { name: "Canberra", state: "ACT", lat: -35.2809, lng: 149.13 },
  { name: "Hobart", state: "TAS", lat: -42.8821, lng: 147.3272 },
  { name: "Darwin", state: "NT", lat: -12.4634, lng: 130.8456 },
  { name: "Gold Coast", state: "QLD", lat: -28.0167, lng: 153.4 },
  { name: "Newcastle", state: "NSW", lat: -32.9283, lng: 151.7817 },
  { name: "Wollongong", state: "NSW", lat: -34.4278, lng: 150.8931 },
  { name: "Geelong", state: "VIC", lat: -38.1499, lng: 144.3617 },
  { name: "Sunshine Coast", state: "QLD", lat: -26.65, lng: 153.0667 },
  { name: "Cairns", state: "QLD", lat: -16.9186, lng: 145.7781 },
  { name: "Townsville", state: "QLD", lat: -19.259, lng: 146.8169 },
  { name: "Toowoomba", state: "QLD", lat: -27.5598, lng: 151.9507 },
  { name: "Ballarat", state: "VIC", lat: -37.5622, lng: 143.8503 },
  { name: "Bendigo", state: "VIC", lat: -36.757, lng: 144.2794 },
  { name: "Launceston", state: "TAS", lat: -41.4332, lng: 147.1441 },
  { name: "Alice Springs", state: "NT", lat: -23.698, lng: 133.8807 },
];

function haversineKm(a, b) {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s1)) * 10) / 10;
}

const FUEL_LABELS = {
  U91: "Unleaded 91",
  P95: "Premium 95",
  P98: "Premium 98",
  E10: "E10",
  DL: "Diesel",
};

const BRANDS = [
  { name: "BP", short: "BP", color: "linear-gradient(160deg,#2C7A4B,#1B4B43)" },
  { name: "Shell Coles Express", short: "SH", color: "linear-gradient(160deg,#E8792F,#C1502E)" },
  { name: "Ampol", short: "AM", color: "linear-gradient(160deg,#1B4B43,#0E2E2A)" },
  { name: "7-Eleven", short: "7E", color: "linear-gradient(160deg,#C1602A,#8F3E1D)" },
  { name: "United Petroleum", short: "UP", color: "linear-gradient(160deg,#256257,#123832)" },
  { name: "Liberty", short: "LB", color: "linear-gradient(160deg,#F08A3C,#C1602A)" },
  { name: "Metro Fuel", short: "MF", color: "linear-gradient(160deg,#5C564C,#241F19)" },
];

const STREET_NAMES = ["Pacific Hwy", "Main Rd", "High St", "George St", "Church St", "Station Rd", "Bridge St", "Victoria Pde", "King St", "Marine Pde"];

/* Deterministic-ish pseudo-random so a given city always looks the same on load */
function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h || 1;
}

function basePriceFor(fuel) {
  switch (fuel) {
    case "U91": return 1.72;
    case "E10": return 1.66;
    case "P95": return 1.85;
    case "P98": return 1.98;
    case "DL": return 1.79;
    default: return 1.75;
  }
}

function generateStations(city, center) {
  const rand = seededRandom(hashStr(city.toLowerCase()));
  const count = 6 + Math.floor(rand() * 4); // 6-9 stations
  const stations = [];
  for (let i = 0; i < count; i++) {
    const brand = BRANDS[Math.floor(rand() * BRANDS.length)];
    const street = STREET_NAMES[Math.floor(rand() * STREET_NAMES.length)];
    const num = 4 + Math.floor(rand() * 380);
    const updatedMin = Math.floor(rand() * 55) + 1;
    // Scatter within ~12km of the city centre so the map looks plausible.
    const lat = center.lat + (rand() - 0.5) * 0.22;
    const lng = center.lng + (rand() - 0.5) * 0.22;
    const prices = {};
    Object.keys(FUEL_LABELS).forEach((fuel) => {
      const base = basePriceFor(fuel);
      const drift = (rand() - 0.5) * 0.22; // +/- 11c station-to-station
      prices[fuel] = Math.max(1.35, +(base + drift).toFixed(2));
    });
    stations.push({
      id: `${city}-${i}`,
      brand: brand.name,
      short: brand.short,
      color: brand.color,
      address: `${num} ${street}, ${city}`,
      lat,
      lng,
      updatedMin,
      prices,
    });
  }
  return stations;
}

const NSW_FUEL_ENDPOINT = "/.netlify/functions/nsw-fuel-prices";

// FuelCheck's fuel-type codes have drifted a little across API versions;
// normalise the common variants onto the codes this UI uses.
const FUEL_CODE_ALIASES = {
  U91: ["U91", "ULP"],
  E10: ["E10"],
  P95: ["P95", "U95", "PULP95"],
  P98: ["P98", "U98", "PULP98"],
  DL: ["DL", "DIESEL", "PDL"],
};
function normalizeFuelCode(raw) {
  const upper = String(raw).toUpperCase().replace(/\s+/g, "");
  for (const [key, aliases] of Object.entries(FUEL_CODE_ALIASES)) {
    if (aliases.includes(upper)) return key;
  }
  return upper;
}

function brandVisual(rawBrand) {
  const name = (rawBrand || "Independent").trim();
  const known = BRANDS.find((b) => name.toLowerCase().includes(b.name.split(" ")[0].toLowerCase()));
  if (known) return { short: known.short, color: known.color, brand: known.name };
  const palette = [
    "linear-gradient(160deg,#5C564C,#241F19)",
    "linear-gradient(160deg,#256257,#123832)",
    "linear-gradient(160deg,#C1602A,#8F3E1D)",
  ];
  return { short: name.slice(0, 2).toUpperCase(), color: palette[hashStr(name) % palette.length], brand: name };
}

async function fetchRealNswStations(city) {
  const res = await fetch(`${NSW_FUEL_ENDPOINT}?city=${encodeURIComponent(city)}`);
  if (!res.ok) throw new Error(`nsw_fuel_http_${res.status}`);
  const data = await res.json();
  if (!data.available || !data.stations || !data.stations.length) return null;

  const stations = data.stations
    .map((s, i) => {
      const visual = brandVisual(s.brand);
      const prices = {};
      let bestUpdatedMin = null;
      Object.entries(s.prices || {}).forEach(([code, entry]) => {
        prices[normalizeFuelCode(code)] = entry.price;
        if (entry.updatedMin != null && (bestUpdatedMin == null || entry.updatedMin < bestUpdatedMin)) {
          bestUpdatedMin = entry.updatedMin;
        }
      });
      return {
        id: `nsw-${s.code || i}`,
        brand: visual.brand,
        short: visual.short,
        color: visual.color,
        address: s.address,
        lat: s.latitude != null ? Number(s.latitude) : null,
        lng: s.longitude != null ? Number(s.longitude) : null,
        updatedMin: bestUpdatedMin,
        prices,
      };
    })
    .filter((s) => Object.keys(s.prices).length);

  return stations.length ? stations : null;
}

function resolveCityCenter(city) {
  const match = AU_CITIES.find((c) => c.name.toLowerCase() === city.toLowerCase());
  if (match) return { lat: match.lat, lng: match.lng };
  return { lat: -33.8688, lng: 151.2093 }; // unknown search text: default to Sydney
}

async function fetchStations(city) {
  const target = city || "Sydney";
  const center = resolveCityCenter(target);
  try {
    const real = await fetchRealNswStations(target);
    if (real) {
      // A handful of FuelCheck stations ship without coordinates; fall back
      // to a jittered point near the city centre so they still plot on the map.
      const rand = seededRandom(hashStr(target.toLowerCase()));
      real.forEach((s) => {
        if (s.lat == null || s.lng == null) {
          s.lat = center.lat + (rand() - 0.5) * 0.18;
          s.lng = center.lng + (rand() - 0.5) * 0.18;
        }
      });
      return { source: "nsw-fuelcheck", stations: real, center };
    }
  } catch (err) {
    console.warn("NSW FuelCheck lookup failed, falling back to demo data:", err);
  }
  return { source: "demo", stations: generateStations(target, center), center };
}

/* ---------------------------------------------------------
   Shared: city autocomplete (used on home + results search)
   --------------------------------------------------------- */
function wireAutocomplete(inputEl, listEl) {
  if (!inputEl || !listEl) return;

  function render(items) {
    if (!items.length) { listEl.classList.remove("open"); listEl.innerHTML = ""; return; }
    listEl.innerHTML = items
      .slice(0, 6)
      .map(
        (c) => `<button type="button" data-city="${c.name}">📍 ${c.name} <span class="tag">${c.state}</span></button>`
      )
      .join("");
    listEl.classList.add("open");
  }

  inputEl.addEventListener("input", () => {
    const q = inputEl.value.trim().toLowerCase();
    if (!q) { render(AU_CITIES.slice(0, 6)); return; }
    render(AU_CITIES.filter((c) => c.name.toLowerCase().includes(q)));
  });

  inputEl.addEventListener("focus", () => {
    const q = inputEl.value.trim().toLowerCase();
    render(q ? AU_CITIES.filter((c) => c.name.toLowerCase().includes(q)) : AU_CITIES.slice(0, 6));
  });

  listEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-city]");
    if (!btn) return;
    inputEl.value = btn.dataset.city;
    listEl.classList.remove("open");
    inputEl.focus();
  });

  document.addEventListener("click", (e) => {
    if (!listEl.contains(e.target) && e.target !== inputEl) listEl.classList.remove("open");
  });
}

/* ---------------------------------------------------------
   Home page wiring
   --------------------------------------------------------- */
function initHomePage() {
  const form = document.getElementById("fuel-search");
  if (!form) return;
  wireAutocomplete(document.getElementById("city"), document.getElementById("city-list"));

  form.addEventListener("submit", (e) => {
    const cityInput = document.getElementById("city");
    if (!cityInput.value.trim()) {
      e.preventDefault();
      cityInput.focus();
    }
    // Native GET submit carries city/fuel/radius to results.html as query params.
  });
}

/* ---------------------------------------------------------
   Station map (Leaflet + OpenStreetMap tiles — no API key)
   --------------------------------------------------------- */
function pinIcon(color, size) {
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(20,15,10,.4)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
const STATION_ICON = pinIcon("#E8792F", 16);
const STATION_ICON_BEST = pinIcon("#C1502E", 20);
const USER_ICON = pinIcon("#2E7DD1", 14);

function initStationMap(center) {
  const el = document.getElementById("station-map");
  if (!el || typeof L === "undefined") return null;

  const map = L.map(el, { scrollWheelZoom: false }).setView([center.lat, center.lng], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 18,
  }).addTo(map);

  return { map, stationLayer: L.layerGroup().addTo(map), userMarker: null };
}

function updateStationMap(mapState, sortedStations, fuel, cheapestPrice, refCoord, usingMyLocation) {
  if (!mapState) return;
  const { map, stationLayer } = mapState;
  stationLayer.clearLayers();

  const plottable = sortedStations.filter((s) => s.lat != null && s.lng != null);
  plottable.forEach((s) => {
    const isCheapest = s.prices[fuel] === cheapestPrice;
    L.marker([s.lat, s.lng], { icon: isCheapest ? STATION_ICON_BEST : STATION_ICON })
      .bindPopup(
        `<strong>${s.brand}</strong><br>${s.address}<br>$${s.prices[fuel].toFixed(2)}/L ${FUEL_LABELS[fuel]}`
      )
      .addTo(stationLayer);
  });

  if (usingMyLocation && refCoord) {
    if (mapState.userMarker) stationLayer.removeLayer(mapState.userMarker);
    mapState.userMarker = L.marker([refCoord.lat, refCoord.lng], { icon: USER_ICON })
      .bindPopup("You are here")
      .addTo(stationLayer);
  }

  const points = plottable.map((s) => [s.lat, s.lng]);
  if (usingMyLocation && refCoord) points.push([refCoord.lat, refCoord.lng]);
  if (points.length) {
    map.fitBounds(points, { padding: [30, 30], maxZoom: 14 });
  } else {
    map.setView([refCoord.lat, refCoord.lng], 12);
  }
  setTimeout(() => map.invalidateSize(), 0);
}

/* ---------------------------------------------------------
   Results page wiring
   --------------------------------------------------------- */
async function initResultsPage() {
  const root = document.getElementById("results-app");
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  let city = params.get("city") || "Sydney";
  let fuel = params.get("fuel") || "U91";
  let sort = "price";
  const brandFilter = new Set();

  const cityMatch = AU_CITIES.find((c) => c.name.toLowerCase() === city.toLowerCase());
  const cityLabel = cityMatch ? cityMatch.name : city;
  const stateLabel = cityMatch ? cityMatch.state : "AU";

  document.getElementById("results-city-input").value = cityLabel;
  document.getElementById("results-fuel-select").value = fuel;
  document.title = `${FUEL_LABELS[fuel]} prices in ${cityLabel} — FuelPulse AU`;
  document.getElementById("heading-city").textContent = cityLabel;
  document.getElementById("heading-state").textContent = stateLabel;

  const dataSourceEl = document.getElementById("data-source");
  if (dataSourceEl) dataSourceEl.innerHTML = `<span class="live-dot"></span> Loading live prices…`;
  document.getElementById("station-list").innerHTML = `<div class="empty-state"><h3>Loading live prices…</h3><p>Checking NSW FuelCheck for stations near ${cityLabel}.</p></div>`;

  const initial = await fetchStations(cityLabel);
  let dataSource = initial.source;
  const stations = initial.stations;
  let refCoord = initial.center;
  let usingMyLocation = false;

  const map = initStationMap(initial.center);

  function renderDataSourceBadge() {
    if (!dataSourceEl) return;
    if (dataSource === "nsw-fuelcheck") {
      dataSourceEl.className = "data-source live";
      dataSourceEl.innerHTML = `<span class="live-dot"></span> Live prices from NSW FuelCheck`;
    } else {
      dataSourceEl.className = "data-source demo";
      dataSourceEl.innerHTML = `<span class="live-dot demo"></span> Estimated demo prices — no live NSW FuelCheck data for this search`;
    }
  }
  renderDataSourceBadge();

  const allBrands = [...new Set(stations.map((s) => s.brand))];

  const brandFiltersEl = document.getElementById("brand-filters");
  brandFiltersEl.innerHTML = allBrands
    .map(
      (b, i) => `
      <label class="check-row">
        <input type="checkbox" value="${b}" checked data-brand-filter>
        ${b}
      </label>`
    )
    .join("");
  allBrands.forEach((b) => brandFilter.add(b));

  function fuelTabsMarkup() {
    return Object.keys(FUEL_LABELS)
      .map((f) => {
        const vals = stations.map((s) => s.prices[f]).filter((v) => v != null);
        const cheapest = vals.length ? Math.min(...vals) : null;
        return `<button type="button" data-fuel-tab="${f}" class="${f === fuel ? "active" : ""}">
          ${FUEL_LABELS[f]} <span class="price">${cheapest != null ? "$" + cheapest.toFixed(2) : "—"}</span>
        </button>`;
      })
      .join("");
  }

  function render() {
    stations.forEach((s) => { s.distance = haversineKm(refCoord, s); });

    const filtered = stations.filter((s) => brandFilter.has(s.brand) && s.prices[fuel] != null);
    const sorted = [...filtered].sort((a, b) => {
      if (sort === "distance" && a.distance != null && b.distance != null) {
        return a.distance - b.distance;
      }
      return a.prices[fuel] - b.prices[fuel];
    });
    const cheapestPrice = sorted.length ? Math.min(...sorted.map((s) => s.prices[fuel])) : null;

    document.getElementById("fuel-tabs").innerHTML = fuelTabsMarkup();
    document.getElementById("results-count").textContent =
      sorted.length ? `${sorted.length} stations found · ${FUEL_LABELS[fuel]}${usingMyLocation ? " · near you" : ""}` : "No stations match your filters";

    updateStationMap(map, sorted, fuel, cheapestPrice, refCoord, usingMyLocation);

    const listEl = document.getElementById("station-list");
    if (!sorted.length) {
      listEl.innerHTML = `<div class="empty-state"><h3>No stations found</h3><p>Try widening your search radius or clearing a filter.</p></div>`;
      return;
    }

    listEl.innerHTML = sorted
      .map((s) => {
        const price = s.prices[fuel];
        const isCheapest = price === cheapestPrice;
        const distanceBit = s.distance != null ? `${s.distance} km away · ` : "";
        const updatedBit = s.updatedMin != null ? `Updated ${s.updatedMin} min ago` : "Recently updated";
        const mapsHref = s.lat != null && s.lng != null
          ? `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}`;
        return `
        <div class="station-card" data-station-id="${s.id}">
          <div class="brand-badge" style="background:${s.color}">${s.short}</div>
          <div class="station-info">
            <h4>${s.brand}</h4>
            <div class="addr">${distanceBit}${s.address}</div>
            <div class="meta">
              <span class="updated"><span class="live-dot"></span> ${updatedBit}</span>
            </div>
          </div>
          <div class="price-block ${isCheapest ? "cheapest" : ""}">
            ${isCheapest ? '<span class="badge-best">Best price</span><br>' : ""}
            <span class="amt">$${price.toFixed(2)}<sup>/L</sup></span>
            <div class="label">${FUEL_LABELS[fuel]}</div>
          </div>
          <a class="directions-btn" href="${mapsHref}" target="_blank" rel="noopener">Directions</a>
        </div>`;
      })
      .join("");
  }

  render();

  document.getElementById("fuel-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-fuel-tab]");
    if (!btn) return;
    fuel = btn.dataset.fuelTab;
    document.getElementById("results-fuel-select").value = fuel;
    document.title = `${FUEL_LABELS[fuel]} prices in ${cityLabel} — FuelPulse AU`;
    render();
  });

  document.getElementById("sort-select").addEventListener("change", (e) => {
    sort = e.target.value;
    render();
  });

  brandFiltersEl.addEventListener("change", (e) => {
    const cb = e.target.closest("input[data-brand-filter]");
    if (!cb) return;
    if (cb.checked) brandFilter.add(cb.value);
    else brandFilter.delete(cb.value);
    render();
  });

  document.getElementById("results-search-form").addEventListener("submit", (e) => {
    // Allows re-searching a new city/fuel directly from the results page.
  });

  wireAutocomplete(document.getElementById("results-city-input"), document.getElementById("results-city-list"));

  const locateBtn = document.getElementById("locate-btn");
  if (locateBtn && "geolocation" in navigator) {
    locateBtn.addEventListener("click", () => {
      locateBtn.disabled = true;
      locateBtn.textContent = "Locating…";
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          refCoord = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          usingMyLocation = true;
          sort = "distance";
          document.getElementById("sort-select").value = "distance";
          locateBtn.textContent = "📍 Using your location";
          render();
        },
        () => {
          locateBtn.disabled = false;
          locateBtn.textContent = "Use my location";
          alert("Couldn't get your location — check your browser's location permission for this site.");
        }
      );
    });
  } else if (locateBtn) {
    locateBtn.style.display = "none";
  }

  if (dataSource === "nsw-fuelcheck") {
    // Real data: periodically re-pull from NSW FuelCheck rather than faking movement.
    setInterval(async () => {
      try {
        const fresh = await fetchStations(cityLabel);
        if (fresh.source === "nsw-fuelcheck" && fresh.stations.length) {
          stations.length = 0;
          stations.push(...fresh.stations);
          render();
        }
      } catch (err) {
        console.warn("NSW FuelCheck refresh failed:", err);
      }
    }, 5 * 60 * 1000);
  } else {
    // Demo data: gentle nudges so the page still feels alive.
    setInterval(() => {
      stations.forEach((s) => {
        Object.keys(s.prices).forEach((f) => {
          const nudge = (Math.random() - 0.5) * 0.01;
          s.prices[f] = Math.max(1.3, +(s.prices[f] + nudge).toFixed(2));
        });
        s.updatedMin = Math.random() < 0.3 ? 0 : s.updatedMin;
      });
      render();
    }, 12000);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initHomePage();
  initResultsPage();
});
