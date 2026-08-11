/* Generadores de gráficas SVG, portados del prototipo de diseño. */

function sp(pts) {
  if (!pts.length) return '';
  if (pts.length < 3) {
    let d0 = 'M' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
    for (let i = 1; i < pts.length; i++) d0 += ' L' + pts[i][0].toFixed(1) + ',' + pts[i][1].toFixed(1);
    return d0;
  }
  const n = pts.length;
  let d = 'M' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ' C' + c1x.toFixed(1) + ',' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ',' + c2y.toFixed(1) + ' ' + p2[0].toFixed(1) + ',' + p2[1].toFixed(1);
  }
  return d;
}

function axisSvg(labels, W, H, n, top, xf, P) {
  let out = '';
  const step = n <= 9 ? 1 : 4;
  labels.forEach((lb, i) => {
    if (i % step) return;
    const x = xf ? xf(i) : i * (W / (n - 1));
    const cx = Math.min(Math.max(x, 9), W - 9);
    out += `<text x="${cx.toFixed(1)}" y="${H - 3}" fill="${P.axis}" font-size="9" font-family="'IBM Plex Mono', monospace" text-anchor="middle">${lb}</text>`;
    out += `<line x1="${x.toFixed(1)}" y1="${top}" x2="${x.toFixed(1)}" y2="${H - 15}" stroke="${P.grid}" stroke-width="1" stroke-dasharray="2 4"/>`;
  });
  return out;
}

function svgChart(W, H, inner) {
  return `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

function scoreGauge(score, color, trackColor, mutedColor) {
  const W = 220, H = 140, cx = 110, cy = 118, r = 88, sw = 18;
  const arcD = `M${(cx - r).toFixed(1)},${cy} A${r},${r} 0 0 1 ${(cx + r).toFixed(1)},${cy}`;
  const frac = clamp(score / 100, 0, 1);
  const arcLen = Math.PI * r;
  const dash = (arcLen * frac).toFixed(1), gap = (arcLen * (1 - frac) + 2).toFixed(1);
  const inner = `
    <path d="${arcD}" fill="none" stroke="${trackColor}" stroke-width="${sw}" stroke-linecap="round"/>
    <path d="${arcD}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${dash} ${gap}"/>
    <text x="${cx}" y="${cy - 22}" text-anchor="middle" font-size="42" font-weight="800" font-family="'IBM Plex Mono', monospace" fill="${color}">${Math.round(score)}</text>
    <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="12" font-weight="700" font-family="Manrope, Helvetica, sans-serif" fill="${mutedColor}">de 100</text>
  `;
  return `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block">${inner}</svg>`;
}

function tempChart(hs, P, light) {
  const W = 352, H = 142, top = 30, bot = 20, n = hs.length;
  const vals = hs.map(h => h.t), app = hs.map(h => h.a);
  const lo = Math.min(...vals, ...app) - 1.5, hi = Math.max(...vals, ...app) + 1.5;
  const x = i => i * (W / (n - 1)), y = v => top + (H - top - bot) * (1 - (v - lo) / (hi - lo || 1));
  const p = vals.map((v, i) => [x(i), y(v)]), pa = app.map((v, i) => [x(i), y(v)]);
  const line = sp(p), area = line + ' L' + W + ',' + (H - bot) + ' L0,' + (H - bot) + ' Z';
  let marks = '';
  vals.forEach((v, i) => {
    const up = i > 0 && i < n - 1 ? (vals[i] >= vals[i - 1] ? -9 : 15) : -9;
    marks += `<circle cx="${x(i).toFixed(1)}" cy="${y(app[i]).toFixed(1)}" r="2" fill="${P.warmSoft}"/>`;
    marks += `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${n <= 9 ? 3.4 : 2.4}" fill="${P.dot}" stroke="${P.warmLine}" stroke-width="2"/>`;
    if (n <= 9 || i % 3 === 0) {
      const cx = Math.min(Math.max(x(i), 13), W - 13);
      const label = n <= 9 ? v.toFixed(1) + '°' : Math.round(v) + '°';
      marks += `<text x="${cx.toFixed(1)}" y="${(y(v) + up).toFixed(1)}" fill="${P.warmText}" font-size="${n <= 9 ? 11 : 9.5}" font-weight="700" font-family="'IBM Plex Mono', monospace" text-anchor="middle">${label}</text>`;
    }
  });
  const inner = axisSvg(hs.map(h => h.hour), W, H, n, top - 12, null, P)
    + `<path d="${area}" fill="${P.warmLine}" opacity="${light ? 0.1 : 0.14}"/>`
    + `<path d="${sp(pa)}" stroke="${P.warmSoft}" stroke-width="1.6" stroke-dasharray="4 4" fill="none"/>`
    + `<path d="${line}" stroke="${P.warmLine}" stroke-width="2.6" fill="none"/>`
    + marks;
  return svgChart(W, H, inner);
}

function windChart(hs, P, light) {
  const W = 352, H = 158, top = 50, bot = 20, n = hs.length;
  const sp_ = hs.map(h => h.w), gu = hs.map(h => h.g);
  const hi = Math.max(Math.max(...gu) * 1.2, 10), lo = 0;
  const x = i => i * (W / (n - 1)), y = v => top + (H - top - bot) * (1 - (v - lo) / (hi - lo));
  const gl = sp(gu.map((v, i) => [x(i), y(v)]));
  const sl = sp(sp_.map((v, i) => [x(i), y(v)]));
  const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'], dense = n <= 9, st = dense ? 1 : 3;
  let arrows = '';
  for (let i = 0; i < n; i++) {
    const cx = Math.min(Math.max(x(i), 13), W - 13);
    if (i % st === 0) {
      arrows += `<g transform="translate(${(cx - 8).toFixed(1)},-1)">${windArrow(hs[i].d, 16, P.tealLine)}</g>`;
      arrows += `<text x="${cx.toFixed(1)}" y="24" fill="${P.axis}" font-size="9" font-weight="600" font-family="'IBM Plex Mono', monospace" text-anchor="middle">${DIRS[Math.round((hs[i].d % 360) / 45) % 8]}</text>`;
      arrows += `<text x="${cx.toFixed(1)}" y="${(y(hs[i].w) - 8).toFixed(1)}" fill="${P.tealText}" font-size="${dense ? 10.5 : 9.5}" font-weight="700" font-family="'IBM Plex Mono', monospace" text-anchor="middle">${Math.round(hs[i].w)}</text>`;
      if (dense) arrows += `<text x="${cx.toFixed(1)}" y="${(y(hs[i].g) - 6).toFixed(1)}" fill="${P.tealSoft}" font-size="9" font-weight="600" font-family="'IBM Plex Mono', monospace" text-anchor="middle">${Math.round(hs[i].g)}</text>`;
    }
    arrows += `<circle cx="${x(i).toFixed(1)}" cy="${y(hs[i].w).toFixed(1)}" r="${dense ? 3.2 : 2.2}" fill="${P.dot}" stroke="${P.tealLine}" stroke-width="2"/>`;
  }
  const inner = axisSvg(hs.map(h => h.hour), W, H, n, top - 10, null, P)
    + `<path d="${gl + ' L' + W + ',' + (H - bot) + ' L0,' + (H - bot) + ' Z'}" fill="${P.tealLine}" opacity="0.09"/>`
    + `<path d="${gl}" stroke="${P.tealSoft}" stroke-width="1.6" stroke-dasharray="4 4" fill="none"/>`
    + `<path d="${sl + ' L' + W + ',' + (H - bot) + ' L0,' + (H - bot) + ' Z'}" fill="${P.tealLine}" opacity="${light ? 0.11 : 0.16}"/>`
    + `<path d="${sl}" stroke="${P.tealLine}" stroke-width="2.6" fill="none"/>`
    + arrows;
  return svgChart(W, H, inner);
}

function humidChart(hs, P, light) {
  const W = 352, H = 128, top = 26, bot = 20, n = hs.length;
  const vals = hs.map(h => h.hum);
  const x = i => i * (W / (n - 1)), y = v => top + (H - top - bot) * (1 - v / 100);
  const p = vals.map((v, i) => [x(i), y(v)]);
  const line = sp(p), area = line + ' L' + W + ',' + (H - bot) + ' L0,' + (H - bot) + ' Z';
  let marks = '';
  vals.forEach((v, i) => {
    marks += `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${n <= 9 ? 3.4 : 2.4}" fill="${P.dot}" stroke="${P.humidLine}" stroke-width="2"/>`;
    if (n <= 9 || i % 3 === 0) {
      const cx = Math.min(Math.max(x(i), 13), W - 13);
      marks += `<text x="${cx.toFixed(1)}" y="${(y(v) - 8).toFixed(1)}" fill="${P.humidText}" font-size="${n <= 9 ? 11 : 9.5}" font-weight="700" font-family="'IBM Plex Mono', monospace" text-anchor="middle">${Math.round(v)}%</text>`;
    }
  });
  const inner = axisSvg(hs.map(h => h.hour), W, H, n, top - 10, null, P)
    + `<path d="${area}" fill="${P.humidLine}" opacity="${light ? 0.1 : 0.14}"/>`
    + `<path d="${line}" stroke="${P.humidLine}" stroke-width="2.6" fill="none"/>`
    + marks;
  return svgChart(W, H, inner);
}

function rainChart(hs, P) {
  const W = 352, H = 134, top = 26, bot = 20, n = hs.length;
  const mm = hs.map(h => h.p), pr = hs.map(h => h.pr);
  const mmax = Math.max(Math.max(...mm), 1);
  const bw = Math.max(W / n - 16, 6);
  const cxOf = i => i * (W / n) + (W / n) / 2;
  let bars = '';
  mm.forEach((v, i) => {
    const h = v <= 0 ? 0 : Math.max((H - top - bot) * (v / mmax), 3);
    bars += `<rect x="${(cxOf(i) - bw / 2).toFixed(1)}" y="${(H - bot - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${P.rainBar}" opacity="0.8"/>`;
    if (v > 0 && n <= 9) bars += `<text x="${cxOf(i).toFixed(1)}" y="${(H - bot - h - 4).toFixed(1)}" fill="${P.probText}" font-size="9" font-weight="700" font-family="'IBM Plex Mono', monospace" text-anchor="middle">${v.toFixed(1)}</text>`;
  });
  const y = v => top + (H - top - bot) * (1 - v / 100);
  const pl = sp(pr.map((v, i) => [cxOf(i), y(v)]));
  let dots = '';
  pr.forEach((v, i) => {
    dots += `<circle cx="${cxOf(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${n <= 9 ? 3 : 2.2}" fill="${P.dot}" stroke="${P.probLine}" stroke-width="2"/>`;
    if (n <= 9 || i % 3 === 0) dots += `<text x="${cxOf(i).toFixed(1)}" y="${(y(v) - 8).toFixed(1)}" fill="${P.probText}" font-size="${n <= 9 ? 10 : 9}" font-weight="700" font-family="'IBM Plex Mono', monospace" text-anchor="middle">${v}%</text>`;
  });
  const inner = axisSvg(hs.map(h => h.hour), W, H, n, top - 12, cxOf, P)
    + bars
    + `<path d="${pl}" stroke="${P.probLine}" stroke-width="2.2" fill="none"/>`
    + dots;
  return svgChart(W, H, inner);
}

function scoreChart(hs, P, scoreStyle, scoreHue, light) {
  const W = 352, H = 118, top = 22, bot = 20, n = hs.length;
  const bw = Math.max(W / n - (n <= 9 ? 16 : 6), 4);
  const cxOf = i => i * (W / n) + (W / n) / 2;
  let bars = '';
  hs.forEach((o, i) => {
    const st = scoreStyle(o.s), h = Math.max((H - top - bot) * (o.s / 100), 3);
    bars += `<rect x="${(cxOf(i) - bw / 2).toFixed(1)}" y="${(H - bot - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="oklch(0.7 0.15 ${scoreHue(o.s)})" opacity="${light ? 0.9 : 0.85}"/>`;
    if (n <= 9 || i % 3 === 0) bars += `<text x="${cxOf(i).toFixed(1)}" y="${(H - bot - h - 5).toFixed(1)}" fill="${st.color}" font-size="${n <= 9 ? 11 : 9}" font-weight="800" font-family="'IBM Plex Mono', monospace" text-anchor="middle">${o.s}</text>`;
  });
  const inner = axisSvg(hs.map(o => o.hour), W, H, n, top - 8, cxOf, P) + bars;
  return svgChart(W, H, inner);
}

/* Perfil de altimetría de una ruta, coloreado por tramo según su puntuación. */
function elevationChart(points, segments, P, light) {
  const W = 352, H = 176, top = 16, bot = 26, n = points.length;
  const totalDist = points[n - 1].dist || 1;
  const eles = points.map(p => p.ele);
  const lo = Math.min(...eles), hi = Math.max(...eles);
  const span = (hi - lo) || 10;
  const x = d => (d / totalDist) * W;
  const y = e => top + (H - top - bot) * (1 - (e - lo) / span);

  const stride = Math.max(1, Math.floor(n / 400));
  const sampled = []; for (let i = 0; i < n; i += stride) sampled.push(points[i]);
  if (sampled[sampled.length - 1] !== points[n - 1]) sampled.push(points[n - 1]);

  let fills = '';
  segments.forEach(seg => {
    const segPts = sampled.filter(p => p.dist >= seg.startDist && p.dist <= seg.endDist);
    if (segPts.length < 2) return;
    let d = 'M' + x(segPts[0].dist).toFixed(1) + ',' + (H - bot).toFixed(1);
    segPts.forEach(p => { d += ' L' + x(p.dist).toFixed(1) + ',' + y(p.ele).toFixed(1); });
    d += ' L' + x(segPts[segPts.length - 1].dist).toFixed(1) + ',' + (H - bot).toFixed(1) + ' Z';
    const hue = scoreHue100(seg.score);
    fills += `<path d="${d}" fill="oklch(0.68 0.15 ${hue})" opacity="${light ? 0.55 : 0.5}"/>`;
  });

  const line = sp(sampled.map(p => [x(p.dist), y(p.ele)]));

  let segLines = '';
  segments.forEach((seg, i) => {
    if (i === 0) return;
    const sx = x(seg.startDist).toFixed(1);
    segLines += `<line x1="${sx}" y1="${top}" x2="${sx}" y2="${(H - bot).toFixed(1)}" stroke="${P.grid}" stroke-width="1" stroke-dasharray="2 3"/>`;
  });

  const kmMarks = [];
  const totalKm = totalDist / 1000;
  const step = totalKm > 80 ? 20 : totalKm > 40 ? 10 : totalKm > 15 ? 5 : totalKm > 6 ? 2 : 1;
  for (let km = 0; km <= totalKm; km += step) kmMarks.push(km);
  let axis = '';
  kmMarks.forEach(km => {
    const cx = Math.min(Math.max(x(km * 1000), 12), W - 12);
    axis += `<text x="${cx.toFixed(1)}" y="${H - 6}" fill="${P.axis}" font-size="9" font-family="'IBM Plex Mono', monospace" text-anchor="middle">${km}km</text>`;
  });

  let eleGrid = '';
  const eleTicks = 3; // niveles intermedios entre mínima y máxima, para dar sensación de escala
  for (let i = 1; i <= eleTicks; i++) {
    const ele = lo + (i / (eleTicks + 1)) * span;
    const gy = y(ele).toFixed(1);
    eleGrid += `<line x1="0" y1="${gy}" x2="${W}" y2="${gy}" stroke="${P.axis}" stroke-width="1" stroke-dasharray="3 3" opacity="0.45"/>`
      + `<text x="4" y="${(y(ele) - 3).toFixed(1)}" fill="${P.axis}" font-size="8.5" font-weight="700" font-family="'IBM Plex Mono', monospace">${Math.round(ele)}m</text>`;
  }

  const inner = axis + segLines + fills + eleGrid
    + `<path d="${line}" stroke="${P.axis}" stroke-width="1.6" fill="none" opacity="0.85"/>`
    + `<text x="4" y="${(top + 9).toFixed(1)}" fill="${P.axis}" font-size="9" font-weight="700" font-family="'IBM Plex Mono', monospace">${Math.round(hi)}m</text>`
    + `<text x="4" y="${(H - bot - 3).toFixed(1)}" fill="${P.axis}" font-size="9" font-weight="700" font-family="'IBM Plex Mono', monospace">${Math.round(lo)}m</text>`;
  return svgChart(W, H, inner);
}

function skyArc(kind, riseMin, setMin, nowMin, showDot, P) {
  const W = 300, H = 78, leftX = 26, rightX = W - 26, groundY = 50;
  const rx = (rightX - leftX) / 2, ry = 34, cx = (leftX + rightX) / 2;
  const arcD = `M${leftX},${groundY} A${rx},${ry} 0 0 1 ${rightX},${groundY}`;
  let dot = '';
  if (showDot) {
    const frac = Math.max(0, Math.min(1, (nowMin - riseMin) / (setMin - riseMin)));
    const angle = Math.PI * (1 - frac);
    const dx = cx + rx * Math.cos(angle), dy = groundY - ry * Math.sin(angle);
    const glyphColor = kind === 'sun' ? P.sun : P.moon;
    const moonScale = 1.3;
    const moonTx = dx - moonScale * 14.75, moonTy = dy - moonScale * 9.25;
    const glyph = kind === 'sun'
      ? sunRays(dx, dy, 4.6, 1.7, glyphColor)
      : `<g transform="translate(${moonTx.toFixed(1)},${moonTy.toFixed(1)}) scale(${moonScale})"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7.5 7.5 0 1 0 10.5 10.5Z" fill="${glyphColor}" stroke="${glyphColor}" stroke-width="1"/></g>`;
    dot = `<line x1="${dx.toFixed(1)}" y1="${dy.toFixed(1)}" x2="${dx.toFixed(1)}" y2="${groundY}" stroke="${P.grid}" stroke-width="1" stroke-dasharray="2 3"/>` + glyph;
  }
  const inner = `
    <line x1="${leftX - 8}" y1="${groundY}" x2="${rightX + 8}" y2="${groundY}" stroke="${P.grid}" stroke-width="1" stroke-dasharray="2 4"/>
    <path d="${arcD}" stroke="${P.axis}" stroke-width="1.4" fill="none" stroke-dasharray="3 4" opacity="0.6"/>
    <circle cx="${leftX}" cy="${groundY}" r="2.6" fill="${P.axis}"/>
    <circle cx="${rightX}" cy="${groundY}" r="2.6" fill="${P.axis}"/>
    ${dot}`;
  return `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
