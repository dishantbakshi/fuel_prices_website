// Serverless proxy for the NSW FuelCheck API (api.nsw.gov.au, product id 22).
//
// Requires two environment variables, set in Netlify -> Site configuration ->
// Environment variables (never commit these):
//   NSW_FUELCHECK_API_KEY    - "API Key" / consumer key from your api.nsw.gov.au subscription
//   NSW_FUELCHECK_API_SECRET - matching "API Secret" / consumer secret
//
// Optional overrides, only needed if NSW migrates the gateway host/path:
//   NSW_FUELCHECK_BASE_URL   - default below
//   NSW_FUELCHECK_TOKEN_URL  - default below
//
// Endpoint/field names below are verified against the FuelCheck API's actual
// request/response shape (github.com/nickw444/nsw-fuel-api-client), not just
// the marketing docs. Auth is layered on top per the current api.nsw.gov.au
// product page (OAuth2 client-credentials -> Bearer token).

const DEFAULT_BASE_URL = "https://api.onegov.nsw.gov.au/FuelCheckApp/v1/fuel";
const DEFAULT_TOKEN_URL = "https://api.onegov.nsw.gov.au/oauth/client_credential/accesstoken";
const PRICE_CACHE_TTL_MS = 15 * 60 * 1000; // keeps well under the 2500 calls/month free tier

let tokenCache = { value: null, expiresAt: 0 };
let priceCache = { data: null, fetchedAt: 0 };

function formatRequestTimestamp(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function parseLastUpdated(raw) {
  if (!raw) return null;
  // FuelCheck has shipped two different lastupdated formats historically.
  const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
  if (dmy) {
    const [, d, m, y, h, min, s] = dmy;
    return new Date(`${y}-${m}-${d}T${h}:${min}:${s}`);
  }
  const parsed = new Date(raw.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function getAccessToken() {
  if (tokenCache.value && Date.now() < tokenCache.expiresAt) return tokenCache.value;

  const apiKey = process.env.NSW_FUELCHECK_API_KEY;
  const apiSecret = process.env.NSW_FUELCHECK_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error("missing_credentials");

  const tokenUrl = process.env.NSW_FUELCHECK_TOKEN_URL || DEFAULT_TOKEN_URL;
  const basic = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

  const res = await fetch(`${tokenUrl}?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!res.ok) throw new Error(`token_request_failed_${res.status}`);
  const data = await res.json();

  tokenCache = {
    value: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000 - 60000,
  };
  return tokenCache.value;
}

async function getAllPrices() {
  if (priceCache.data && Date.now() - priceCache.fetchedAt < PRICE_CACHE_TTL_MS) {
    return priceCache.data;
  }

  const token = await getAccessToken();
  const baseUrl = process.env.NSW_FUELCHECK_BASE_URL || DEFAULT_BASE_URL;

  const res = await fetch(`${baseUrl}/prices`, {
    headers: {
      Authorization: `Bearer ${token}`,
      requesttimestamp: formatRequestTimestamp(new Date()),
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`prices_request_failed_${res.status}`);
  const data = await res.json();

  priceCache = { data, fetchedAt: Date.now() };
  return data;
}

function buildStationsForCity(data, city) {
  const needle = city.trim().toLowerCase();

  const matchedStations = (data.stations || []).filter((s) =>
    (s.address || "").toLowerCase().includes(needle)
  );
  const matchedCodes = new Set(matchedStations.map((s) => Number(s.code)));

  const pricesByStation = {};
  (data.prices || []).forEach((p) => {
    const code = Number(p.stationcode);
    if (!matchedCodes.has(code)) return;
    const updated = parseLastUpdated(p.lastupdated);
    if (!pricesByStation[code]) pricesByStation[code] = {};
    pricesByStation[code][p.fueltype] = {
      price: Math.round((Number(p.price) / 100) * 1000) / 1000, // cents/litre -> dollars, 3dp
      updatedMin: updated ? Math.max(0, Math.round((Date.now() - updated.getTime()) / 60000)) : null,
    };
  });

  return matchedStations
    .filter((s) => pricesByStation[Number(s.code)])
    .map((s) => ({
      code: s.code,
      brand: s.brand,
      name: s.name,
      address: s.address,
      latitude: s.location ? s.location.latitude : null,
      longitude: s.location ? s.location.longitude : null,
      prices: pricesByStation[Number(s.code)],
    }));
}

exports.handler = async (event) => {
  const city = ((event.queryStringParameters && event.queryStringParameters.city) || "").trim();
  if (!city) {
    return { statusCode: 400, body: JSON.stringify({ available: false, reason: "missing_city" }) };
  }

  if (!process.env.NSW_FUELCHECK_API_KEY || !process.env.NSW_FUELCHECK_API_SECRET) {
    return { statusCode: 200, body: JSON.stringify({ available: false, reason: "not_configured" }) };
  }

  try {
    const data = await getAllPrices();
    const stations = buildStationsForCity(data, city);
    return {
      statusCode: 200,
      body: JSON.stringify({ available: true, source: "nsw-fuelcheck", city, stations }),
    };
  } catch (err) {
    return {
      statusCode: 200,
      body: JSON.stringify({ available: false, reason: "upstream_error", detail: String((err && err.message) || err) }),
    };
  }
};
