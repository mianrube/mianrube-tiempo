/* Parseo de GPX y geometría de rutas: distancias, rumbos, elevación, simplificación. */

const EARTH_R = 6371000; // metros

function toRad(d) { return d * Math.PI / 180; }
function toDeg(r) { return r * 180 / Math.PI; }

/* Distancia haversine entre dos puntos, en metros. */
function haversine(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/* Rumbo inicial (0-360°, 0=N) desde el punto 1 al punto 2. */
function bearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/* Diferencia angular mínima entre dos rumbos, en [0, 180]. */
function angleDiff(a, b) {
  let d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

class GpxError extends Error {}

/* Parsea el XML de un GPX y devuelve { name, points: [{lat, lon, ele}] }. Lanza GpxError si es inválido. */
function parseGpx(xmlText) {
  let doc;
  try {
    doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  } catch (e) {
    throw new GpxError('El archivo no se pudo interpretar como XML');
  }
  if (doc.querySelector('parsererror')) throw new GpxError('El archivo no es un GPX válido');
  const trkpts = Array.from(doc.querySelectorAll('trkpt, rtept'));
  if (!trkpts.length) throw new GpxError('El GPX no contiene puntos de track (trkpt)');

  const points = trkpts.map(pt => {
    const lat = parseFloat(pt.getAttribute('lat')), lon = parseFloat(pt.getAttribute('lon'));
    const eleEl = pt.querySelector('ele');
    const ele = eleEl ? parseFloat(eleEl.textContent) : null;
    return { lat, lon, ele: Number.isFinite(ele) ? ele : null };
  }).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));

  if (points.length < 2) throw new GpxError('El GPX necesita al menos 2 puntos válidos');

  const nameEl = doc.querySelector('trk > name, metadata > name');
  const name = nameEl ? nameEl.textContent.trim() : null;

  return { name, points };
}

/* Parsea el XML de un TCX (Garmin Training Center) y devuelve { name, points: [{lat, lon, ele}] }. */
function parseTcx(xmlText) {
  let doc;
  try {
    doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  } catch (e) {
    throw new GpxError('El archivo no se pudo interpretar como XML');
  }
  if (doc.querySelector('parsererror')) throw new GpxError('El archivo no es un TCX válido');
  const trkpts = Array.from(doc.querySelectorAll('Trackpoint'));
  if (!trkpts.length) throw new GpxError('El TCX no contiene puntos de track (Trackpoint)');

  const points = trkpts.map(pt => {
    const latEl = pt.querySelector('LatitudeDegrees'), lonEl = pt.querySelector('LongitudeDegrees');
    const eleEl = pt.querySelector('AltitudeMeters');
    const lat = latEl ? parseFloat(latEl.textContent) : NaN;
    const lon = lonEl ? parseFloat(lonEl.textContent) : NaN;
    const ele = eleEl ? parseFloat(eleEl.textContent) : null;
    return { lat, lon, ele: Number.isFinite(ele) ? ele : null };
  }).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));

  if (points.length < 2) throw new GpxError('El TCX necesita al menos 2 puntos válidos con posición');

  const nameEl = doc.querySelector('Course > Name, Activity > Notes');
  const name = nameEl ? nameEl.textContent.trim() : null;

  return { name, points };
}

/* Elige el parser según extensión o contenido del archivo. Devuelve { name, points }. */
function parseRouteFile(text, fileName) {
  const ext = (fileName || '').toLowerCase();
  const looksLikeTcx = ext.endsWith('.tcx') || /<TrainingCenterDatabase/i.test(text.slice(0, 500));
  return looksLikeTcx ? parseTcx(text) : parseGpx(text);
}

/* Añade distancia acumulada (m) y rumbo al siguiente punto a cada punto de la lista. Muta y devuelve points. */
function enrichWithDistanceAndBearing(points) {
  points[0].dist = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    a.bearing = bearing(a.lat, a.lon, b.lat, b.lon);
    b.dist = a.dist + haversine(a.lat, a.lon, b.lat, b.lon);
  }
  points[points.length - 1].bearing = points[points.length - 2].bearing;
  return points;
}

/*
 * Sustituye el rumbo punto-a-punto (muy ruidoso en grabaciones densas, p.ej. GPX de reloj/ciclocomputador
 * a 1 punto/segundo, donde el error normal del GPS es mayor que la distancia entre puntos consecutivos)
 * por el rumbo de una versión simplificada (Douglas-Peucker) del trazado. Cada punto se queda con el
 * rumbo del tramo simplificado al que pertenece, así que ya no responde al ruido sino a la forma real
 * de la carretera. Requiere que enrichWithDistanceAndBearing ya se haya ejecutado. Muta points en el sitio.
 */
function smoothBearings(points, toleranceMeters) {
  if (points.length < 3) return points;
  const keep = simplifyIndices(points, toleranceMeters);
  for (let k = 0; k < keep.length - 1; k++) {
    const a = keep[k], b = keep[k + 1];
    const segBearing = bearing(points[a].lat, points[a].lon, points[b].lat, points[b].lon);
    for (let i = a; i < b; i++) points[i].bearing = segBearing;
  }
  points[points.length - 1].bearing = points[points.length - 2].bearing;
  return points;
}

/* true si al menos un punto trae elevación real del GPX. */
function hasElevation(points) { return points.some(p => p.ele != null); }

/* Rellena elevaciones que falten (null) interpolando entre las conocidas más cercanas. */
function fillMissingElevation(points) {
  const known = points.map((p, i) => p.ele != null ? i : -1).filter(i => i >= 0);
  if (!known.length) return points;
  points.forEach((p, i) => {
    if (p.ele != null) return;
    const prev = known.filter(k => k <= i).pop();
    const next = known.find(k => k >= i);
    if (prev == null) p.ele = points[next].ele;
    else if (next == null) p.ele = points[prev].ele;
    else if (prev === next) p.ele = points[prev].ele;
    else {
      const f = (points[i].dist - points[prev].dist) / (points[next].dist - points[prev].dist || 1);
      p.ele = points[prev].ele + f * (points[next].ele - points[prev].ele);
    }
  });
  return points;
}

/* Simplificación Douglas-Peucker sobre [lat, lon], devuelve los índices originales que se conservan. */
function simplifyIndices(points, toleranceMeters) {
  const n = points.length;
  if (n <= 2) return points.map((_, i) => i);
  const keep = new Array(n).fill(false);
  keep[0] = keep[n - 1] = true;

  function perpDistMeters(p, a, b) {
    // Aproximación plana en metros usando equirrectangular local, suficiente para tolerancias pequeñas.
    const latRef = toRad(a.lat);
    const mPerDegLat = 111320, mPerDegLon = 111320 * Math.cos(latRef);
    const ax = a.lon * mPerDegLon, ay = a.lat * mPerDegLat;
    const bx = b.lon * mPerDegLon, by = b.lat * mPerDegLat;
    const px = p.lon * mPerDegLon, py = p.lat * mPerDegLat;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx, cy = ay + t * dy;
    return Math.hypot(px - cx, py - cy);
  }

  function recurse(startIdx, endIdx) {
    if (endIdx <= startIdx + 1) return;
    let maxDist = -1, maxIdx = -1;
    for (let i = startIdx + 1; i < endIdx; i++) {
      const d = perpDistMeters(points[i], points[startIdx], points[endIdx]);
      if (d > maxDist) { maxDist = d; maxIdx = i; }
    }
    if (maxDist > toleranceMeters) {
      keep[maxIdx] = true;
      recurse(startIdx, maxIdx);
      recurse(maxIdx, endIdx);
    }
  }
  recurse(0, n - 1);
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(i);
  return out;
}

/* Desnivel acumulado positivo/negativo con un suavizado simple para ignorar ruido del GPS. */
function elevationGainLoss(points, smoothWindow) {
  const win = smoothWindow || 5;
  const smoothed = points.map((p, i) => {
    const lo = Math.max(0, i - win), hi = Math.min(points.length - 1, i + win);
    let sum = 0, count = 0;
    for (let j = lo; j <= hi; j++) { sum += points[j].ele; count++; }
    return sum / count;
  });
  let gain = 0, loss = 0;
  for (let i = 1; i < smoothed.length; i++) {
    const d = smoothed[i] - smoothed[i - 1];
    if (d > 0) gain += d; else loss += -d;
  }
  return { gain: Math.round(gain), loss: Math.round(loss) };
}
