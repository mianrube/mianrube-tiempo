/* Motor de análisis de ruta: segmentación, física de ritmo, viento relativo y puntuación por tramo. */

const ROUTE_TARGET_MIN = 15;      // duración objetivo de cada tramo (min), antes de ajustar por física real
const ROUTE_MIN_SEGMENT_KM = 2;   // longitud mínima de un tramo "normal" (por distancia/tiempo)
const ROUTE_TURN_MIN_KM = 2;      // no cortamos por giro brusco si el tramo aún no llega a esta distancia
const ROUTE_TURN_ANGLE_DEG = 90;  // desviación respecto al rumbo de inicio del tramo que fuerza un corte anticipado;
                                   // solo cambios de sentido/herraduras reales. La curvatura moderada no necesita
                                   // cortar, porque el rumbo del tramo se calcula por media circular (ver
                                   // circularMeanBearing), no por la cuerda extremo-a-extremo.
const ROUTE_BEARING_SMOOTH_M = 25; // tolerancia (m) para suavizar el rumbo punto-a-punto antes de segmentar,
                                    // clave en GPX densos (1 punto/seg de reloj/ciclocomputador) donde el ruido
                                    // GPS entre puntos consecutivos es mayor que la distancia entre ellos
const ROUTE_MAX_SEGMENTS = 24;    // techo de tramos (y por tanto de coordenadas a consultar)
const ROUTE_GRID_DEG = 0.03;      // ~3.3km: tramos cuyo punto medio cae en la misma celda comparten petición
const ROUTE_HORIZON_DAYS = 14;    // horizonte de previsión horaria de Open-Meteo

/* Física simplificada de ciclismo de carretera. Solo busca una estimación razonable, no un simulador. */
const BIKE_MASS_KG = 78;   // ciclista + bici, por defecto
const BIKE_CRR = 0.005;    // resistencia a la rodadura, asfalto
const BIKE_CDA = 0.32;     // coeficiente aerodinámico, posición en manetas
const AIR_RHO = 1.225;     // densidad del aire a nivel del mar
const G = 9.81;
const BIKE_MIN_SPEED_KMH = 6;
const BIKE_MAX_SPEED_KMH = 65;
const RUN_MIN_SPEED_KMH = 3;
const RUN_MAX_SPEED_KMH = 22;

class RouteError extends Error {}

/* Potencia (W) necesaria para mantener paceKmh en llano y sin viento, con la física por defecto. */
function impliedPowerWatts(paceKmh) {
  const v = paceKmh / 3.6;
  const frr = BIKE_CRR * BIKE_MASS_KG * G;
  const fair = 0.5 * AIR_RHO * BIKE_CDA * v * v;
  return (frr + fair) * v;
}

/* Velocidad (km/h) que produce esa potencia dada una pendiente (fracción, + = subida) y un viento de cara (m/s, + = de cara). */
function speedForPowerKmh(powerW, gradeFraction, headwindMs) {
  const angle = Math.atan(gradeFraction);
  const cosA = Math.cos(angle), sinA = Math.sin(angle);
  function powerAt(v) {
    if (v <= 0) return 0;
    const frr = BIKE_CRR * BIKE_MASS_KG * G * cosA;
    const fgrade = BIKE_MASS_KG * G * sinA;
    const airSpeed = v + headwindMs;
    const fair = 0.5 * AIR_RHO * BIKE_CDA * airSpeed * Math.abs(airSpeed);
    return (frr + fgrade + fair) * v;
  }
  let lo = 0.3, hi = 30; // 1-108 km/h en m/s
  if (powerAt(hi) < powerW) { /* pendiente/viento imposibles: nos quedamos en el techo, se recorta después */ }
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (powerAt(mid) < powerW) lo = mid; else hi = mid;
  }
  const v = (lo + hi) / 2;
  return Math.max(BIKE_MIN_SPEED_KMH, Math.min(BIKE_MAX_SPEED_KMH, v * 3.6));
}

/* Ritmo de carrera ajustado por pendiente (sin física de viento: a ritmo de correr, el aire pesa poco en el balance de esfuerzo). */
function runSpeedForGradeKmh(paceKmh, gradeFraction) {
  const g = gradeFraction * 100; // % de pendiente
  const factor = g >= 0 ? 1 + g * 0.06 : 1 + g * 0.025; // cuesta arriba penaliza más de lo que ayuda cuesta abajo
  const v = paceKmh / Math.max(0.5, factor);
  return Math.max(RUN_MIN_SPEED_KMH, Math.min(RUN_MAX_SPEED_KMH, v));
}

/* ---------- segmentación ---------- */

/* Punto interpolado a una distancia acumulada dada (m), buscando entre points (ya con .dist). */
function pointAtDistance(points, targetDist) {
  if (targetDist <= points[0].dist) return points[0];
  const last = points[points.length - 1];
  if (targetDist >= last.dist) return last;
  let lo = 0, hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].dist <= targetDist) lo = mid; else hi = mid;
  }
  const a = points[lo], b = points[hi];
  const f = (targetDist - a.dist) / (b.dist - a.dist || 1);
  return {
    lat: a.lat + f * (b.lat - a.lat),
    lon: a.lon + f * (b.lon - a.lon),
    ele: a.ele + f * (b.ele - a.ele),
    dist: targetDist
  };
}

/* Divide la ruta en tramos de ~ROUTE_TARGET_MIN minutos (estimado con paceKmh plano), con mínimo y máximo. */
/*
 * Corta la ruta en tramos cuando se alcanza la distancia objetivo (~ROUTE_TARGET_MIN a paceKmh) O cuando
 * el giro acumulado desde el inicio del tramo supera ROUTE_TURN_ANGLE_DEG (y ya se lleva al menos
 * ROUTE_TURN_MIN_KM), lo que ocurra antes. Así el rumbo de cada tramo representa de verdad por dónde
 * se va, en vez de la cuerda recta entre extremos de un tramo que puede contener giros radicales.
 * Si el resultado supera ROUTE_MAX_SEGMENTS (carreteras muy sinuosas), fusiona los tramos más cortos
 * hasta caber en el tope.
 */
function buildSegments(points, paceKmh) {
  const totalDist = points[points.length - 1].dist;
  let targetDistM = paceKmh * (ROUTE_TARGET_MIN / 60) * 1000;
  targetDistM = Math.max(targetDistM, ROUTE_MIN_SEGMENT_KM * 1000);
  const turnMinM = ROUTE_TURN_MIN_KM * 1000;

  // Comparamos contra el rumbo del INICIO del tramo (no acumulamos giro paso a paso): una carretera con
  // eses que oscila pero vuelve a un rumbo medio parecido no debe cortar, solo un cambio de sentido real
  // que aleje el rumbo de forma sostenida.
  const boundaries = [0];
  let segStartIdx = 0;
  for (let i = 1; i < points.length; i++) {
    const distSinceStart = points[i].dist - points[segStartIdx].dist;
    const devFromStart = angleDiff(points[segStartIdx].bearing, points[i].bearing);
    const isLast = i === points.length - 1;
    if (distSinceStart >= targetDistM || (devFromStart >= ROUTE_TURN_ANGLE_DEG && distSinceStart >= turnMinM) || isLast) {
      boundaries.push(i);
      segStartIdx = i;
    }
  }

  while (boundaries.length - 1 > ROUTE_MAX_SEGMENTS) {
    let bestP = 1, bestCost = Infinity;
    for (let p = 1; p < boundaries.length - 1; p++) {
      const cost = (points[boundaries[p]].dist - points[boundaries[p - 1]].dist) + (points[boundaries[p + 1]].dist - points[boundaries[p]].dist);
      if (cost < bestCost) { bestCost = cost; bestP = p; }
    }
    boundaries.splice(bestP, 1);
  }

  const segments = [];
  for (let s = 0; s < boundaries.length - 1; s++) {
    const startPt = points[boundaries[s]], endPt = points[boundaries[s + 1]];
    const startDist = startPt.dist, endDist = endPt.dist;
    const midPt = pointAtDistance(points, (startDist + endDist) / 2);
    const distanceM = endDist - startDist;
    const eleDelta = endPt.ele - startPt.ele;
    const gradeFraction = distanceM > 0 ? eleDelta / distanceM : 0;
    segments.push({
      index: s, startDist, endDist, distanceM,
      startLat: startPt.lat, startLon: startPt.lon,
      midLat: midPt.lat, midLon: midPt.lon,
      bearingDeg: circularMeanBearing(points, boundaries[s], boundaries[s + 1]),
      gradeFraction, eleStart: startPt.ele, eleEnd: endPt.ele
    });
  }
  return segments;
}

/*
 * Rumbo representativo de un tramo: media circular de los rumbos locales entre startIdx y endIdx,
 * ponderada por la distancia de cada tramo local. A diferencia de la cuerda recta extremo-a-extremo,
 * sigue siendo fiel aunque el tramo tenga curvatura moderada (no solo cuando es una recta perfecta).
 */
function circularMeanBearing(points, startIdx, endIdx) {
  let sx = 0, sy = 0;
  for (let j = startIdx; j < endIdx; j++) {
    const w = points[j + 1].dist - points[j].dist;
    if (w <= 0) continue;
    const rad = toRad(points[j].bearing);
    sx += w * Math.sin(rad);
    sy += w * Math.cos(rad);
  }
  if (sx === 0 && sy === 0) return bearing(points[startIdx].lat, points[startIdx].lon, points[endIdx].lat, points[endIdx].lon);
  return (toDeg(Math.atan2(sx, sy)) + 360) % 360;
}

/* Agrupa tramos cuyo punto medio cae en la misma celda de rejilla, para minimizar peticiones. */
function assignCoordGroups(segments) {
  const groups = new Map(); // key -> { lat, lon, segIdxs: [] }
  segments.forEach(seg => {
    const key = Math.round(seg.midLat / ROUTE_GRID_DEG) + '_' + Math.round(seg.midLon / ROUTE_GRID_DEG);
    if (!groups.has(key)) groups.set(key, { lat: seg.midLat, lon: seg.midLon, segIdxs: [] });
    groups.get(key).segIdxs.push(seg.index);
    seg.coordKey = key;
  });
  return groups;
}

/* ---------- previsión ---------- */

const ROUTE_HOURLY_VARS = [
  'temperature_2m', 'apparent_temperature', 'relative_humidity_2m',
  'precipitation', 'precipitation_probability', 'weather_code',
  'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
  'visibility', 'shortwave_radiation', 'uv_index'
].join(',');

function forecastDaysNeeded(startTime, estimatedDurationH) {
  const now = new Date();
  const endTime = new Date(startTime.getTime() + estimatedDurationH * 3600000);
  const hoursAhead = (endTime - now) / 3600000;
  if (hoursAhead > ROUTE_HORIZON_DAYS * 24) {
    throw new RouteError('La ruta empieza o termina fuera del horizonte de previsión (' + ROUTE_HORIZON_DAYS + ' días). Elige una fecha más cercana.');
  }
  return Math.min(ROUTE_HORIZON_DAYS, Math.max(2, Math.ceil(hoursAhead / 24) + 1));
}

async function fetchGroupForecasts(groups, startTime, estimatedDurationH) {
  const days = forecastDaysNeeded(startTime, estimatedDurationH);
  const coords = Array.from(groups.values());
  const lat = coords.map(c => c.lat.toFixed(4)).join(',');
  const lon = coords.map(c => c.lon.toFixed(4)).join(',');
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
    '&hourly=' + ROUTE_HOURLY_VARS + '&timezone=auto&forecast_days=' + days;
  const r = await fetch(url);
  if (!r.ok) throw new RouteError('No se pudo obtener la previsión (' + r.status + ')');
  const json = await r.json();
  const list = Array.isArray(json) ? json : [json];
  const keys = Array.from(groups.keys());
  const byKey = {};
  keys.forEach((k, i) => { byKey[k] = list[i]; });
  return byKey;
}

/* Calidad del aire por tramo: mismo agrupado por coordenadas que el tiempo, pero best-effort (la ruta
   se analiza igual aunque esto falle o la salida caiga fuera del horizonte de la API de calidad del aire). */
const ROUTE_POLLEN_KEYS = ['alder_pollen', 'birch_pollen', 'grass_pollen', 'mugwort_pollen', 'olive_pollen', 'ragweed_pollen'];
const ROUTE_AQI_HOURLY_VARS = ['european_aqi', 'pm2_5', 'pm10'].concat(ROUTE_POLLEN_KEYS).join(',');
const ROUTE_AQI_HORIZON_DAYS = 6;

async function fetchGroupAirQuality(groups, startTime, estimatedDurationH) {
  const now = new Date();
  const endTime = new Date(startTime.getTime() + estimatedDurationH * 3600000);
  const hoursAhead = (endTime - now) / 3600000;
  if (hoursAhead > ROUTE_AQI_HORIZON_DAYS * 24) return null; // fuera de horizonte: se omite, no rompe el análisis
  const days = Math.min(ROUTE_AQI_HORIZON_DAYS, Math.max(2, Math.ceil(hoursAhead / 24) + 1));
  const coords = Array.from(groups.values());
  const lat = coords.map(c => c.lat.toFixed(4)).join(',');
  const lon = coords.map(c => c.lon.toFixed(4)).join(',');
  const url = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + lat + '&longitude=' + lon +
    '&hourly=' + ROUTE_AQI_HOURLY_VARS + '&timezone=auto&forecast_days=' + days;
  const r = await fetch(url);
  if (!r.ok) return null;
  const json = await r.json();
  const list = Array.isArray(json) ? json : [json];
  const keys = Array.from(groups.keys());
  const byKey = {};
  keys.forEach((k, i) => { byKey[k] = list[i]; });
  return byKey;
}

/* Interpola european_aqi/pm2_5/pm10 en un instante dado, igual criterio que interpolateHourly. */
function interpolateHourlyAqi(H, date) {
  const times = H.time;
  const target = date.getTime();
  let i0 = 0;
  for (let i = 0; i < times.length - 1; i++) {
    if (new Date(times[i]).getTime() <= target) i0 = i; else break;
  }
  const i1 = Math.min(i0 + 1, times.length - 1);
  const t0 = new Date(times[i0]).getTime(), t1 = new Date(times[i1]).getTime();
  const f = t1 > t0 ? Math.max(0, Math.min(1, (target - t0) / (t1 - t0))) : 0;
  const lerp = key => H[key] ? H[key][i0] + f * ((H[key][i1] || H[key][i0]) - H[key][i0]) : undefined;
  const pollen = {};
  ROUTE_POLLEN_KEYS.forEach(k => { pollen[k] = lerp(k); });
  return { value: lerp('european_aqi'), pm25: lerp('pm2_5'), pm10: lerp('pm10'), pollen };
}

/* Elevación de puntos que no traen cota en el GPX. */
async function fetchElevationForPoints(points) {
  const step = Math.max(1, Math.floor(points.length / 100)); // como mucho ~100 consultas
  const sampled = [];
  for (let i = 0; i < points.length; i += step) sampled.push(i);
  if (sampled[sampled.length - 1] !== points.length - 1) sampled.push(points.length - 1);
  const lat = sampled.map(i => points[i].lat.toFixed(5)).join(',');
  const lon = sampled.map(i => points[i].lon.toFixed(5)).join(',');
  const url = 'https://api.open-meteo.com/v1/elevation?latitude=' + lat + '&longitude=' + lon;
  const r = await fetch(url);
  if (!r.ok) throw new RouteError('No se pudo obtener la elevación (' + r.status + ')');
  const json = await r.json();
  sampled.forEach((idx, i) => { points[idx].ele = json.elevation[i]; });
  return fillMissingElevation(points);
}

/* Interpola linealmente los campos horarios numéricos de H en un instante dado; categóricos = hora más cercana. */
function interpolateHourly(H, date) {
  const times = H.time;
  const target = date.getTime();
  let i0 = 0;
  for (let i = 0; i < times.length - 1; i++) {
    if (new Date(times[i]).getTime() <= target) i0 = i; else break;
  }
  const i1 = Math.min(i0 + 1, times.length - 1);
  const t0 = new Date(times[i0]).getTime(), t1 = new Date(times[i1]).getTime();
  const f = t1 > t0 ? Math.max(0, Math.min(1, (target - t0) / (t1 - t0))) : 0;
  const lerp = key => H[key] ? H[key][i0] + f * ((H[key][i1] || H[key][i0]) - H[key][i0]) : undefined;
  const nearest = key => H[key] ? (f < 0.5 ? H[key][i0] : H[key][i1]) : undefined;
  return {
    temperature: lerp('temperature_2m'), apparentTemperature: lerp('apparent_temperature'),
    relativeHumidity: lerp('relative_humidity_2m'),
    precipitation: lerp('precipitation'), precipitationProbability: lerp('precipitation_probability'),
    weatherCode: nearest('weather_code'),
    windSpeed: lerp('wind_speed_10m'), windDirection: lerp('wind_direction_10m'), windGust: lerp('wind_gusts_10m'),
    visibility: lerp('visibility'), shortwaveRadiation: lerp('shortwave_radiation'), uvIndex: lerp('uv_index')
  };
}

/*
 * Descompone el viento AMBIENTE respecto al rumbo del tramo (independiente de tu velocidad:
 * bajar rápido con aire en calma no es "mucho viento", es solo ir rápido).
 * headwindKmh/crosswindKmh alimentan la física del ritmo; effectiveKmh/effectiveGustKmh alimentan
 * la puntuación, dando más peso al viento cuando es de cara y menos cuando es de cola.
 */
function relativeWind(bearingDeg, windDirFromDeg, windSpeedKmh, windGustKmh) {
  const windTowardsDeg = (windDirFromDeg + 180) % 360;
  const rel = toRad(angleDiff(bearingDeg, windTowardsDeg));
  const along = windSpeedKmh * Math.cos(rel);   // + = viento a favor (empuja en el sentido de la marcha)
  const cross = Math.abs(windSpeedKmh * Math.sin(rel));
  const headwindKmh = -along; // + = de cara, para la física del ritmo

  const relFrom = toRad(angleDiff(bearingDeg, windDirFromDeg)); // 0 = el viento viene de justo delante
  const factor = Math.max(0.4, Math.min(1.6, 1 + 0.5 * Math.cos(relFrom)));
  return {
    headwindKmh, crosswindKmh: cross, isHeadwind: along < 0,
    effectiveKmh: windSpeedKmh * factor, effectiveGustKmh: windGustKmh * factor
  };
}

/* ---------- orquestación ---------- */

/**
 * Analiza una ruta GPX ya parseada.
 * @param {{points: Array}} gpx - resultado de parseGpx()
 * @param {{sport: string, paceKmh: number, startTime: Date}} opts
 */
async function analyzeRoute(gpx, opts) {
  const sport = opts.sport === 'run' ? 'run' : 'bike';
  const paceBounds = sport === 'bike' ? [8, 45] : [5, 25];
  const paceKmh = Math.max(paceBounds[0], Math.min(paceBounds[1], opts.paceKmh || (sport === 'bike' ? 30 : 10)));
  const startTime = opts.startTime;
  if (isNaN(startTime.getTime())) throw new RouteError('Indica una hora de salida válida');
  if (startTime.getTime() < Date.now() - 30 * 60000) throw new RouteError('La hora de salida debe ser futura');

  const points = gpx.points.map(p => ({ lat: p.lat, lon: p.lon, ele: p.ele }));
  enrichWithDistanceAndBearing(points);
  smoothBearings(points, ROUTE_BEARING_SMOOTH_M);
  if (!hasElevation(points)) await fetchElevationForPoints(points);
  else fillMissingElevation(points);

  const totalDistKm = points[points.length - 1].dist / 1000;
  const roughDurationH = totalDistKm / paceKmh;
  forecastDaysNeeded(startTime, roughDurationH); // valida horizonte cuanto antes

  const segments = buildSegments(points, paceKmh);
  const groups = assignCoordGroups(segments);
  const [forecasts, aqiForecasts] = await Promise.all([
    fetchGroupForecasts(groups, startTime, roughDurationH),
    fetchGroupAirQuality(groups, startTime, roughDurationH).catch(() => null)
  ]);

  const power = sport === 'bike' ? impliedPowerWatts(paceKmh) : null;
  let clock = new Date(startTime);
  let timeWeightedScoreSum = 0, totalSeconds = 0;
  let worst = null;
  let aqiWeightedSum = 0, aqiSeconds = 0, worstAqiSegment = null;
  let maxUvIndex = 0, uvProtectionSeconds = 0; // UV >= 3: umbral OMS a partir del cual conviene protegerse
  const maxPollen = {}; ROUTE_POLLEN_KEYS.forEach(k => { maxPollen[k] = 0; });

  segments.forEach(seg => {
    const H = forecasts[seg.coordKey].hourly;
    const arrival = new Date(clock);
    const w0 = interpolateHourly(H, arrival);

    const rw = relativeWind(seg.bearingDeg, w0.windDirection || 0, w0.windSpeed || 0, w0.windGust || 0);
    const speedKmh = sport === 'bike'
      ? speedForPowerKmh(power, seg.gradeFraction, rw.headwindKmh / 3.6)
      : runSpeedForGradeKmh(paceKmh, seg.gradeFraction);
    const durationH = (seg.distanceM / 1000) / speedKmh;
    const durationSec = durationH * 3600;

    const weatherInput = buildWeatherInput({
      temperature: w0.temperature, apparentTemperature: w0.apparentTemperature,
      relativeHumidity: w0.relativeHumidity, precipitation: w0.precipitation,
      precipitationProbability: w0.precipitationProbability, weatherCode: w0.weatherCode,
      windSpeed: rw.effectiveKmh, windGust: rw.effectiveGustKmh,
      visibility: w0.visibility, shortwaveRadiation: w0.shortwaveRadiation, uvIndex: w0.uvIndex
    });
    const result = calculateScore(sport, weatherInput);

    seg.arrival = arrival;
    seg.speedKmh = speedKmh;
    seg.durationSec = durationSec;
    seg.windDirection = w0.windDirection; seg.windSpeed = w0.windSpeed; seg.windGust = w0.windGust;
    seg.headwindKmh = rw.headwindKmh; seg.crosswindKmh = rw.crosswindKmh; seg.isHeadwind = rw.isHeadwind;
    seg.weather = w0; seg.score = result.score;
    seg.weatherInput = weatherInput; seg.scoreResult = result;

    if (aqiForecasts && aqiForecasts[seg.coordKey]) {
      const aq = interpolateHourlyAqi(aqiForecasts[seg.coordKey].hourly, arrival);
      if (aq.value != null) {
        seg.aqi = aq;
        aqiWeightedSum += aq.value * durationSec;
        aqiSeconds += durationSec;
        if (!worstAqiSegment || aq.value > worstAqiSegment.aqi.value) worstAqiSegment = seg;
        ROUTE_POLLEN_KEYS.forEach(k => { if (aq.pollen[k] != null) maxPollen[k] = Math.max(maxPollen[k], aq.pollen[k]); });
      }
    }
    if (w0.uvIndex != null) {
      maxUvIndex = Math.max(maxUvIndex, w0.uvIndex);
      if (w0.uvIndex >= 3) uvProtectionSeconds += durationSec;
    }

    timeWeightedScoreSum += result.score * durationSec;
    totalSeconds += durationSec;
    if (!worst || result.score < worst.score) worst = seg;

    clock = new Date(clock.getTime() + durationSec * 1000);
  });

  const overallScore = totalSeconds > 0 ? Math.round(timeWeightedScoreSum / totalSeconds) : 0;
  const overallAqi = aqiSeconds > 0 ? Math.round(aqiWeightedSum / aqiSeconds) : null;
  const elev = elevationGainLoss(points, 5);

  return {
    sport, paceKmh, startTime, arrivalTime: clock,
    totalDistKm, totalDurationSec: totalSeconds,
    elevationGain: elev.gain, elevationLoss: elev.loss,
    overallScore, worstSegment: worst,
    overallAqi, worstAqiSegment,
    maxUvIndex, uvProtectionSeconds, maxPollen,
    segments, points
  };
}
