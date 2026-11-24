
export const inBahrain = (lat, lng) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= 25.5 &&
  lat <= 26.45 &&
  lng >= 50.2 &&
  lng <= 50.9;

export const gmapsLink = (lat, lng) =>
  `https://www.google.com/maps?q=${(+lat).toFixed(6)},${(+lng).toFixed(6)}`;

export async function copyText(text) {
  // 1. Legacy copy method: works on many mobile browsers over HTTP
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");

    Object.assign(ta.style, {
      position: "fixed",
      top: "0",
      left: "0",
      opacity: "0",
      fontSize: "16px",
      userSelect: "text",
      WebkitUserSelect: "text",
    });

    document.body.appendChild(ta);
    ta.focus({ preventScroll: true });
    ta.select();
    ta.setSelectionRange(0, text.length);

    const ok = document.execCommand("copy");
    ta.remove();

    if (ok) return true;
  } catch {
    // Try the next method
  }

  // 2. Clipboard API (secure context)
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Try the manual fallback
  }

  // 3. Manual copy fallback
  window.prompt("Copy this link:", text);
  return true;
}

const N = "(-?\\d{1,3}(?:\\.\\d+)?)";

const RES = [
  new RegExp(`!3d${N}!4d${N}`),
  new RegExp(`@${N},${N}`),
  new RegExp(`[?&](?:q|query|ll|center|destination|daddr)=${N},[+\\s]*${N}`, "i"),
  new RegExp(`^\\s*${N}\\s*,\\s*${N}\\s*$`),
];

const decode = (s) => {
  for (let i = 0; i < 2; i++) {
    try {
      s = decodeURIComponent(s);
    } catch {
      break;
    }
  }
  return s;
};

export function parseCoords(input = "") {
  const s = decode(String(input));

  for (const re of RES) {
    const m = s.match(re);
    if (!m) continue;

    const latitude = +m[1];
    const longitude = +m[2];

    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;

    const n = s.match(/\/place\/([^/@?]+)/);

    return {
      latitude,
      longitude,
      name: n ? n[1].replace(/\+/g, " ") : "",
    };
  }

  return null;
}
