
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import {
  GOV_COLORS as COLORS,
  loadGovernorates,
  govOf,
} from "../utils/governorates";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const DEFAULT = "#007aff";
const DRAFT = "#ff3b30";
const NS = "http://www.w3.org/2000/svg";

const STAR_POINTS =
  "0,-10.5 3,-3.4 10.5,-2.7 4.8,2.3 6.6,9.7 0,5.8 -6.6,9.7 -4.8,2.3 -10.5,-2.7 -3,-3.4";

const shortGov = (name) => name.replace(" Governorate", "");
const short = (s = "") => (s.length > 26 ? s.slice(0, 25) + "…" : s);
const n = (v) => Math.round(v * 100) / 100;

const colorAt = (lng, lat, gov) =>
  COLORS[
    govOf({
      governorate: gov,
      longitude: lng,
      latitude: lat,
    })
  ] || null;

/* ---------- Text measuring ---------- */

const measure = document.createElement("canvas").getContext("2d");

measure.font =
  '700 13px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif';

const widths = new Map();

const textW = (s) => {
  if (!widths.has(s)) {
    widths.set(s, measure.measureText(s).width);
  }

  return widths.get(s);
};

/* ---------- SVG helpers ---------- */

function svgEl(tag, cls, attrs) {
  const node = document.createElementNS(NS, tag);

  if (cls) node.setAttribute("class", cls);

  if (attrs) {
    for (const k in attrs) {
      node.setAttribute(k, attrs[k]);
    }
  }

  return node;
}

function buildStar(cls, id) {
  const star = svgEl("g", cls, id ? { "data-id": id } : null);
  const sc = svgEl("g", "sc");

  sc.append(
    svgEl("polygon", "sh", {
      points: STAR_POINTS,
      transform: "translate(0 1.6) scale(1.15)",
    }),
    svgEl("polygon", "sp", {
      points: STAR_POINTS,
      transform: "scale(1.15)",
    })
  );

  star.append(
    svgEl("circle", "pulse", { r: 23 }),
    sc,
    svgEl("circle", "hit", { r: 21 })
  );

  return star;
}

const show = (e, k, node, on) => {
  if (e.v[k] !== on) {
    e.v[k] = on;
    node.style.display = on ? "" : "none";
  }
};

const put = (e, k, node, attr, value) => {
  if (e.c[k] !== value) {
    e.c[k] = value;
    node.setAttribute(attr, value);
  }
};

function setColor(e, color) {
  if (e.color === color) return;

  e.color = color;

  [e.star, e.line, e.label].forEach((node) =>
    node.style.setProperty("--c", color)
  );
}

function createEntry(layers, id) {
  const star = buildStar("star", id);
  const line = svgEl("path", "line");
  const label = svgEl("g", "label", { "data-id": id });

  const shadow = svgEl("rect", "shadow", {
    y: -9,
    height: 22,
    rx: 11,
  });

  const pill = svgEl("rect", "pill", {
    y: -11,
    height: 22,
    rx: 11,
  });

  const dot = svgEl("circle", "dotc", {
    cx: 13,
    r: 4,
  });

  const text = svgEl("text", null, {
    x: 24,
    "dominant-baseline": "central",
  });

  label.append(shadow, pill, dot, text);

  layers.lines.appendChild(line);
  layers.labels.appendChild(label);
  layers.stars.appendChild(star);

  const entry = {
    id,
    star,
    line,
    label,
    pill,
    shadow,
    text,
    v: {},
    c: {},
    side: null,
    title: null,
    w: 0,
    color: null,
    lng: 0,
    lat: 0,
    gov: null,
    x: 0,
    y: 0,
    ly: 0,
  };

  setColor(entry, DEFAULT);

  return entry;
}

function removeEntry(e) {
  e.star.remove();
  e.line.remove();
  e.label.remove();
}

/* ---------- MapView ---------- */

export default function MapView({
  locations,
  selectedId,
  draft,
  pad,
  onMapClick,
  onSelect,
}) {
  const el = useRef(null);
  const map = useRef(null);
  const layers = useRef(null);

  const entries = useRef(new Map());
  const draftEntry = useRef(null);
  const fitDone = useRef(false);

  const live = useRef({});
  const cb = useRef({});

  const [off, setOff] = useState(() => new Set());

  cb.current = { onMapClick, onSelect };

  live.current = {
    locations,
    selectedId,
    pad,
    off,
  };

  /* ---------- Draw stars, lines and labels ---------- */

  const draw = () => {
    const m = map.current;
    const box = el.current;

    if (!m || !box || !layers.current) return;

    const W = box.clientWidth;
    const H = box.clientHeight;

    const { pad: pd, off: hidden } = live.current;

    const top = 76;
    const bottom = Math.max(top + 60, H - Math.max(pd, 112) - 8);

    const cols = {
      L: [],
      R: [],
    };

    entries.current.forEach((e) => {
      const p = hidden.has(e.color)
        ? null
        : m.project([e.lng, e.lat]);

      const starOn =
        !!p &&
        p.x > -30 &&
        p.x < W + 30 &&
        p.y > -30 &&
        p.y < H + 30;

      show(e, "s", e.star, starOn);

      if (!starOn) {
        show(e, "l", e.label, false);
        show(e, "n", e.line, false);
        e.side = null;
        return;
      }

      put(
        e,
        "t",
        e.star,
        "transform",
        `translate(${n(p.x)} ${n(p.y)})`
      );

      const inside =
        p.x >= 0 &&
        p.x <= W &&
        p.y >= 0 &&
        p.y <= H;

      if (!inside) {
        show(e, "l", e.label, false);
        show(e, "n", e.line, false);
        e.side = null;
        return;
      }

      // Side with hysteresis
      if (!e.side) {
        e.side = p.x < W / 2 ? "L" : "R";
      } else if (e.side === "L" && p.x > W / 2 + 28) {
        e.side = "R";
      } else if (e.side === "R" && p.x < W / 2 - 28) {
        e.side = "L";
      }

      e.x = p.x;
      e.y = p.y;

      cols[e.side].push(e);
    });

    ["L", "R"].forEach((side) => {
      const arr = cols[side];
      const left = side === "L";
      const count = arr.length;

      arr.sort((a, b) => a.y - b.y);

      const gap = Math.max(
        24,
        Math.min(30, (bottom - top) / Math.max(count - 1, 1))
      );

      arr.forEach((i) => {
        i.ly = Math.min(Math.max(i.y, top), bottom);
      });

      for (let k = 1; k < count; k++) {
        if (arr[k].ly - arr[k - 1].ly < gap) {
          arr[k].ly = arr[k - 1].ly + gap;
        }
      }

      if (count && arr[count - 1].ly > bottom) {
        arr[count - 1].ly = bottom;

        for (let k = count - 2; k >= 0; k--) {
          arr[k].ly = Math.min(
            arr[k].ly,
            arr[k + 1].ly - gap
          );
        }
      }

      arr.forEach((i) => {
        const pw = i.w + 34;
        const x0 = left ? 10 : W - 10 - pw;
        const edge = left ? x0 + pw : x0;

        show(i, "l", i.label, true);
        show(i, "n", i.line, true);

        put(
          i,
          "lt",
          i.label,
          "transform",
          `translate(${n(x0)} ${n(i.ly)})`
        );

        put(
          i,
          "d",
          i.line,
          "d",
          `M${n(i.x)} ${n(i.y)}V${n(i.ly)}H${n(edge)}`
        );
      });
    });

    const d = draftEntry.current;

    if (d) {
      const p = m.project([d.lng, d.lat]);

      put(
        d,
        "t",
        d.star,
        "transform",
        `translate(${n(p.x)} ${n(p.y)})`
      );
    }
  };

  /* ---------- Recolor ---------- */

  const recolor = () => {
    entries.current.forEach((e) => {
      setColor(
        e,
        colorAt(e.lng, e.lat, e.gov) || DEFAULT
      );
    });

    const d = draftEntry.current;

    if (d) {
      d.star.style.setProperty(
        "--c",
        colorAt(d.lng, d.lat, d.gov) || DRAFT
      );
    }

    draw();
  };

  /* ---------- Initialize map ---------- */

  useEffect(() => {
    const governoratesReady = loadGovernorates();

    const m = new mapboxgl.Map({
      container: el.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: [50.586, 26.0667],
      zoom: 10,
      minZoom: 9,
      maxZoom: 18,
      maxBounds: [
        [50.2, 25.45],
        [50.95, 26.5],
      ],
      dragRotate: false,
      touchPitch: false,
      fadeDuration: 0,
      attributionControl: false,
    });

    map.current = m;

    m.addControl(
      new mapboxgl.AttributionControl({
        compact: true,
      })
    );

    m.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
        },
        trackUserLocation: true,
        showUserHeading: true,
      }),
      "bottom-right"
    );

    m.touchZoomRotate.disableRotation();

    // Overlay
    const root = svgEl("svg", "mbx-overlay");

    const L = {
      root,
      lines: svgEl("g"),
      labels: svgEl("g"),
      stars: svgEl("g"),
    };

    root.append(L.lines, L.labels, L.stars);

    m.getCanvasContainer().appendChild(root);

    layers.current = L;

    root.addEventListener("click", (ev) => {
      const g = ev.target.closest("[data-id]");

      if (!g) return;

      ev.stopPropagation();

      cb.current.onSelect(g.getAttribute("data-id"));
    });

    m.on("click", (ev) => {
      cb.current.onMapClick({
        latitude: ev.lngLat.lat,
        longitude: ev.lngLat.lng,
      });
    });

    m.on("render", draw);

    m.on("load", async () => {
      try {
        const geojson = await governoratesReady;

        if (map.current !== m) return;

       m.addSource("governorates", {
          type: "geojson",
          data: geojson,
          tolerance: 1,
          buffer: 32,
        });

        m.addLayer({
          id: "governorates-fill",
          type: "fill",
          source: "governorates",
          paint: {
            "fill-color": [
              "match",
              ["get", "shapeName"],
              ...Object.entries(COLORS).flat(),
              "#999999",
            ],
            "fill-opacity": 0.3,
          },
        });

        m.addLayer({
          id: "governorates-border",
          type: "line",
          source: "governorates",
          paint: {
            "line-color": "#FFFFFF",
            "line-width": 2,
            "line-opacity": 0.85,
          },
        });

        m.addLayer({
          id: "governorates-names",
          type: "symbol",
          source: "governorates",
          maxzoom: 12,
          layout: {
            "text-field": [
              "match",
              ["get", "shapeName"],
              ...Object.keys(COLORS).flatMap((k) => [
                k,
                shortGov(k),
              ]),
              "",
            ],
            "text-size": 13,
            "text-letter-spacing": 0.2,
            "text-transform": "uppercase",
          },
          paint: {
            "text-color": "#374151",
            "text-opacity": 0.55,
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.5,
          },
        });

        recolor();
      } catch (err) {
        console.error("Governorates loading error:", err);
      }
    });

    return () => {
      root.remove();

      layers.current = null;
      entries.current.clear();
      draftEntry.current = null;
      fitDone.current = false;

      m.remove();

      map.current = null;
    };
  }, []);

  /* ---------- Sync saved locations ---------- */

  useEffect(() => {
    const m = map.current;
    const L = layers.current;

    if (!m || !L) return;

    const seen = new Set();

    locations.forEach((loc) => {
      seen.add(loc._id);

      let e = entries.current.get(loc._id);

      if (!e) {
        e = createEntry(L, loc._id);
        entries.current.set(loc._id, e);
      }

      e.lng = Number(loc.longitude);
      e.lat = Number(loc.latitude);
      e.gov = loc.governorate || "";

      const t = short(loc.title);

      if (e.title !== t) {
        e.title = t;
        e.w = textW(t);

        e.text.textContent = t;

        const pw = n(e.w + 34);

        e.pill.setAttribute("width", pw);
        e.shadow.setAttribute("width", pw);
      }
    });

    entries.current.forEach((e, id) => {
      if (!seen.has(id)) {
        removeEntry(e);
        entries.current.delete(id);
      }
    });

    // Fit all locations once
    if (!fitDone.current && locations.length) {
      fitDone.current = true;

      const b = new mapboxgl.LngLatBounds();

      locations.forEach((loc) => {
        b.extend([
          Number(loc.longitude),
          Number(loc.latitude),
        ]);
      });

      const side = Math.min(
        160,
        m.getContainer().clientWidth * 0.25
      );

      m.fitBounds(b, {
        padding: {
          top: 90,
          bottom: 110,
          left: side,
          right: side,
        },
        maxZoom: 13,
        duration: 0,
      });
    }

    recolor();
  }, [locations]);

  /* ---------- Selected highlight ---------- */

  useEffect(() => {
    entries.current.forEach((e, id) => {
      const on = id === selectedId;

      e.star.classList.toggle("sel", on);
      e.label.classList.toggle("sel", on);
      e.line.classList.toggle("sel", on);
    });
  }, [selectedId, locations]);

  /* ---------- Filter / padding changes ---------- */

  useEffect(() => {
    draw();
  }, [off, pad]);

  /* ---------- Draft star ---------- */

  const dLat = draft?.latitude;
  const dLng = draft?.longitude;
  const dGov = draft?.governorate;

  useEffect(() => {
    const L = layers.current;

    if (!L) return;

    if (dLat == null) {
      draftEntry.current?.star.remove();
      draftEntry.current = null;
      return;
    }

    if (!draftEntry.current) {
      const star = buildStar("star draft sel");

      L.stars.appendChild(star);

      draftEntry.current = {
        star,
        v: {},
        c: {},
        lng: 0,
        lat: 0,
        gov: null,
      };
    }

    const d = draftEntry.current;

    d.lng = dLng;
    d.lat = dLat;
    d.gov = dGov;

    d.star.style.setProperty(
      "--c",
      colorAt(dLng, dLat, dGov) || DRAFT
    );

    draw();
  }, [dLat, dLng, dGov]);

  /* ---------- Camera ---------- */

  const t =
    dLat != null
      ? draft
      : locations.find((l) => l._id === selectedId);

  const tLat = t?.latitude;
  const tLng = t?.longitude;

  useEffect(() => {
    const m = map.current;

    if (!m) return;

    if (tLat == null) {
      m.easeTo({
        padding: { bottom: 0 },
        duration: 250,
      });

      return;
    }

    m.easeTo({
      center: [tLng, tLat],
      zoom: Math.max(m.getZoom(), 13),
      padding: { bottom: pad },
      duration: 400,
    });
  }, [tLat, tLng, pad]);

  /* ---------- Legend filter ---------- */

  const toggle = (color) =>
    setOff((prev) => {
      const next = new Set(prev);

      next.has(color)
        ? next.delete(color)
        : next.add(color);

      return next;
    });

  /* ---------- Render ---------- */

  return (
    <div className="map">
      <div
        ref={el}
        style={{
          width: "100%",
          height: "100%",
        }}
      />

      <div className="legend glass">
        {Object.entries(COLORS).map(([name, c]) => (
          <button
            key={name}
            className={off.has(c) ? "off" : ""}
            onClick={() => toggle(c)}
          >
            <i style={{ background: c }} />
            {shortGov(name)}
          </button>
        ))}
      </div>
    </div>
  );
}
