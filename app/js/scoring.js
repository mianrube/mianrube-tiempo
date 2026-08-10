/* Reglas de negocio: puntuación por deporte, escala UV, luna, paletas. Portado del prototipo. */

function palette(light) {
  const p = light ? {
    sun: 'oklch(0.72 0.16 70)', moon: 'oklch(0.6 0.06 265)', cloud: 'oklch(0.62 0.02 250)',
    rain: 'oklch(0.55 0.15 245)', snow: 'oklch(0.68 0.04 250)', bolt: 'oklch(0.72 0.17 80)',
    warmLine: 'oklch(0.64 0.18 45)', warmSoft: 'oklch(0.72 0.07 45)', warmText: 'oklch(0.45 0.14 45)',
    tealLine: 'oklch(0.55 0.14 195)', tealSoft: 'oklch(0.7 0.07 195)', tealText: 'oklch(0.42 0.12 195)',
    rainBar: 'oklch(0.6 0.15 250)', probLine: 'oklch(0.55 0.13 235)', probText: 'oklch(0.42 0.12 240)',
    dot: 'oklch(0.995 0.003 250)', axis: 'oklch(0.58 0.02 250)', grid: 'oklch(0.88 0.008 250)',
    chip: 'oklch(0.4 0.02 255)'
  } : {
    sun: 'oklch(0.83 0.16 80)', moon: 'oklch(0.9 0.05 255)', cloud: 'oklch(0.8 0.02 250)',
    rain: 'oklch(0.74 0.14 245)', snow: 'oklch(0.95 0.02 250)', bolt: 'oklch(0.86 0.16 90)',
    warmLine: 'oklch(0.8 0.16 55)', warmSoft: 'oklch(0.72 0.06 55)', warmText: 'oklch(0.93 0.04 60)',
    tealLine: 'oklch(0.8 0.15 195)', tealSoft: 'oklch(0.7 0.09 195)', tealText: 'oklch(0.92 0.04 195)',
    rainBar: 'oklch(0.7 0.15 250)', probLine: 'oklch(0.85 0.11 235)', probText: 'oklch(0.9 0.06 235)',
    dot: 'oklch(0.2 0.02 255)', axis: 'oklch(0.6 0.02 250)', grid: 'oklch(0.32 0.02 255)',
    chip: 'oklch(0.85 0.02 250)'
  };
  p.__theme = light ? 'light' : 'dark';
  return p;
}

function uvScale(uv, light) {
  let label, h, c;
  if (uv <= 2) { label = 'Bajo'; h = 145; c = 0.14; }
  else if (uv <= 5) { label = 'Moderado'; h = 95; c = 0.15; }
  else if (uv <= 7) { label = 'Alto'; h = 60; c = 0.16; }
  else if (uv <= 10) { label = 'Muy alto'; h = 30; c = 0.17; }
  else { label = 'Extremo'; h = 340; c = 0.15; }
  if (light) return { label, color: `oklch(0.5 ${c} ${h})`, bg: `oklch(0.75 ${c} ${h} / 0.16)`, border: `oklch(0.7 ${c} ${h} / 0.5)` };
  return { label, color: `oklch(0.82 ${c} ${h})`, bg: `oklch(0.42 ${c} ${h} / 0.2)`, border: `oklch(0.6 ${c} ${h} / 0.45)` };
}

function activity(kind, t, wind, gust, prob, mm, code, hum) {
  const bike = kind === 'bike';
  let s = 100;
  const notes = [];
  if (bike) {
    if (t < 5) s -= 45; else if (t < 10) s -= 20; else if (t > 33) s -= 40; else if (t > 28) s -= 15;
    if (gust > 55) s -= 45; else if (gust > 40) s -= 28; else if (gust > 28) s -= 14;
    if (gust > 28) notes.push('rachas de ' + Math.round(gust) + ' km/h'); else if (wind < 12) notes.push('viento flojo');
  } else {
    if (t < 2) s -= 35; else if (t < 6) s -= 15; else if (t > 30) s -= 45; else if (t > 25) s -= 25; else if (t > 21) s -= 10;
    if (gust > 55) s -= 20; else if (gust > 40) s -= 10;
    if (t > 24 && hum > 70) { s -= 15; notes.push('bochorno, ritmo suave'); }
    else if (wind < 15) notes.push('viento poco molesto');
  }
  if (prob >= 70) s -= 45; else if (prob >= 40) s -= 25; else if (prob >= 20) s -= 10;
  if (mm > 1) s -= 20;
  if (code >= 95) s -= 50;
  if (prob >= 30) notes.push(prob + '% de lluvia'); else notes.push('sin lluvia prevista');
  if (t < (bike ? 8 : 4)) notes.push('frío, abriga bien'); else if (t > (bike ? 30 : 26)) notes.push('calor, lleva agua');
  const note = notes.slice(0, 2).join(' · ');
  const score = Math.max(1, Math.min(10, Math.round(s / 10)));
  if (s >= 75) return { label: 'Buenas condiciones', note, hue: 145, score };
  if (s >= 50) return { label: 'Aceptable, con cuidado', note, hue: 85, score };
  return { label: 'Mejor otro día', note, hue: 30, score };
}

function scoreHue(n) { return n >= 8 ? 145 : n >= 6 ? 105 : n >= 4 ? 65 : 25; }
function scoreStyle(n, light) {
  const h = scoreHue(n);
  return light
    ? { color: `oklch(0.42 0.15 ${h})`, bg: `oklch(0.93 0.07 ${h})`, border: `oklch(0.84 0.1 ${h})` }
    : { color: `oklch(0.88 0.16 ${h})`, bg: `oklch(0.35 0.09 ${h} / 0.75)`, border: `oklch(0.55 0.12 ${h} / 0.55)` };
}
function hourScore(kind, H, i, cv, light) {
  return activity(kind, H.temperature_2m[i], cv(H.wind_speed_10m[i]), H.wind_gusts_10m[i],
    H.precipitation_probability[i] || 0, H.precipitation[i] || 0, H.weather_code[i],
    (H.relative_humidity_2m && H.relative_humidity_2m[i]) || 60).score;
}

/* Cálculo lunar tipo SunCalc */
function moonAlt(date, lat, lon) {
  const rad = Math.PI / 180, d = date.valueOf() / 86400000 - 0.5 + 2440588 - 2451545;
  const e = rad * 23.4397, L = rad * (218.316 + 13.176396 * d), M = rad * (134.963 + 13.064993 * d), F = rad * (93.272 + 13.2293 * d);
  const l = L + rad * 6.289 * Math.sin(M), b = rad * 5.128 * Math.sin(F);
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  const th = rad * (280.16 + 360.9856235 * d) - rad * -lon, H = th - ra, phi = rad * lat;
  return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
}
function moonTimes(lat, lon) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  let rise = null, set = null, prev = moonAlt(start, lat, lon);
  for (let m = 20; m <= 1440; m += 20) {
    const t = new Date(start.getTime() + m * 60000), a = moonAlt(t, lat, lon);
    if (prev < 0 && a >= 0 && !rise) rise = t;
    if (prev > 0 && a <= 0 && !set) set = t;
    prev = a;
  }
  const f = t => t ? String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0') : '—';
  const toMin = t => t ? t.getHours() * 60 + t.getMinutes() : null;
  return { rise: f(rise), set: f(set), riseMin: toMin(rise), setMin: toMin(set) };
}
function moonPhase() {
  const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);
  let p = ((Date.now() - ref) / 86400000 / syn) % 1; if (p < 0) p += 1;
  const lit = Math.round((1 - Math.cos(p * 2 * Math.PI)) / 2 * 100);
  const names = ['nueva', 'creciente', 'en cuarto creciente', 'gibosa creciente', 'llena', 'gibosa menguante', 'en cuarto menguante', 'menguante'];
  return { name: names[Math.round(p * 8) % 8], lit };
}

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
function dirLabel(deg) { return DIRS[Math.round((deg % 360) / 45) % 8]; }
function probColor(pr, light) {
  return pr >= 50 ? (light ? 'oklch(0.5 0.15 245)' : 'oklch(0.78 0.14 245)')
    : pr >= 20 ? (light ? 'oklch(0.58 0.09 245)' : 'oklch(0.75 0.08 245)')
    : 'var(--muted2)';
}
function mmColor(mm, light) {
  return mm > 0 ? (light ? 'oklch(0.52 0.12 250)' : 'oklch(0.72 0.11 250)') : 'var(--muted3)';
}
