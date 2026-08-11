/* Reglas de negocio: puntuación por deporte, escala UV, luna, paletas. Portado del prototipo. */

function palette(light) {
  const p = light ? {
    sun: 'oklch(0.72 0.16 70)', moon: 'oklch(0.6 0.06 265)', cloud: 'oklch(0.62 0.02 250)',
    rain: 'oklch(0.55 0.15 245)', snow: 'oklch(0.68 0.04 250)', bolt: 'oklch(0.72 0.17 80)',
    warmLine: 'oklch(0.64 0.18 45)', warmSoft: 'oklch(0.72 0.07 45)', warmText: 'oklch(0.45 0.14 45)',
    tealLine: 'oklch(0.55 0.14 195)', tealSoft: 'oklch(0.7 0.07 195)', tealText: 'oklch(0.42 0.12 195)',
    rainBar: 'oklch(0.6 0.15 250)', probLine: 'oklch(0.55 0.13 235)', probText: 'oklch(0.42 0.12 240)',
    humidLine: 'oklch(0.56 0.13 285)', humidSoft: 'oklch(0.7 0.06 285)', humidText: 'oklch(0.45 0.12 285)',
    dot: 'oklch(0.995 0.003 250)', axis: 'oklch(0.58 0.02 250)', grid: 'oklch(0.88 0.008 250)',
    chip: 'oklch(0.4 0.02 255)'
  } : {
    sun: 'oklch(0.83 0.16 80)', moon: 'oklch(0.9 0.05 255)', cloud: 'oklch(0.8 0.02 250)',
    rain: 'oklch(0.74 0.14 245)', snow: 'oklch(0.95 0.02 250)', bolt: 'oklch(0.86 0.16 90)',
    warmLine: 'oklch(0.8 0.16 55)', warmSoft: 'oklch(0.72 0.06 55)', warmText: 'oklch(0.93 0.04 60)',
    tealLine: 'oklch(0.8 0.15 195)', tealSoft: 'oklch(0.7 0.09 195)', tealText: 'oklch(0.92 0.04 195)',
    rainBar: 'oklch(0.7 0.15 250)', probLine: 'oklch(0.85 0.11 235)', probText: 'oklch(0.9 0.06 235)',
    humidLine: 'oklch(0.78 0.13 285)', humidSoft: 'oklch(0.68 0.08 285)', humidText: 'oklch(0.88 0.06 285)',
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

function aqiScale(aqi, light) {
  let label, h;
  if (aqi <= 20) { label = 'Buena'; h = 145; }
  else if (aqi <= 40) { label = 'Aceptable'; h = 95; }
  else if (aqi <= 60) { label = 'Moderada'; h = 70; }
  else if (aqi <= 80) { label = 'Mala'; h = 40; }
  else if (aqi <= 100) { label = 'Muy mala'; h = 20; }
  else { label = 'Extrema'; h = 320; }
  if (light) return { label, color: `oklch(0.5 0.15 ${h})`, bg: `oklch(0.75 0.15 ${h} / 0.16)`, border: `oklch(0.7 0.15 ${h} / 0.5)` };
  return { label, color: `oklch(0.82 0.15 ${h})`, bg: `oklch(0.42 0.15 ${h} / 0.2)`, border: `oklch(0.6 0.15 ${h} / 0.45)` };
}

function pollenScale(v, light) {
  let label, h;
  if (v < 10) { label = 'Bajo'; h = 145; }
  else if (v < 50) { label = 'Moderado'; h = 85; }
  else if (v < 150) { label = 'Alto'; h = 40; }
  else { label = 'Muy alto'; h = 20; }
  if (light) return { label, color: `oklch(0.5 0.13 ${h})`, bg: `oklch(0.75 0.13 ${h} / 0.16)`, border: `oklch(0.7 0.13 ${h} / 0.5)` };
  return { label, color: `oklch(0.82 0.13 ${h})`, bg: `oklch(0.4 0.1 ${h} / 0.22)`, border: `oklch(0.6 0.11 ${h} / 0.45)` };
}

/* ---------- Outdoor Training Weather Score v2 ---------- */
/* Portado de la especificación outdoor-training-weather-v2 (curvas, pesos, penalizaciones y hard caps). */

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function interpolateScore(value, points) {
  if (value <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1], [x2, y2] = points[i];
    if (value <= x2) { const factor = (value - x1) / (x2 - x1); return y1 + factor * (y2 - y1); }
  }
  return points[points.length - 1][1];
}

const RUN_TEMP_POINTS = [[-15, 0], [-10, 20], [-5, 40], [0, 60], [5, 80], [8, 90], [10, 100], [16, 100], [19, 90], [22, 80], [25, 65], [28, 50], [30, 40], [32, 30], [35, 15], [38, 5], [42, 0]];
const RUN_WIND_POINTS = [[0, 100], [10, 100], [15, 95], [20, 90], [25, 80], [30, 70], [35, 60], [40, 50], [45, 40], [50, 30], [60, 15], [70, 0]];
const RUN_GUST_POINTS = [[0, 100], [20, 100], [30, 90], [40, 80], [50, 60], [60, 40], [70, 20], [80, 0]];
const RUN_PRECIP_POINTS = [[0.0, 100], [0.2, 95], [0.5, 90], [1.0, 80], [2.0, 70], [3.0, 55], [5.0, 40], [8.0, 25], [12.0, 10], [20.0, 0]];
const RUN_VISIBILITY_POINTS = [[0, 20], [200, 20], [500, 40], [1000, 60], [2000, 80], [5000, 100]];

const BIKE_TEMP_POINTS = [[-15, 0], [-10, 10], [-5, 30], [0, 50], [5, 70], [8, 85], [12, 95], [15, 100], [21, 100], [24, 90], [27, 80], [30, 65], [32, 50], [35, 30], [38, 10], [42, 0]];
const BIKE_WIND_POINTS = [[0, 100], [8, 100], [12, 95], [15, 90], [20, 80], [25, 65], [30, 50], [35, 35], [40, 25], [45, 15], [55, 5], [65, 0]];
const BIKE_GUST_POINTS = [[0, 100], [15, 100], [25, 95], [30, 90], [35, 80], [40, 70], [45, 55], [50, 40], [55, 30], [60, 20], [70, 5], [80, 0]];
const BIKE_PRECIP_POINTS = [[0.0, 100], [0.1, 95], [0.2, 90], [0.5, 75], [1.0, 60], [2.0, 40], [3.0, 25], [5.0, 10], [8.0, 0]];
const BIKE_VISIBILITY_POINTS = [[0, 0], [200, 0], [500, 10], [1000, 30], [2000, 50], [5000, 80], [10000, 100]];

function humidityPenalty(apparentTemperature, relativeHumidity) {
  if (apparentTemperature <= 18) return 0;
  const heatFactor = clamp((apparentTemperature - 18) / 14, 0, 1);
  let penalty = 0;
  if (relativeHumidity > 60) penalty = ((relativeHumidity - 60) / 40) * 40;
  return clamp(penalty * heatFactor, 0, 40);
}
function solarPenalty(radiation, apparentTemperature) {
  if (apparentTemperature < 18) return 0;
  const base = interpolateScore(radiation, [[0, 0], [300, 0], [500, 3], [700, 8], [900, 15], [1100, 20]]);
  const heatFactor = clamp((apparentTemperature - 18) / 12, 0, 1);
  return base * heatFactor;
}
function uvPenalty(uvIndex) {
  return interpolateScore(uvIndex, [[0, 0], [2, 0], [3, 1], [5, 3], [6, 5], [7, 7], [8, 10], [10, 15], [11, 18], [13, 22]]);
}
function gustVariabilityPenalty(windSpeed, windGust) {
  const delta = Math.max(0, windGust - windSpeed);
  return interpolateScore(delta, [[0, 0], [10, 0], [15, 2], [20, 5], [25, 10], [30, 15], [40, 20]]);
}
function rainProbabilityPenalty(precipitation, probability) {
  if (precipitation >= 0.2) return 0;
  return interpolateScore(probability, [[0, 0], [20, 0], [40, 2], [60, 5], [80, 8], [100, 10]]);
}

function getRunHardCap(w) {
  let cap = 100;
  const code = w.weatherCode;
  if ([95, 96, 99].includes(code)) cap = Math.min(cap, 10);
  if ([56, 57, 66, 67].includes(code)) cap = Math.min(cap, 10);
  if ([75, 86].includes(code)) cap = Math.min(cap, 25);
  if (w.windGust >= 80) cap = Math.min(cap, 10); else if (w.windGust >= 70) cap = Math.min(cap, 25);
  if (w.apparentTemperature >= 40) cap = Math.min(cap, 10);
  return cap;
}
function getBikeHardCap(w) {
  let cap = 100;
  const code = w.weatherCode;
  if ([95, 96, 99].includes(code)) cap = Math.min(cap, 5);
  if ([56, 57, 66, 67].includes(code)) cap = 0;
  if ([75, 86].includes(code)) cap = Math.min(cap, 10);
  if (w.windGust >= 80) cap = 0; else if (w.windGust >= 70) cap = Math.min(cap, 10); else if (w.windGust >= 60) cap = Math.min(cap, 30); else if (w.windGust >= 50) cap = Math.min(cap, 50);
  if (w.visibility < 200) cap = Math.min(cap, 10); else if (w.visibility < 500) cap = Math.min(cap, 30);
  return cap;
}

function buildWeatherInput(o) {
  return {
    temperature: o.temperature, apparentTemperature: o.apparentTemperature,
    relativeHumidity: o.relativeHumidity != null ? o.relativeHumidity : 60,
    precipitation: o.precipitation || 0, precipitationProbability: o.precipitationProbability || 0,
    weatherCode: o.weatherCode,
    windSpeed: o.windSpeed, windGust: o.windGust,
    visibility: o.visibility != null ? o.visibility : 10000,
    shortwaveRadiation: o.shortwaveRadiation || 0,
    uvIndex: o.uvIndex || 0
  };
}

function calculateScore(kind, w) {
  const bike = kind === 'bike';
  const temperature = interpolateScore(w.apparentTemperature, bike ? BIKE_TEMP_POINTS : RUN_TEMP_POINTS);
  const wind = interpolateScore(w.windSpeed, bike ? BIKE_WIND_POINTS : RUN_WIND_POINTS);
  const gusts = interpolateScore(w.windGust, bike ? BIKE_GUST_POINTS : RUN_GUST_POINTS);
  const precipitation = interpolateScore(w.precipitation, bike ? BIKE_PRECIP_POINTS : RUN_PRECIP_POINTS);
  const visibility = interpolateScore(w.visibility, bike ? BIKE_VISIBILITY_POINTS : RUN_VISIBILITY_POINTS);

  const humidity = humidityPenalty(w.apparentTemperature, w.relativeHumidity) * (bike ? 0.6 : 1);
  const solarRadiation = solarPenalty(w.shortwaveRadiation, w.apparentTemperature);
  const uv = uvPenalty(w.uvIndex);
  const gustVariability = gustVariabilityPenalty(w.windSpeed, w.windGust) * (bike ? 1 : 0.4);
  const rainProbability = rainProbabilityPenalty(w.precipitation, w.precipitationProbability) * (bike ? 1 : 0.6);

  const base = bike
    ? temperature * 0.27 + wind * 0.27 + gusts * 0.16 + precipitation * 0.20 + visibility * 0.08 + 100 * 0.02
    : temperature * 0.42 + wind * 0.18 + gusts * 0.10 + precipitation * 0.17 + visibility * 0.08 + 100 * 0.05;

  let score = base - humidity - solarRadiation - uv - gustVariability - rainProbability;
  score = clamp(score, 0, 100);
  const hardCap = bike ? getBikeHardCap(w) : getRunHardCap(w);
  score = Math.round(Math.min(score, hardCap));

  return {
    score, hardCap,
    components: { temperature, wind, gusts, precipitation, visibility },
    penalties: { humidity, solarRadiation, uv, gustVariability, rainProbability }
  };
}

const SCORE_TIERS = [
  { min: 90, status: 'excellent', label: 'Excelente', hue: 150 },
  { min: 80, status: 'very_good', label: 'Muy bueno', hue: 145 },
  { min: 70, status: 'good', label: 'Bueno', hue: 100 },
  { min: 60, status: 'acceptable', label: 'Aceptable', hue: 85 },
  { min: 50, status: 'regular', label: 'Regular', hue: 70 },
  { min: 35, status: 'bad', label: 'Malo', hue: 50 },
  { min: 20, status: 'very_bad', label: 'Muy malo', hue: 25 },
  { min: 0, status: 'avoid', label: 'Evitar', hue: 15 }
];
function scoreTier(score) { return SCORE_TIERS.find(t => score >= t.min) || SCORE_TIERS[SCORE_TIERS.length - 1]; }
function scoreStyle100(score, light) {
  const h = scoreTier(score).hue;
  return light
    ? { color: `oklch(0.42 0.16 ${h})`, bg: `oklch(0.93 0.08 ${h})`, border: `oklch(0.83 0.11 ${h})` }
    : { color: `oklch(0.88 0.17 ${h})`, bg: `oklch(0.35 0.1 ${h} / 0.75)`, border: `oklch(0.55 0.13 ${h} / 0.55)` };
}

const FACTOR_TEXT_ES = {
  ideal_temperature: 'La temperatura es ideal', good_temperature: 'La temperatura es agradable',
  cold: 'La temperatura es fría', very_cold: 'El frío es intenso',
  heat: 'El calor reduce la comodidad', extreme_heat: 'La sensación térmica es extremadamente alta',
  high_humidity: 'La humedad aumenta el estrés térmico',
  moderate_wind: 'El viento puede resultar molesto', strong_wind: 'El viento es fuerte',
  strong_gusts: 'Las rachas de viento son fuertes', unstable_gusts: 'Las rachas son muy variables respecto al viento sostenido',
  extreme_wind: 'Las rachas de viento son extremas',
  dry: 'No se espera precipitación relevante', light_rain: 'Se espera lluvia ligera',
  heavy_rain: 'La precipitación es intensa', rain_risk: 'Existe una probabilidad relevante de lluvia',
  good_visibility: 'La visibilidad es buena', poor_visibility: 'La visibilidad es reducida',
  very_poor_visibility: 'La visibilidad es muy reducida',
  high_uv: 'El índice UV es elevado', very_high_uv: 'El índice UV es muy elevado',
  strong_solar_radiation: 'La radiación solar aumenta el estrés por calor',
  snow: 'Se esperan condiciones de nieve', freezing_rain: 'Existe precipitación engelante',
  thunderstorm: 'Hay condiciones de tormenta'
};
function lc(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }

function pickFactors(kind, w, comps, pens) {
  const bike = kind === 'bike';
  const optMin = bike ? 15 : 10, optMax = bike ? 21 : 16;
  const t = w.apparentTemperature;
  let tempFactor;
  if (t >= optMin && t <= optMax) tempFactor = 'ideal_temperature';
  else if (t >= optMin - 4 && t <= optMax + 4) tempFactor = 'good_temperature';
  else if (t < optMin - 9) tempFactor = 'very_cold';
  else if (t < optMin) tempFactor = 'cold';
  else if (t > optMax + 12) tempFactor = 'extreme_heat';
  else tempFactor = 'heat';

  let positive = null;
  const negatives = [];
  if (tempFactor === 'ideal_temperature' || tempFactor === 'good_temperature') positive = tempFactor;
  else negatives.push({ f: tempFactor, loss: 100 - comps.temperature });

  if (pens.humidity > 8) negatives.push({ f: 'high_humidity', loss: pens.humidity });
  if (w.windGust >= (bike ? 45 : 50)) negatives.push({ f: 'strong_gusts', loss: 100 - comps.gusts });
  else if (pens.gustVariability > 6) negatives.push({ f: 'unstable_gusts', loss: pens.gustVariability });
  if (w.windSpeed >= (bike ? 30 : 35)) negatives.push({ f: 'strong_wind', loss: 100 - comps.wind });
  else if (w.windSpeed >= (bike ? 18 : 20)) negatives.push({ f: 'moderate_wind', loss: (100 - comps.wind) * 0.5 });

  if (w.precipitation > 2) negatives.push({ f: 'heavy_rain', loss: 100 - comps.precipitation });
  else if (w.precipitation > 0) negatives.push({ f: 'light_rain', loss: 100 - comps.precipitation });
  else if (w.precipitationProbability >= 40) negatives.push({ f: 'rain_risk', loss: pens.rainProbability + 5 });
  else if (!positive) positive = 'dry';

  if (w.visibility < 500) negatives.push({ f: 'very_poor_visibility', loss: 100 - comps.visibility });
  else if (w.visibility < 1500) negatives.push({ f: 'poor_visibility', loss: 100 - comps.visibility });

  if (w.uvIndex >= 11) negatives.push({ f: 'very_high_uv', loss: pens.uv });
  else if (w.uvIndex >= 8) negatives.push({ f: 'high_uv', loss: pens.uv });
  if (pens.solarRadiation > 10) negatives.push({ f: 'strong_solar_radiation', loss: pens.solarRadiation });

  const code = w.weatherCode;
  let critical = null;
  if ([95, 96, 99].includes(code)) critical = 'thunderstorm';
  else if ([56, 57, 66, 67].includes(code)) critical = 'freezing_rain';
  else if ([75, 86].includes(code)) critical = 'snow';
  else if (w.windGust >= 70) critical = 'extreme_wind';
  else if (w.visibility < 200) critical = 'very_poor_visibility';
  else if (t >= 40) critical = 'extreme_heat';

  negatives.sort((a, b) => b.loss - a.loss);
  return { positive, negatives: negatives.slice(0, 2).map(n => n.f), critical };
}

function buildDescription(status, factors, sportName) {
  const pos = FACTOR_TEXT_ES[factors.positive] || 'Las condiciones generales son favorables';
  const neg0 = factors.negatives[0] ? FACTOR_TEXT_ES[factors.negatives[0]] : '';
  const neg1 = factors.negatives[1] ? FACTOR_TEXT_ES[factors.negatives[1]] : '';
  if (factors.critical) return `${FACTOR_TEXT_ES[factors.critical]}. Se recomienda evitar la salida para ${sportName} mientras se mantenga esta situación.`;
  switch (status) {
    case 'excellent': return `Condiciones excelentes para ${sportName}. ${pos}. No se esperan factores meteorológicos relevantes que dificulten el entrenamiento.`;
    case 'very_good': return `Muy buenas condiciones para ${sportName}. ${pos}${neg0 ? '. ' + neg0 : ''}.`;
    case 'good': return `Buenas condiciones para ${sportName}. ${pos}${neg0 ? ', aunque ' + lc(neg0) : ''}.`;
    case 'acceptable': return `Condiciones aceptables para ${sportName}. ${neg0 || pos}${neg1 ? '. ' + neg1 : ''}.`;
    case 'regular': return `Condiciones regulares para ${sportName}. ${neg0}${neg1 ? '. ' + neg1 : ''}. El entrenamiento resulta menos favorable en estas condiciones.`;
    case 'bad': return `Condiciones poco favorables para ${sportName}. ${neg0}${neg1 ? '. ' + neg1 : ''}. Conviene valorar una alternativa o ajustar el entrenamiento.`;
    case 'very_bad': return `Condiciones muy desfavorables para ${sportName}. ${neg0}${neg1 ? '. ' + neg1 : ''}. La salida no resulta recomendable en estas condiciones.`;
    default: return `Condiciones no recomendables para ${sportName}. ${neg0 || 'las condiciones actuales desaconsejan la salida'}. Se aconseja evitar la salida mientras se mantenga esta situación.`;
  }
}

function activity(kind, w, sportName) {
  const r = calculateScore(kind, w);
  const tier = scoreTier(r.score);
  const factors = pickFactors(kind, w, r.components, r.penalties);
  const note = buildDescription(tier.status, factors, sportName);
  return { score: r.score, status: tier.status, label: tier.label, hue: tier.hue, note };
}

function scoreHue100(score) { return scoreTier(score).hue; }
function hourScore(kind, H, i, cv, light) {
  const w = buildWeatherInput({
    temperature: H.temperature_2m[i], apparentTemperature: H.apparent_temperature[i],
    relativeHumidity: H.relative_humidity_2m ? H.relative_humidity_2m[i] : 60,
    precipitation: H.precipitation[i] || 0, precipitationProbability: H.precipitation_probability[i] || 0,
    weatherCode: H.weather_code[i],
    windSpeed: cv(H.wind_speed_10m[i]), windGust: cv(H.wind_gusts_10m[i]),
    visibility: H.visibility ? H.visibility[i] : undefined,
    shortwaveRadiation: H.shortwave_radiation ? H.shortwave_radiation[i] : undefined,
    uvIndex: H.uv_index ? H.uv_index[i] : undefined
  });
  return calculateScore(kind, w).score;
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

/* Color por velocidad de viento (km/h), verde=calma a rojo=fuerte. Pensado para marcar sobre mapa (fondo claro). */
function windSpeedColor(kmh) {
  const v = kmh || 0;
  const hue = v < 8 ? 155 : v < 16 ? 110 : v < 25 ? 75 : v < 35 ? 45 : 20;
  return 'oklch(0.56 0.17 ' + hue + ')';
}
