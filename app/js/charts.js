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
    const st = scoreStyle(o.s), h = Math.max((H - top - bot) * (o.s / 10), 3);
    bars += `<rect x="${(cxOf(i) - bw / 2).toFixed(1)}" y="${(H - bot - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="oklch(0.7 0.15 ${scoreHue(o.s)})" opacity="${light ? 0.9 : 0.85}"/>`;
    if (n <= 9 || i % 3 === 0) bars += `<text x="${cxOf(i).toFixed(1)}" y="${(H - bot - h - 5).toFixed(1)}" fill="${st.color}" font-size="${n <= 9 ? 11 : 9}" font-weight="800" font-family="'IBM Plex Mono', monospace" text-anchor="middle">${o.s}</text>`;
  });
  const inner = axisSvg(hs.map(o => o.hour), W, H, n, top - 8, cxOf, P) + bars;
  return svgChart(W, H, inner);
}
