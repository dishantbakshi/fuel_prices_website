/* =========================================================
   FuelPulse AU — demo data + interactions
   NOTE: prices are randomised mock data for design purposes.
   Wire CITY_DATA / fetchStations() up to a real feed
   (e.g. a state FuelCheck API or aggregator) for production.
   ========================================================= */

const AU_CITIES = [
  { name: "Sydney", state: "NSW" },
  { name: "Melbourne", state: "VIC" },
  { name: "Brisbane", state: "QLD" },
  { name: "Perth", state: "WA" },
  { name: "Adelaide", state: "SA" },
  { name: "Canberra", state: "ACT" },
  { name: "Hobart", state: "TAS" },
  { name: "Darwin", state: "NT" },
  { name: "Gold Coast", state: "QLD" },
  { name: "Newcastle", state: "NSW" },
  { name: "Wollongong", state: "NSW" },
  { name: "Geelong", state: "VIC" },
  { name: "Sunshine Coast", state: "QLD" },
  { name: "Cairns", state: "QLD" },
  { name: "Townsville", state: "QLD" },
  { name: "Toowoomba", state: "QLD" },
  { name: "Ballarat", state: "VIC" },
  { name: "Bendigo", state: "VIC" },
  { name: "Launceston", state: "TAS" },
  { name: "Alice Springs", state: "NT" },
];

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

function generateStations(city) {
  const rand = seededRandom(hashStr(city.toLowerCase()));
  const count = 6 + Math.floor(rand() * 4); // 6-9 stations
  const stations = [];
  for (let i = 0; i < count; i++) {
    const brand = BRANDS[Math.floor(rand() * BRANDS.length)];
    const street = STREET_NAMES[Math.floor(rand() * STREET_NAMES.length)];
    const num = 4 + Math.floor(rand() * 380);
    const distance = Math.round((0.4 + rand() * 12) * 10) / 10;
    const updatedMin = Math.floor(rand() * 55) + 1;
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
      distance,
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
        distance: null,
        updatedMin: bestUpdatedMin,
        prices,
      };
    })
    .filter((s) => Object.keys(s.prices).length);

  return stations.length ? stations : null;
}

async function fetchStations(city) {
  const target = city || "Sydney";
  try {
    const real = await fetchRealNswStations(target);
    if (real) return { source: "nsw-fuelcheck", stations: real };
  } catch (err) {
    console.warn("NSW FuelCheck lookup failed, falling back to demo data:", err);
  }
  return { source: "demo", stations: generateStations(target) };
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
      sorted.length ? `${sorted.length} stations found · ${FUEL_LABELS[fuel]}` : "No stations match your filters";

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
        return `
        <div class="station-card">
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
          <button class="directions-btn" type="button">Directions</button>
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
