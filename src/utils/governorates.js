// Governorate colours, lazy GeoJSON loading and a fast cached point-in-polygon lookup.
export const GOV_COLORS = {
  "Northern Governorate": "#f43f9d",
  "Capital Governorate": "#1ea7f2",
  "Muharraq Governorate": "#fbbf24",
  "Southern Governorate": "#10b981",
};

let promise = null;
let polys = []; // [{ name, rings, bbox }]
const cache = new Map();

export function loadGovernorates() {
  if (!promise) {
    promise = fetch("/data/bahrain-governorates.geojson")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load governorates");
        return r.json();
      })
      .then((geo) => {
        polys = [];
        for (const f of geo.features || []) {
          const g = f.geometry;
          if (!g) continue;
          const list = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
          for (const rings of list) {
            let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
            for (const [x, y] of rings[0]) {
              if (x < x0) x0 = x; if (x > x1) x1 = x;
              if (y < y0) y0 = y; if (y > y1) y1 = y;
            }
            polys.push({ name: f.properties.shapeName, rings, bbox: [x0, y0, x1, y1] });
          }
        }
        cache.clear();
        return geo;
      })
      .catch((e) => {
        promise = null; // allow retry
        throw e;
      });
  }
  return promise;
}

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}


// أقصى مسافة (كم) نعتبر فيها الموقع تابع لأقرب محافظة
const MAX_KM = 10;
const KM_PER_DEG = 111.32;

// المسافة من نقطة إلى قطعة مستقيمة (بالكيلومتر)
function distToSegKm(px, py, ax, ay, bx, by, k) {
  const x = px * k, y = py;
  const x1 = ax * k, y1 = ay;
  const x2 = bx * k, y2 = by;

  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;

  let t = len2 ? ((x - x1) * dx + (y - y1) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));

  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(x - cx, y - cy) * KM_PER_DEG;
}


function nearestGov(x, y) {
  const k = Math.cos((y * Math.PI) / 180);
  let best = null;
  let bestD = Infinity;

  for (const p of polys) {

    const b = p.bbox;
    const bx = Math.max(b[0] - x, 0, x - b[2]) * k;
    const by = Math.max(b[1] - y, 0, y - b[3]);
    if (Math.hypot(bx, by) * KM_PER_DEG > bestD) continue;

    const ring = p.rings[0];
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const d = distToSegKm(x, y, ring[j][0], ring[j][1], ring[i][0], ring[i][1], k);
      if (d < bestD) {
        bestD = d;
        best = p.name;
      }
    }
  }

  return bestD <= MAX_KM ? best : null;
}


export function govOf(loc = {}) {
  if (loc.governorate && GOV_COLORS[loc.governorate]) return loc.governorate;
  const x = +loc.longitude, y = +loc.latitude;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !polys.length) return null;

  const key = `${x.toFixed(5)}|${y.toFixed(5)}`;
  if (cache.has(key)) return cache.get(key);

  let found = null;
  for (const p of polys) {
    const b = p.bbox;
    if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue; // cheap bbox reject
    if (!inRing(x, y, p.rings[0])) continue;
    let hole = false;
    for (let i = 1; i < p.rings.length; i++) if (inRing(x, y, p.rings[i])) { hole = true; break; }
    if (!hole) { found = p.name; break; }
  }


  if (!found) found = nearestGov(x, y);

  cache.set(key, found);
  return found;
}