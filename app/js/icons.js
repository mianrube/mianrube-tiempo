/* Iconos SVG inline, portados del prototipo de diseño. viewBox 0 0 24 24, trazo redondeado. */

const CODE_INFO = {
  0: ['Despejado', 'clear'], 1: ['Mayormente despejado', 'pcloud'], 2: ['Parcialmente nublado', 'pcloud'], 3: ['Nublado', 'cloud'],
  45: ['Niebla', 'fog'], 48: ['Niebla helada', 'fog'],
  51: ['Llovizna débil', 'drizzle'], 53: ['Llovizna', 'drizzle'], 55: ['Llovizna intensa', 'drizzle'],
  56: ['Llovizna helada', 'drizzle'], 57: ['Llovizna helada', 'drizzle'],
  61: ['Lluvia débil', 'rain'], 63: ['Lluvia', 'rain'], 65: ['Lluvia fuerte', 'heavy'],
  66: ['Lluvia helada', 'rain'], 67: ['Lluvia helada fuerte', 'heavy'],
  71: ['Nieve débil', 'snow'], 73: ['Nieve', 'snow'], 75: ['Nieve fuerte', 'snow'], 77: ['Granizo fino', 'snow'],
  80: ['Chubascos', 'shower'], 81: ['Chubascos', 'shower'], 82: ['Chubascos fuertes', 'heavy'],
  85: ['Chubascos de nieve', 'snow'], 86: ['Chubascos de nieve', 'snow'],
  95: ['Tormenta', 'storm'], 96: ['Tormenta con granizo', 'storm'], 99: ['Tormenta con granizo', 'storm']
};

function codeInfo(c) { return CODE_INFO[c] || ['—', 'cloud']; }

function svgWrap(size, inner, extra) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"${extra ? ' ' + extra : ''}>${inner}</svg>`;
}

function sunRays(cx, cy, r, sw, color) {
  let out = `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${color}" stroke-width="${sw}" fill="none"/>`;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const x1 = cx + Math.cos(a) * (r + 2.2), y1 = cy + Math.sin(a) * (r + 2.2);
    const x2 = cx + Math.cos(a) * (r + 4.2), y2 = cy + Math.sin(a) * (r + 4.2);
    out += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${color}" stroke-width="${sw}"/>`;
  }
  return out;
}
function moonPath(color, sw, d) {
  return `<path d="${d || 'M20 14.5A8.5 8.5 0 0 1 9.5 4a7.5 7.5 0 1 0 10.5 10.5Z'}" stroke="${color}" stroke-width="${sw}" fill="none"/>`;
}
function cloudPath(color, sw, d) {
  return `<path d="${d || 'M7.5 17.5h9.2a3.6 3.6 0 0 0 .4-7.2 5.4 5.4 0 0 0-10.2-1.3 3.9 3.9 0 0 0 .6 8.5Z'}" stroke="${color}" stroke-width="${sw}" fill="none"/>`;
}
function drops(color, ys) {
  return ys.map((y, i) => `<line x1="${9 + i * 3}" y1="${y[0]}" x2="${8.2 + i * 3}" y2="${y[1]}" stroke="${color}" stroke-width="1.7"/>`).join('');
}

const _iconMemo = new Map();
function memoized(key, make) {
  if (_iconMemo.has(key)) return _iconMemo.get(key);
  const v = make();
  _iconMemo.set(key, v);
  return v;
}
function clearIconMemo() { _iconMemo.clear(); }

function wIcon(code, isDay, size, pal) {
  return memoized(`w|${code}|${isDay}|${size}|${pal.__theme}`, () => wIconRaw(code, isDay, size, pal));
}
function wIconRaw(code, isDay, size, P) {
  const kind = codeInfo(code)[1];
  const SUN = P.sun, MOON = P.moon, CLOUD = P.cloud, RAIN = P.rain, SNOW = P.snow, BOLT = P.bolt;
  let k = '';
  if (kind === 'clear') { k += isDay ? sunRays(12, 12, 4.6, 1.7, SUN) : moonPath(MOON, 1.6); }
  else if (kind === 'pcloud') {
    k += isDay ? sunRays(8.6, 8.2, 3.1, 1.5, SUN) : moonPath(MOON, 1.5, 'M14.6 9.4A6.4 6.4 0 0 1 8.8 3.8a5.6 5.6 0 1 0 5.8 5.6Z');
    k += cloudPath(CLOUD, 1.6, 'M10 19h7.4a3.2 3.2 0 0 0 .3-6.4 4.8 4.8 0 0 0-9-1.2A3.5 3.5 0 0 0 10 19Z');
  }
  else if (kind === 'cloud') { k += cloudPath(CLOUD, 1.7); }
  else if (kind === 'fog') {
    k += cloudPath(CLOUD, 1.6, 'M7.5 14h9.2a3.6 3.6 0 0 0 .4-7.2 5.4 5.4 0 0 0-10.2-1.3A3.9 3.9 0 0 0 7.5 14Z');
    k += `<line x1="6" y1="18" x2="18" y2="18" stroke="${CLOUD}" stroke-width="1.6"/><line x1="8" y1="21" x2="16" y2="21" stroke="${CLOUD}" stroke-width="1.6"/>`;
  }
  else if (kind === 'drizzle') {
    k += cloudPath(CLOUD, 1.6, 'M7.5 14.5h9.2a3.6 3.6 0 0 0 .4-7.2 5.4 5.4 0 0 0-10.2-1.3 3.9 3.9 0 0 0 .6 8.5Z');
    k += drops(RAIN, [[17.5, 19], [18.5, 20], [17.5, 19]]);
  }
  else if (kind === 'rain' || kind === 'shower') {
    k += cloudPath(CLOUD, 1.6, 'M7.5 14.5h9.2a3.6 3.6 0 0 0 .4-7.2 5.4 5.4 0 0 0-10.2-1.3 3.9 3.9 0 0 0 .6 8.5Z');
    k += drops(RAIN, [[17, 20], [17, 21], [17, 20]]);
    if (kind === 'shower') k += sunRays(18.5, 5, 2.1, 1.3, SUN);
  }
  else if (kind === 'heavy') {
    k += cloudPath(CLOUD, 1.7, 'M7.5 14h9.2a3.6 3.6 0 0 0 .4-7.2 5.4 5.4 0 0 0-10.2-1.3A3.9 3.9 0 0 0 7.5 14Z');
    k += drops(RAIN, [[16, 21], [16, 22], [16, 21]]);
  }
  else if (kind === 'snow') {
    k += cloudPath(CLOUD, 1.6, 'M7.5 14h9.2a3.6 3.6 0 0 0 .4-7.2 5.4 5.4 0 0 0-10.2-1.3A3.9 3.9 0 0 0 7.5 14Z');
    [9, 12, 15].forEach((x, i) => {
      const dy = i === 1 ? 2 : 0;
      k += `<line x1="${x - 1.4}" y1="${19 + dy}" x2="${x + 1.4}" y2="${19 + dy}" stroke="${SNOW}" stroke-width="1.5"/>`;
      k += `<line x1="${x}" y1="${17.6 + dy}" x2="${x}" y2="${20.4 + dy}" stroke="${SNOW}" stroke-width="1.5"/>`;
    });
  }
  else if (kind === 'storm') {
    k += cloudPath(CLOUD, 1.6, 'M7.5 14h9.2a3.6 3.6 0 0 0 .4-7.2 5.4 5.4 0 0 0-10.2-1.3A3.9 3.9 0 0 0 7.5 14Z');
    k += `<path d="M13.2 15.5h3.1l-4.6 6.8 1.1-4.6h-2.4l3.4-5.2Z" fill="${BOLT}"/>`;
  }
  return svgWrap(size, k);
}

function windArrow(dir, size, color) {
  const d = Math.round((dir || 0) / 5) * 5;
  return memoized(`a|${d}|${size}|${color || ''}`, () => windArrowRaw(d, size, color));
}
function windArrowRaw(dir, size, color) {
  const rot = (dir || 0) + 180;
  const c = color || 'currentColor';
  const inner = `<g transform="rotate(${rot} 12 12)"><line x1="12" y1="20" x2="12" y2="5" stroke="${c}" stroke-width="2.4"/><path d="M7.5 9.5 12 4.6l4.5 4.9" stroke="${c}" stroke-width="2.4" fill="none"/></g>`;
  return svgWrap(size || 13, inner);
}

const UI_PATHS = {
  drop: c => [`M12 3.5c3 3.7 5.2 6.3 5.2 9a5.2 5.2 0 0 1-10.4 0c0-2.7 2.2-5.3 5.2-9Z`],
  wind: c => [`M3 9h9.5a2.8 2.8 0 1 0-2.8-2.8`, `M3 14.5h13a3 3 0 1 1-3 3`, `M3 19.5h6`],
  gust: c => [`M2 8h10.5a3 3 0 1 0-3-3`, `M2 13h7`, `M13 13h4.5a3 3 0 1 1-3 3`, `M2 18h6`],
  humid: c => [`M12 3.5c3 3.7 5.2 6.3 5.2 9a5.2 5.2 0 0 1-10.4 0c0-2.7 2.2-5.3 5.2-9Z`, `M9.5 13.5h5`],
  sunrise: c => [`M12 3v4`, `M5.6 9.6 8 12`, `M18.4 9.6 16 12`, `M8 17a4 4 0 0 1 8 0`, `M3 21h18`],
  sunset: c => [`M12 7V3`, `M5.6 9.6 8 12`, `M18.4 9.6 16 12`, `M8 17a4 4 0 0 1 8 0`, `M3 21h18`],
  moonrise: c => [`M17 13a6 6 0 0 1-7.6-7.6A5.4 5.4 0 1 0 17 13Z`, `M3 20h18`],
  moonset: c => [`M17 13a6 6 0 0 1-7.6-7.6A5.4 5.4 0 1 0 17 13Z`, `M3 20h18`, `M9 16.5 12 19.5 15 16.5`],
  back: c => [`M15 5 8 12l7 7`],
  expand: c => [`M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9`, `M20 9V5.5A1.5 1.5 0 0 0 18.5 4H15`, `M4 15v3.5A1.5 1.5 0 0 0 5.5 20H9`, `M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15`],
  moonToggle: c => [`M20 14.5A8.5 8.5 0 0 1 9.5 4a7.5 7.5 0 1 0 10.5 10.5Z`],
  chevronDown: c => [`M6 9l6 6 6-6`]
};

function uiIcon(name, size, color) {
  return memoized(`u|${name}|${size}|${color || ''}`, () => uiIconRaw(name, size, color));
}
function uiIconRaw(name, size, color) {
  const c = color || 'currentColor', s = size || 15, w = 1.8;
  if (name === 'bike') {
    const inner = `<circle cx="6" cy="17" r="3.4" stroke="${c}" stroke-width="${w}" fill="none"/><circle cx="18" cy="17" r="3.4" stroke="${c}" stroke-width="${w}" fill="none"/><path d="M6 17l4.5-7.5H15l3 7.5" stroke="${c}" stroke-width="${w}" fill="none"/><path d="M9 9.5h4.5" stroke="${c}" stroke-width="${w}" fill="none"/>`;
    return svgWrap(s, inner);
  }
  if (name === 'run') {
    const inner = `<circle cx="14.5" cy="5" r="2.1" stroke="${c}" stroke-width="${w}" fill="none"/><path d="M13.5 10.5 10 13l2.5 3 1 5" stroke="${c}" stroke-width="${w}" fill="none"/><path d="M13.5 10.5 17 12l1.5 3.5" stroke="${c}" stroke-width="${w}" fill="none"/><path d="M12.5 16 8.5 21" stroke="${c}" stroke-width="${w}" fill="none"/><path d="M10 13 5.5 12" stroke="${c}" stroke-width="${w}" fill="none"/>`;
    return svgWrap(s, inner);
  }
  if (name === 'refresh') {
    const inner = `<path d="M20 12a8 8 0 1 1-3-6.2" stroke="${c}" stroke-width="${w}" fill="none"/><path d="M20 4v4.6h-4.6" stroke="${c}" stroke-width="${w}" fill="none"/>`;
    return svgWrap(s, inner);
  }
  if (name === 'sunToggle') {
    let inner = `<circle cx="12" cy="12" r="4.2" stroke="${c}" stroke-width="${w}" fill="none"/>`;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const x1 = 12 + Math.cos(a) * 6.6, y1 = 12 + Math.sin(a) * 6.6, x2 = 12 + Math.cos(a) * 8.6, y2 = 12 + Math.sin(a) * 8.6;
      inner += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${c}" stroke-width="${w}"/>`;
    }
    return svgWrap(s, inner);
  }
  if (name === 'pin') {
    const inner = `<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" stroke="${c}" stroke-width="${w}" fill="none"/><circle cx="12" cy="9.5" r="2.3" stroke="${c}" stroke-width="${w}" fill="none"/>`;
    return svgWrap(s, inner);
  }
  if (name === 'star') {
    const inner = `<path d="M12 3.4l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1-5.4-2.9-5.4 2.9 1.1-6.1-4.5-4.3 6.1-.8Z" fill="${c}" stroke="${c}" stroke-width="1"/>`;
    return svgWrap(s, inner);
  }
  if (name === 'starOutline') {
    const inner = `<path d="M12 3.4l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1-5.4-2.9-5.4 2.9 1.1-6.1-4.5-4.3 6.1-.8Z" stroke="${c}" stroke-width="1.5" fill="none"/>`;
    return svgWrap(s, inner);
  }
  if (name === 'close') {
    const inner = `<path d="M6 6l12 12" stroke="${c}" stroke-width="${w}"/><path d="M18 6 6 18" stroke="${c}" stroke-width="${w}"/>`;
    return svgWrap(s, inner);
  }
  const paths = (UI_PATHS[name] || (() => []))(c);
  const inner = paths.map(d => `<path d="${d}" stroke="${c}" stroke-width="${w}" fill="none"/>`).join('');
  return svgWrap(s, inner);
}
