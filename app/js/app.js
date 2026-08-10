(function () {
  'use strict';

  const DEFAULT_LAT = 40.4168, DEFAULT_LON = -3.7038; // Madrid, fallback
  const HOURS_AHEAD = 5;
  const WIND_UNIT = 'km/h';
  const dayNames = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

  const MAX_FAVORITES = 10;

  const state = {
    loading: true, error: null, data: null,
    place: null, region: null, lat: null, lon: null, fallback: false,
    theme: null, view: 'main', dayIdx: 0, sport: 'bike', hourLimit: 48, dayLimit: 7,
    favorites: loadFavorites(),
    locationQuery: '', locationResultsRaw: [], locationResults: [], locSearching: false, locFavMsg: '', locSpainOnly: true,
    gpsPlace: null, gpsRegion: null, gpsFallback: false
  };

  function loadFavorites() {
    try {
      const raw = localStorage.getItem('favorites');
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.slice(0, MAX_FAVORITES) : [];
    } catch (e) { return []; }
  }
  function saveFavorites() { localStorage.setItem('favorites', JSON.stringify(state.favorites)); }
  function favKey(item) { return item.lat.toFixed(2) + ',' + item.lon.toFixed(2); }
  function isFavorite(item) { return state.favorites.some(f => favKey(f) === favKey(item)); }

  function getStoredTheme() {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || saved === 'light' ? saved : null;
  }
  function systemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  function currentTheme() { return state.theme || getStoredTheme() || systemTheme(); }
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', currentTheme());
    document.querySelector('meta[name="theme-color"]').setAttribute('content', currentTheme() === 'light' ? '#f3f5f8' : '#141a22');
  }
  function toggleTheme() {
    const next = currentTheme() === 'light' ? 'dark' : 'light';
    state.theme = next;
    localStorage.setItem('theme', next);
    clearIconMemo();
    applyTheme();
    render();
  }
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (!getStoredTheme()) { clearIconMemo(); applyTheme(); render(); }
    });
  }

  function cv(v) { return WIND_UNIT === 'm/s' ? v / 3.6 : v; }

  function load() {
    state.loading = true; state.error = null; state.data = null;
    render();
    if (!navigator.geolocation) return fetchAll(DEFAULT_LAT, DEFAULT_LON, true);
    navigator.geolocation.getCurrentPosition(
      p => fetchAll(p.coords.latitude, p.coords.longitude, false),
      () => fetchAll(DEFAULT_LAT, DEFAULT_LON, true),
      { timeout: 10000, maximumAge: 300000 }
    );
  }

  async function fetchAll(lat, lon, fallback, known) {
    try {
      const u = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
        '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m' +
        '&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day,visibility,shortwave_radiation,uv_index' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,sunrise,sunset,uv_index_max' +
        '&timezone=auto&forecast_days=14';
      const r = await fetch(u);
      if (!r.ok) throw new Error('Open-Meteo respondió ' + r.status);
      const data = await r.json();
      let place = known ? known.place : (fallback ? 'Madrid' : 'Ubicación actual');
      let region = known ? known.region : (fallback ? 'Ubicación por defecto' : '');
      if (!known) {
        try {
          const g = await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat + '&longitude=' + lon + '&localityLanguage=es');
          if (g.ok) {
            const j = await g.json();
            place = j.city || j.locality || j.principalSubdivision || place;
            region = [j.principalSubdivision, j.countryName].filter(Boolean).join(', ') || region;
          }
        } catch (e) { /* geocoding is best-effort */ }
      }
      Object.assign(state, { loading: false, error: null, data, place, region, lat, lon, fallback, dayIdx: 0, hourLimit: 48, dayLimit: 7 });
      if (!known) Object.assign(state, { gpsPlace: place, gpsRegion: region, gpsFallback: fallback });
      render();
    } catch (e) {
      Object.assign(state, { loading: false, error: e.message || 'Error de red' });
      render();
    }
  }

  function selectLocation(item) {
    state.view = 'main';
    state.loading = true; state.error = null;
    render();
    window.scrollTo(0, 0);
    fetchAll(item.lat, item.lon, false, { place: item.name, region: item.region });
  }

  /* ---------- location search view ---------- */

  function stripAdminPrefix(s) {
    if (!s) return s;
    return s.replace(/^(Provincia de|Comunidad Aut[oó]noma de|Comunidad Aut[oó]noma del|Comunidad Foral de|Comunidad de|Regi[oó]n de|Principado de)\s+/i, '');
  }

  function openLocation() {
    state.view = 'location';
    state.locationQuery = ''; state.locationResultsRaw = []; state.locationResults = []; state.locSearching = false; state.locFavMsg = '';
    render();
    window.scrollTo(0, 0);
    requestAnimationFrame(() => { const el = document.getElementById('locSearchInput'); if (el) el.focus(); });
  }

  function useGPS() { state.view = 'main'; load(); }

  function computeDisplayedResults() {
    const raw = state.locationResultsRaw || [];
    const filtered = state.locSpainOnly ? raw.filter(r => r.countryCode === 'ES') : raw;
    return filtered.slice(0, 8);
  }
  function toggleSpainOnly() {
    state.locSpainOnly = !state.locSpainOnly;
    state.locationResults = computeDisplayedResults();
    updateResultsBlock();
  }

  let searchToken = 0;
  async function runLocationSearch(q) {
    const token = ++searchToken;
    state.locSearching = true;
    updateResultsBlock();
    try {
      const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(q) + '&count=20&language=es&format=json');
      const json = r.ok ? await r.json() : { results: [] };
      if (token !== searchToken) return;
      state.locationResultsRaw = (json.results || []).map(x => ({
        name: x.name,
        region: [x.admin2, x.admin1, x.country].map(stripAdminPrefix).filter(Boolean).join(', '),
        countryCode: x.country_code,
        lat: x.latitude, lon: x.longitude
      }));
    } catch (e) {
      if (token !== searchToken) return;
      state.locationResultsRaw = [];
    }
    state.locationResults = computeDisplayedResults();
    state.locSearching = false;
    updateResultsBlock();
  }

  let searchDebounce = null;
  document.addEventListener('input', e => {
    if (!e.target || e.target.id !== 'locSearchInput') return;
    state.locationQuery = e.target.value;
    clearTimeout(searchDebounce);
    const q = state.locationQuery.trim();
    if (q.length < 2) { state.locationResultsRaw = []; state.locationResults = []; state.locSearching = false; updateResultsBlock(); return; }
    searchDebounce = setTimeout(() => runLocationSearch(q), 300);
  });

  function toggleFavoriteItem(item) {
    const idx = state.favorites.findIndex(f => favKey(f) === favKey(item));
    if (idx >= 0) {
      state.favorites.splice(idx, 1);
      state.locFavMsg = '';
    } else {
      if (state.favorites.length >= MAX_FAVORITES) { state.locFavMsg = 'Quita una favorita antes de añadir otra'; updateFavoritesBlock(); return; }
      state.favorites.push({ name: item.name, region: item.region, lat: item.lat, lon: item.lon });
      state.locFavMsg = '';
    }
    saveFavorites();
    updateResultsBlock();
    updateFavoritesBlock();
  }
  function removeFavoriteAt(idx) {
    state.favorites.splice(idx, 1);
    state.locFavMsg = '';
    saveFavorites();
    updateResultsBlock();
    updateFavoritesBlock();
  }
  function updateResultsBlock() {
    const el = document.getElementById('locResultsBlock');
    if (el) el.innerHTML = resultsBlockHtml();
  }
  function updateFavoritesBlock() {
    const el = document.getElementById('locFavoritesBlock');
    if (el) el.innerHTML = favoritesBlockHtml();
  }

  function openHours() { state.view = 'hours'; state.dayIdx = 0; state.hourLimit = 48; render(); window.scrollTo(0, 0); }
  function backToMain() { state.view = 'main'; render(); window.scrollTo(0, 0); }
  function pickDay(i) { state.dayIdx = i; state.hourLimit = 48; render(); }
  function loadMore() { state.hourLimit = (state.hourLimit || 48) + 48; render(); }
  function loadMoreDays() { state.dayLimit = (state.dayLimit || 7) + 7; render(); }
  function pickSport(k) { state.sport = k; render(); }

  /* ---------- derived data ---------- */

  function computeDerived() {
    const st = state, d = st.data, L = currentTheme() === 'light', P = palette(L);
    const humColor = L ? 'oklch(0.52 0.11 195)' : 'oklch(0.78 0.11 195)';
    const H = d.hourly, C = d.current, D = d.daily;
    const uLbl = WIND_UNIT;
    const nowKey = C.time.slice(0, 13);
    let i0 = H.time.findIndex(t => t.slice(0, 13) === nowKey); if (i0 < 0) i0 = 0;
    const nH = Math.min(HOURS_AHEAD, H.time.length - i0 - 1);
    const idx = []; for (let i = i0; i < i0 + nH; i++) idx.push(i);

    const info = codeInfo(C.weather_code);
    const isDay = C.is_day === 1;
    const probNow = H.precipitation_probability[i0] || 0;
    const sport = st.sport || 'bike';
    const sc = i => { const n = hourScore(sport, H, i, cv, L); return { n, s: scoreStyle100(n, L) }; };

    const hours = idx.map(i => {
      const pr = H.precipitation_probability[i] || 0, mmv = H.precipitation[i] || 0, cur = i === i0, q = sc(i);
      const uvv = Math.round((H.uv_index ? H.uv_index[i] : 0) || 0);
      return {
        score: q.n, scoreColor: q.s.color, scoreBg: q.s.bg, scoreBorder: q.s.border,
        sportIcon: uiIcon(sport === 'bike' ? 'bike' : 'run', 11, q.s.color),
        hour: cur ? 'Ahora' : H.time[i].slice(11, 16),
        icon: wIcon(H.weather_code[i], H.is_day[i] === 1, 24, P),
        temp: Math.round(H.temperature_2m[i]), feels: Math.round(H.apparent_temperature[i]),
        prob: pr, probColor: probColor(pr, L),
        mm: mmv > 0 ? mmv.toFixed(1) + 'mm' : '—', mmColor: mmColor(mmv, L),
        arrow: windArrow(H.wind_direction_10m[i], 12), dir: dirLabel(H.wind_direction_10m[i]),
        wind: Math.round(cv(H.wind_speed_10m[i])) + ' ' + uLbl, gust: Math.round(cv(H.wind_gusts_10m[i])) + ' ' + uLbl,
        uv: uvv, uvColor: uvScale(uvv, L).color,
        hum: H.relative_humidity_2m ? Math.round(H.relative_humidity_2m[i]) : null, humColor,
        bg: cur ? 'var(--now-bg)' : 'var(--surface)', border: cur ? 'var(--now-border)' : 'var(--border)'
      };
    });
    const chartHours = idx.map(i => ({
      hour: H.time[i].slice(11, 13) + 'h', s: hourScore(sport, H, i, cv, L), t: H.temperature_2m[i], a: H.apparent_temperature[i],
      w: cv(H.wind_speed_10m[i]), g: cv(H.wind_gusts_10m[i]), d: H.wind_direction_10m[i],
      p: H.precipitation[i] || 0, pr: H.precipitation_probability[i] || 0,
      hum: H.relative_humidity_2m ? H.relative_humidity_2m[i] : 0
    }));

    const daysToShow = Math.min(st.dayLimit || 7, D.time.length);
    const hasMoreDays = daysToShow < D.time.length;
    const moreDaysLabel = 'Ver ' + Math.min(7, D.time.length - daysToShow) + ' días más · quedan ' + (D.time.length - daysToShow);
    const allMin = Math.min(...D.temperature_2m_min.slice(0, daysToShow)), allMax = Math.max(...D.temperature_2m_max.slice(0, daysToShow));
    const span = (allMax - allMin) || 1;
    const days = D.time.slice(0, daysToShow).map((t, i) => {
      const dt = new Date(t + 'T12:00:00'), mm = D.precipitation_sum[i] || 0, pp = D.precipitation_probability_max[i] || 0;
      return {
        name: i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : dayNames[dt.getDay()],
        date: dt.getDate() + '/' + (dt.getMonth() + 1),
        icon: wIcon(D.weather_code[i], true, 26, P),
        min: Math.round(D.temperature_2m_min[i]), max: Math.round(D.temperature_2m_max[i]),
        barLeft: ((D.temperature_2m_min[i] - allMin) / span * 100).toFixed(1) + '%',
        barWidth: (Math.max(D.temperature_2m_max[i] - D.temperature_2m_min[i], 1) / span * 100).toFixed(1) + '%',
        rain: pp + '% · ' + mm.toFixed(1) + 'mm',
        rainIcon: uiIcon('drop', 12, pp >= 40 ? P.rain : 'var(--muted2)'),
        rainColor: pp >= 40 ? P.rain : 'var(--muted2)',
        arrow: windArrow(D.wind_direction_10m_dominant[i], 11),
        wind: Math.round(cv(D.wind_speed_10m_max[i])) + '/' + Math.round(cv(D.wind_gusts_10m_max[i])) + ' ' + uLbl,
        sep: i === 0 ? 'transparent' : 'var(--border)'
      };
    });

    const uv = Math.round((H.uv_index ? H.uv_index[i0] : D.uv_index_max[0]) || 0), uvS = uvScale(uv, L);
    const bestFor = kind => {
      let b = null, any = null;
      const lim = Math.min(i0 + 36, H.time.length - 1);
      for (let i = i0; i < lim; i++) {
        const v = (hourScore(kind, H, i, cv, L) + hourScore(kind, H, i + 1, cv, L)) / 2;
        if (!any || v > any.v) any = { v, i };
        if (H.is_day[i] !== 1 || H.is_day[i + 1] !== 1) continue;
        if (!b || v > b.v) b = { v, i };
      }
      b = b || any;
      if (!b) return { text: '—', day: '', score: '—', style: scoreStyle100(50, L) };
      const end = H.time[b.i + 2] || H.time[b.i + 1];
      const dstr = H.time[b.i].slice(0, 10);
      return {
        text: H.time[b.i].slice(11, 16) + '–' + end.slice(11, 16),
        day: dstr === D.time[0] ? 'hoy' : dstr === D.time[1] ? 'mañana' : dayNames[new Date(dstr + 'T12:00:00').getDay()],
        score: Math.round(b.v), style: scoreStyle100(Math.round(b.v), L)
      };
    };
    const mkAct = (kind, name, iconName) => {
      const w = buildWeatherInput({
        temperature: C.temperature_2m, apparentTemperature: C.apparent_temperature,
        relativeHumidity: C.relative_humidity_2m,
        precipitation: C.precipitation || 0, precipitationProbability: probNow,
        weatherCode: C.weather_code,
        windSpeed: cv(C.wind_speed_10m), windGust: cv(C.wind_gusts_10m),
        visibility: H.visibility ? H.visibility[i0] : undefined,
        shortwaveRadiation: H.shortwave_radiation ? H.shortwave_radiation[i0] : undefined,
        uvIndex: H.uv_index ? H.uv_index[i0] : undefined
      });
      const a = activity(kind, w, kind === 'bike' ? 'la bici' : 'correr');
      const ss = scoreStyle100(a.score, L), on = sport === kind, bw = bestFor(kind);
      return {
        kind, name, label: a.label, note: a.note, on,
        bestText: bw.text, bestDay: bw.day, bestScore: bw.score,
        bestColor: bw.style.color, bestBg: bw.style.bg, bestBorder: bw.style.border,
        score: a.score, scoreColor: ss.color, scoreBg: ss.bg, scoreBorder: ss.border,
        border: ss.border, text: ss.color,
        gauge: scoreGauge(a.score, ss.color, P.grid, 'var(--muted)'),
        icon: uiIcon(iconName, 16, ss.color)
      };
    };
    const acts = [mkAct('bike', 'Bici', 'bike'), mkAct('run', 'Correr', 'run')];
    const act = acts.find(a => a.on) || acts[0];
    const sportChips = [{ k: 'bike', label: 'Bici', ic: 'bike' }, { k: 'run', label: 'Correr', ic: 'run' }].map(o => ({
      k: o.k, label: o.label,
      icon: uiIcon(o.ic, 14, sport === o.k ? 'var(--text)' : 'var(--muted)'),
      bg: sport === o.k ? 'var(--now-bg)' : 'transparent',
      border: sport === o.k ? 'var(--now-border)' : 'var(--border)',
      color: sport === o.k ? 'var(--text)' : 'var(--muted)'
    }));

    const dayIdx = Math.min(st.dayIdx, D.time.length - 1);
    const dayTabs = D.time.slice(0, 5).map((t, i) => {
      const dt = new Date(t + 'T12:00:00'), on = i === dayIdx;
      const pp = D.precipitation_probability_max[i] || 0, mmd = D.precipitation_sum[i] || 0;
      return {
        i, label: i === 0 ? 'Hoy' : i === 1 ? 'Mañ.' : dayNames[dt.getDay()],
        date: dt.getDate() + '/' + (dt.getMonth() + 1),
        icon: wIcon(D.weather_code[i], true, 24, P),
        max: Math.round(D.temperature_2m_max[i]) + '°', min: Math.round(D.temperature_2m_min[i]) + '°',
        prob: pp + '%', probColor: probColor(pp, L),
        mm: mmd > 0 ? mmd.toFixed(1) + 'mm' : '—', mmColor: mmColor(mmd, L),
        arrow: windArrow(D.wind_direction_10m_dominant[i], 11),
        wind: Math.round(cv(D.wind_speed_10m_max[i])), gust: Math.round(cv(D.wind_gusts_10m_max[i])),
        bg: on ? 'var(--now-bg)' : 'var(--surface)', border: on ? 'var(--now-border)' : 'var(--border)',
        color: on ? 'var(--text)' : 'var(--muted)'
      };
    });
    const dStr = D.time[dayIdx];
    const dayIdxs = [];
    H.time.forEach((t, i) => { if (t.slice(0, 10) === dStr && (dayIdx > 0 || i >= i0)) dayIdxs.push(i); });
    const startIdx = dayIdxs.length ? dayIdxs[0] : i0;
    const total = H.time.length - startIdx;
    const limit = Math.min(st.hourLimit || 48, total);
    const allIdxs = []; for (let i = startIdx; i < startIdx + limit; i++) allIdxs.push(i);
    let lastDate = '';
    const hourRows = allIdxs.map(i => {
      const pr = H.precipitation_probability[i] || 0, mmv = H.precipitation[i] || 0, cur = i === i0, q = sc(i);
      const uvv = Math.round((H.uv_index ? H.uv_index[i] : 0) || 0);
      const dstr = H.time[i].slice(0, 10);
      let head = '';
      if (dstr !== lastDate) {
        const dt = new Date(dstr + 'T12:00:00');
        head = (dstr === D.time[0] ? 'Hoy' : dstr === D.time[1] ? 'Mañana' : dayNames[dt.getDay()]) + ' ' + dt.getDate() + '/' + (dt.getMonth() + 1);
        lastDate = dstr;
      }
      return {
        head, score: q.n, scoreColor: q.s.color, scoreBg: q.s.bg, scoreBorder: q.s.border,
        sportIcon: uiIcon(sport === 'bike' ? 'bike' : 'run', 11, q.s.color),
        hour: H.time[i].slice(11, 16), now: cur ? 'ahora' : '',
        icon: wIcon(H.weather_code[i], H.is_day[i] === 1, 26, P), cond: codeInfo(H.weather_code[i])[0],
        temp: Math.round(H.temperature_2m[i]), feels: Math.round(H.apparent_temperature[i]),
        prob: pr + '%', probColor: probColor(pr, L),
        mm: mmv > 0 ? mmv.toFixed(1) + ' mm' : '—', mmColor: mmColor(mmv, L),
        arrow: windArrow(H.wind_direction_10m[i], 12), dir: dirLabel(H.wind_direction_10m[i]),
        wind: Math.round(cv(H.wind_speed_10m[i])), gust: Math.round(cv(H.wind_gusts_10m[i])),
        uv: uvv, uvColor: uvScale(uvv, L).color,
        hum: H.relative_humidity_2m ? Math.round(H.relative_humidity_2m[i]) : null, humColor,
        bg: cur ? 'var(--now-bg)' : 'transparent'
      };
    });
    const next24Idxs = []; for (let i = i0; i < Math.min(i0 + 24, H.time.length); i++) next24Idxs.push(i);
    const next24Hours = next24Idxs.map(i => ({
      hour: H.time[i].slice(11, 13) + 'h', s: hourScore(sport, H, i, cv, L), t: H.temperature_2m[i], a: H.apparent_temperature[i],
      w: cv(H.wind_speed_10m[i]), g: cv(H.wind_gusts_10m[i]), d: H.wind_direction_10m[i],
      p: H.precipitation[i] || 0, pr: H.precipitation_probability[i] || 0,
      hum: H.relative_humidity_2m ? H.relative_humidity_2m[i] : 0
    }));
    const dayLabel = (dayTabs[dayIdx] ? 'desde ' + dayTabs[dayIdx].label + ' ' + dayTabs[dayIdx].date : '') + ' · ' + hourRows.length + ' h';

    const mt = moonTimes(st.lat, st.lon), mp = moonPhase();
    const sportLabel = sport === 'bike' ? 'bici' : 'correr';

    const toMin = s => { const [hh, mm] = s.split(':').map(Number); return hh * 60 + mm; };
    const nowMin = toMin(C.time.slice(11, 16));
    const sunriseStr = D.sunrise[0].slice(11, 16), sunsetStr = D.sunset[0].slice(11, 16);
    const sunriseMin = toMin(sunriseStr), sunsetMin = toMin(sunsetStr);
    const sunShowDot = nowMin >= sunriseMin && nowMin <= sunsetMin;
    const sunArc = skyArc('sun', sunriseMin, sunsetMin, nowMin, sunShowDot, P);
    const moonArcOk = mt.riseMin != null && mt.setMin != null && mt.riseMin < mt.setMin;
    let moonArc = null;
    if (moonArcOk) {
      const moonUpNow = moonAlt(new Date(), st.lat, st.lon) >= 0;
      const moonShowDot = moonUpNow && nowMin >= mt.riseMin && nowMin <= mt.setMin;
      moonArc = skyArc('moon', mt.riseMin, mt.setMin, nowMin, moonShowDot, P);
    }

    return {
      L, P, place: st.place || '—', region: st.region || '', updated: C.time.slice(11, 16),
      temp: Math.round(C.temperature_2m), feels: Math.round(C.apparent_temperature),
      condition: info[0], bigIcon: wIcon(C.weather_code, isDay, 92, P),
      tmaxLabel: 'Máx ' + Math.round(D.temperature_2m_max[0]) + '°', tminLabel: 'Mín ' + Math.round(D.temperature_2m_min[0]) + '°',
      uv, uvLabel: uvS.label, uvColor: uvS.color, uvBg: uvS.bg, uvBorder: uvS.border,
      acts, act, sportChips, sportLabel,
      dayTabs, hourRows, dayLabel, hasMore: limit < total,
      moreLabel: 'Cargar ' + Math.min(48, total - limit) + ' h más · quedan ' + (total - limit),
      dayCharts: [
        { title: 'Conveniencia ' + sportLabel + ' · ' + next24Hours.length + ' h', legend: [{ label: 'nota 0-100', color: 'oklch(0.7 0.15 145)', opacity: 1 }], svg: scoreChart(next24Hours, P, n => scoreStyle100(n, L), scoreHue100, L) },
        { title: 'Temperatura · ' + next24Hours.length + ' h', legend: [{ label: 'real', color: P.warmLine, opacity: 1 }, { label: 'sensación', color: P.warmSoft, opacity: 0.7 }], svg: tempChart(next24Hours, P, L) },
        { title: 'Humedad · ' + next24Hours.length + ' h', legend: [{ label: '%', color: P.humidLine, opacity: 1 }], svg: humidChart(next24Hours, P, L) },
        { title: 'Viento y dirección · ' + next24Hours.length + ' h', legend: [{ label: uLbl, color: P.tealLine, opacity: 1 }, { label: 'rachas', color: P.tealSoft, opacity: 0.7 }], svg: windChart(next24Hours, P, L) },
        { title: 'Lluvia · ' + next24Hours.length + ' h', legend: [{ label: 'mm/h', color: P.rainBar, opacity: 1 }, { label: 'probabilidad', color: P.probLine, opacity: 0.8 }], svg: rainChart(next24Hours, P) }
      ],
      tiles: [
        { label: 'Humedad', value: C.relative_humidity_2m, unit: '%', sub: C.relative_humidity_2m > 85 ? 'ambiente muy húmedo' : 'confortable', icon: uiIcon('humid', 15), color: L ? 'oklch(0.52 0.11 195)' : 'oklch(0.78 0.11 195)', subIcon: '' },
        { label: 'Prob. lluvia', value: probNow, unit: '%', sub: (C.precipitation || 0).toFixed(1) + ' mm ahora', icon: uiIcon('drop', 15), color: L ? 'oklch(0.52 0.14 250)' : 'oklch(0.76 0.14 250)', subIcon: '' },
        { label: 'Viento', value: Math.round(cv(C.wind_speed_10m)), unit: uLbl, sub: 'del ' + dirLabel(C.wind_direction_10m) + ' (' + Math.round(C.wind_direction_10m) + '°)', icon: uiIcon('wind', 15), color: L ? 'oklch(0.5 0.12 175)' : 'oklch(0.8 0.13 175)', subIcon: windArrow(C.wind_direction_10m, 12) },
        { label: 'Rachas', value: Math.round(cv(C.wind_gusts_10m)), unit: uLbl, sub: C.wind_gusts_10m > 40 ? 'atención en bici' : 'sin sobresaltos', icon: uiIcon('gust', 15), color: L ? 'oklch(0.5 0.13 140)' : 'oklch(0.8 0.14 140)', subIcon: '' }
      ],
      sunArc, moonArc, moonArcOk,
      sunRiseSet: [
        { label: 'Amanece', value: sunriseStr, icon: uiIcon('sunriseArrow', 20), color: L ? 'oklch(0.62 0.15 65)' : 'oklch(0.83 0.15 75)' },
        { label: 'Atardece', value: sunsetStr, icon: uiIcon('sunsetArrow', 20), color: L ? 'oklch(0.58 0.15 35)' : 'oklch(0.78 0.15 40)' }
      ],
      moonRiseSet: [
        { label: 'Sale', value: mt.rise, icon: uiIcon('moonriseArrow', 20), color: L ? 'oklch(0.55 0.06 265)' : 'oklch(0.85 0.05 260)' },
        { label: 'Se pone', value: mt.set, icon: uiIcon('moonsetArrow', 20), color: L ? 'oklch(0.62 0.04 265)' : 'oklch(0.75 0.04 260)' }
      ],
      moonPhase: mp.name, moonLit: mp.lit, hours,
      charts: [
        { title: 'Conveniencia ' + sportLabel + ' · ' + nH + ' h', legend: [{ label: 'nota 0-100', color: 'oklch(0.7 0.15 145)', opacity: 1 }], svg: scoreChart(chartHours, P, n => scoreStyle100(n, L), scoreHue100, L) },
        { title: 'Temperatura · ' + nH + ' h', legend: [{ label: 'real', color: P.warmLine, opacity: 1 }, { label: 'sensación', color: P.warmSoft, opacity: 0.7 }], svg: tempChart(chartHours, P, L) },
        { title: 'Humedad · ' + nH + ' h', legend: [{ label: '%', color: P.humidLine, opacity: 1 }], svg: humidChart(chartHours, P, L) },
        { title: 'Viento y dirección · ' + nH + ' h', legend: [{ label: uLbl, color: P.tealLine, opacity: 1 }, { label: 'rachas', color: P.tealSoft, opacity: 0.7 }], svg: windChart(chartHours, P, L) },
        { title: 'Lluvia · ' + nH + ' h', legend: [{ label: 'mm/h', color: P.rainBar, opacity: 1 }, { label: 'probabilidad', color: P.probLine, opacity: 0.8 }], svg: rainChart(chartHours, P) }
      ],
      days, hasMoreDays, moreDaysLabel,
      coords: (st.fallback ? 'ubicación por defecto · ' : '') + st.lat.toFixed(3) + ', ' + st.lon.toFixed(3)
    };
  }

  /* ---------- templates ---------- */

  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function placeNameFontSize(name) {
    const len = (name || '').length;
    if (len <= 20) return 26;
    if (len <= 26) return 22;
    if (len <= 32) return 19;
    if (len <= 40) return 16;
    return 14;
  }

  function headerTpl() {
    const light = currentTheme() === 'light';
    const themeIcon = light ? uiIcon('sunToggle', 18) : uiIcon('moonToggle', 18);
    const spin = state.loading ? 'animation:spin 1s linear infinite' : '';
    const place = state.place || '—';
    const nameSize = placeNameFontSize(place);
    return `
    <div style="display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
        <div style="display:flex;align-items:center;gap:6px">
          <div style="width:7px;height:7px;border-radius:99px;background:var(--live)"></div>
          <div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;color:var(--muted)">Ubicación actual</div>
        </div>
        <div style="display:flex;gap:8px;flex:none">
          <div class="btn-icon" data-action="toggleTheme">${themeIcon}</div>
          <div class="btn-icon" data-action="reload" style="${spin ? 'color:var(--text-soft)' : ''}"><span style="display:flex;${spin}">${uiIcon('refresh', 18)}</span></div>
        </div>
      </div>
      <div class="clickable" data-action="openLocation" style="display:flex;flex-direction:column;gap:3px;min-width:0">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0">
          <div style="font-size:${nameSize}px;font-weight:800;letter-spacing:-.02em;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0">${esc(place)}</div>
          <div style="flex:none;color:var(--muted);display:flex">${uiIcon('chevronDown', 16)}</div>
        </div>
        <div style="font-size:12px;color:var(--muted);font-weight:500">${esc(state.region || '')}${state.region ? ' · ' : ''}${state.data ? 'Actualizado ' + state.data.current.time.slice(11, 16) : ''}</div>
      </div>
    </div>`;
  }

  function loadingTpl() {
    return `<div style="display:flex;flex-direction:column;gap:12px">
      <div class="skeleton" style="height:190px;border-radius:24px"></div>
      <div class="skeleton" style="height:110px;border-radius:20px"></div>
      <div class="skeleton" style="height:140px;border-radius:20px"></div>
    </div>`;
  }

  function errorTpl() {
    return `<div style="padding:18px;border-radius:20px;background:var(--err-bg);border:1px solid var(--err-border);display:flex;flex-direction:column;gap:10px">
      <div style="font-weight:700;font-size:15px">No se pudo cargar el tiempo</div>
      <div style="font-size:13px;color:var(--text-soft)">${esc(state.error)}</div>
      <div data-action="reload" style="align-self:flex-start;padding:9px 16px;border-radius:99px;background:var(--text);color:var(--bg2);font-weight:700;font-size:13px;cursor:pointer">Reintentar</div>
    </div>`;
  }

  function chartCardTpl(c) {
    const legend = c.legend.map(l => `<div style="display:flex;align-items:center;gap:5px">
      <div style="width:14px;height:3px;border-radius:99px;background:${l.color};opacity:${l.opacity}"></div>
      <div style="font-size:10px;font-weight:600;color:var(--muted)">${esc(l.label)}</div>
    </div>`).join('');
    return `<div style="padding:15px 14px 12px;border-radius:20px;background:var(--surface);border:1px solid var(--border);display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 2px">
        <div style="font-size:12px;font-weight:800;letter-spacing:.02em">${esc(c.title)}</div>
        <div style="display:flex;align-items:center;gap:10px">${legend}</div>
      </div>
      <div>${c.svg}</div>
    </div>`;
  }

  function sportChipsTpl(chips, small) {
    return chips.map(s => `<div class="clickable" data-action="pickSport" data-sport="${s.k}" style="display:flex;align-items:center;gap:${small ? 5 : 6}px;padding:${small ? '6px 12px' : '7px 13px'};border-radius:99px;background:${s.bg};border:1px solid ${s.border};color:${s.color};font-size:${small ? 11 : 12}px;font-weight:800">
      <div style="display:flex">${s.icon}</div>${esc(s.label)}
    </div>`).join('');
  }

  function actCardTpl(act) {
    return `<div style="padding:15px 16px;border-radius:20px;background:var(--surface);border:1px solid var(--border);display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;align-items:center;gap:7px">
        <div style="display:flex;color:${act.text}">${act.icon}</div>
        <div style="font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;color:var(--muted)">Ahora para ${esc(act.name)}</div>
      </div>
      <div style="margin:0 -6px">${act.gauge}</div>
      <div style="display:flex;flex-direction:column;gap:5px;align-items:center;text-align:center;margin-top:-16px">
        <div style="font-size:17px;font-weight:800;line-height:1.1;color:${act.text}">${esc(act.label)}</div>
        <div style="font-size:12.5px;color:var(--text-soft);font-weight:500;text-wrap:pretty;max-width:300px">${esc(act.note)}</div>
      </div>
      <div style="padding-top:11px;margin-top:6px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px">
        <div style="display:flex;flex-direction:column;gap:1px">
          <div style="font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:var(--muted)">Mejor hueco (24 h)</div>
          <div style="display:flex;align-items:baseline;gap:7px">
            <div style="font-size:16px;font-weight:800;font-family:'IBM Plex Mono',monospace">${esc(act.bestText)}</div>
            <div style="font-size:11px;font-weight:600;color:var(--muted)">${esc(act.bestDay)}</div>
          </div>
        </div>
        <div style="margin-left:auto;display:flex;align-items:baseline;gap:2px;padding:5px 11px;border-radius:99px;background:${act.bestBg};border:1px solid ${act.bestBorder};font-family:'IBM Plex Mono',monospace;color:${act.bestColor}">
          <div style="font-size:18px;font-weight:800;line-height:1">${act.bestScore}</div>
          <div style="font-size:10px;font-weight:600;opacity:.7">/100</div>
        </div>
      </div>
    </div>`;
  }

  function mainViewTpl(v) {
    const tiles = v.tiles.map(t => `<div style="padding:13px 14px;border-radius:18px;background:var(--surface);border:1px solid var(--border);display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;align-items:center;gap:7px">
        <div style="color:${t.color};display:flex">${t.icon}</div>
        <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:var(--muted)">${esc(t.label)}</div>
      </div>
      <div style="display:flex;align-items:baseline;gap:5px">
        <div style="font-size:23px;font-weight:800;font-family:'IBM Plex Mono',monospace;letter-spacing:-.03em">${t.value}</div>
        <div style="font-size:11px;font-weight:600;color:var(--muted)">${t.unit}</div>
      </div>
      <div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--muted);font-weight:600"><span style="display:flex;color:${t.color}">${t.subIcon}</span>${esc(t.sub)}</div>
    </div>`).join('');

    const riseSetRowTpl = items => `<div style="display:flex;align-items:center;justify-content:space-between;padding:0 6px">
      ${items.map((it, i) => `<div style="display:flex;flex-direction:column;gap:3px;align-items:${i > 0 ? 'flex-end' : 'flex-start'}">
        <div style="font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:var(--muted);text-align:${i > 0 ? 'right' : 'left'}">${esc(it.label)}</div>
        <div style="display:flex;align-items:center;gap:7px">
          <div style="color:${it.color};display:flex">${it.icon}</div>
          <div style="font-size:17px;font-weight:800;font-family:'IBM Plex Mono',monospace">${esc(it.value)}</div>
        </div>
      </div>`).join('')}
    </div>`;

    const hours = v.hours.map(h => `<div style="flex:1 1 0;min-width:0;padding:10px 4px 11px;border-radius:16px;background:${h.bg};border:1px solid ${h.border};display:flex;flex-direction:column;align-items:center;gap:6px">
      <div style="font-size:10.5px;font-weight:700;color:var(--muted);font-family:'IBM Plex Mono',monospace">${esc(h.hour)}</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:3px;min-width:34px;padding:2px 4px;border-radius:8px;background:${h.scoreBg};border:1px solid ${h.scoreBorder}">
        <div style="display:flex">${h.sportIcon}</div>
        <div style="font-size:12px;font-weight:800;color:${h.scoreColor};font-family:'IBM Plex Mono',monospace">${h.score}</div>
      </div>
      <div>${h.icon}</div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:0px">
        <div style="font-size:16px;font-weight:800;font-family:'IBM Plex Mono',monospace">${h.temp}°</div>
        <div style="font-size:9.5px;font-weight:600;color:var(--warm);font-family:'IBM Plex Mono',monospace;white-space:nowrap">${h.feels}°</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:1px">
        <div style="font-size:11px;font-weight:700;color:${h.probColor};font-family:'IBM Plex Mono',monospace">${h.prob}%</div>
        <div style="font-size:10px;font-weight:600;color:${h.mmColor};font-family:'IBM Plex Mono',monospace">${h.mm}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:1px;margin-top:1px">
        <div style="display:flex;align-items:center;gap:3px">
          <div style="display:flex;color:var(--teal)">${h.arrow}</div>
          <div style="font-size:10.5px;font-weight:800;font-family:'IBM Plex Mono',monospace;color:var(--teal)">${h.dir}</div>
        </div>
        <div style="font-size:9.5px;font-weight:700;font-family:'IBM Plex Mono',monospace;color:var(--text-soft);white-space:nowrap">${h.wind}</div>
        <div style="font-size:9.5px;font-weight:600;color:var(--muted2);font-family:'IBM Plex Mono',monospace;white-space:nowrap">r ${h.gust}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;margin-top:1px">
        <div style="font-size:10.5px;font-weight:800;font-family:'IBM Plex Mono',monospace;color:${h.uvColor};white-space:nowrap">UV ${h.uv}</div>
        ${h.hum != null ? `<div style="display:flex;align-items:center;gap:2px;font-size:9.5px;font-weight:600;color:${h.humColor};font-family:'IBM Plex Mono',monospace;white-space:nowrap"><span style="display:flex">${uiIcon('humid', 12, h.humColor)}</span>${h.hum}%</div>` : ''}
      </div>
    </div>`).join('');

    const charts = v.charts.map(chartCardTpl).join('');

    const days = v.days.map((d, i) => `<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-top:1px solid ${d.sep}">
      <div style="width:52px;flex:none;display:flex;flex-direction:column">
        <div style="font-size:13px;font-weight:800;letter-spacing:-.01em">${esc(d.name)}</div>
        <div style="font-size:10px;font-weight:600;color:var(--muted2);font-family:'IBM Plex Mono',monospace">${esc(d.date)}</div>
      </div>
      <div style="flex:none">${d.icon}</div>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
        <div style="display:flex;align-items:center;gap:6px;font-family:'IBM Plex Mono',monospace">
          <div style="font-size:12px;font-weight:600;color:var(--muted);width:26px;text-align:right">${d.min}°</div>
          <div style="flex:1;height:5px;border-radius:99px;background:var(--track);position:relative">
            <div style="position:absolute;top:0;bottom:0;left:${d.barLeft};width:${d.barWidth};border-radius:99px;background:linear-gradient(90deg, var(--cold), var(--hot))"></div>
          </div>
          <div style="font-size:13px;font-weight:800;width:28px">${d.max}°</div>
        </div>
        <div style="display:flex;align-items:center;gap:11px;font-size:10px;font-weight:700;font-family:'IBM Plex Mono',monospace">
          <div style="display:flex;align-items:center;gap:4px;color:${d.rainColor}">${d.rainIcon}${esc(d.rain)}</div>
          <div style="display:flex;align-items:center;gap:4px;color:var(--teal)">${d.arrow}${esc(d.wind)}</div>
        </div>
      </div>
    </div>`).join('');

    return `<div style="display:flex;flex-direction:column;gap:14px">
      <div style="position:relative;padding:20px;border-radius:26px;background:linear-gradient(165deg, var(--hero-a) 0%, var(--hero-b) 100%);border:1px solid var(--hero-border);overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:14px">
          <div style="display:flex;flex-direction:column;gap:2px">
            <div style="display:flex;align-items:flex-start;gap:2px">
              <div style="font-size:74px;font-weight:800;line-height:.9;letter-spacing:-.045em;font-family:'IBM Plex Mono',monospace">${v.temp}</div>
              <div style="font-size:26px;font-weight:600;margin-top:6px;color:var(--text-soft)">°C</div>
            </div>
            <div style="font-size:16px;font-weight:700;margin-top:6px">${esc(v.condition)}</div>
            <div style="font-size:13px;color:var(--muted);font-weight:500">Sensación de ${v.feels}°C</div>
          </div>
          <div style="flex:none">${v.bigIcon}</div>
        </div>
        <div style="display:flex;align-items:center;gap:14px;margin-top:16px;padding-top:14px;border-top:1px solid var(--hero-border)">
          <div style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700"><span style="color:var(--hot)">▲</span>${esc(v.tmaxLabel)}</div>
          <div style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700"><span style="color:var(--cold)">▼</span>${esc(v.tminLabel)}</div>
          <div style="margin-left:auto;display:flex;align-items:center;gap:6px;padding:4px 9px 4px 7px;border-radius:99px;background:${v.uvBg};border:1px solid ${v.uvBorder}">
            <div style="width:7px;height:7px;border-radius:99px;background:${v.uvColor}"></div>
            <div style="font-size:11px;font-weight:800;color:${v.uvColor};font-family:'IBM Plex Mono',monospace">UV ${v.uv}</div>
            <div style="font-size:11px;font-weight:600;color:var(--text-soft)">${esc(v.uvLabel)}</div>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${tiles}</div>

      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;gap:6px">${sportChipsTpl(v.sportChips, false)}</div>
        ${actCardTpl(v.act)}
      </div>

      <div style="display:flex;flex-direction:column;gap:9px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding-left:2px">
          <div class="section-label">Próximas horas</div>
          <div class="pill-btn" data-action="openHours">${uiIcon('expand', 14)}Ver todas</div>
        </div>
        <div style="display:flex;gap:6px">${hours}</div>
      </div>

      ${charts}

      <div style="padding:14px 16px;border-radius:20px;background:var(--surface);border:1px solid var(--border);display:flex;flex-direction:column;gap:8px">
        <div class="section-label" style="padding-left:2px">Sol</div>
        ${v.sunArc}
        ${riseSetRowTpl(v.sunRiseSet)}
      </div>

      <div style="padding:14px 16px;border-radius:20px;background:var(--surface);border:1px solid var(--border);display:flex;flex-direction:column;gap:10px">
        <div class="section-label" style="padding-left:2px">Luna</div>
        ${v.moonArcOk ? v.moonArc : ''}
        ${riseSetRowTpl(v.moonRiseSet)}
        <div style="padding-top:11px;border-top:1px solid var(--border);font-size:12px;color:var(--muted);font-weight:600">Luna ${esc(v.moonPhase)} · ${v.moonLit}% iluminada</div>
      </div>

      <div style="display:flex;flex-direction:column;gap:9px">
        <div class="section-label" style="padding-left:2px">Próximos ${v.days.length} días</div>
        <div style="border-radius:20px;background:var(--surface);border:1px solid var(--border);overflow:hidden">${days}</div>
        ${v.hasMoreDays ? `<div class="pill-btn" data-action="loadMoreDays" style="align-self:center;padding:9px 18px;font-size:12px">${esc(v.moreDaysLabel)}</div>` : ''}
      </div>

      <div style="text-align:center;font-size:10px;color:var(--muted3);font-weight:600;letter-spacing:.06em;padding-top:6px">Datos: Open-Meteo · ${esc(v.coords)}</div>
    </div>`;
  }

  function hoursViewTpl(v) {
    const dayTabs = v.dayTabs.map(t => `<div class="clickable" data-action="pickDay" data-day="${t.i}" style="flex:1 1 0;min-width:0;padding:10px 4px 11px;border-radius:16px;background:${t.bg};border:1px solid ${t.border};display:flex;flex-direction:column;align-items:center;gap:6px">
      <div style="display:flex;flex-direction:column;align-items:center">
        <div style="font-size:11px;font-weight:800;color:${t.color}">${esc(t.label)}</div>
        <div style="font-size:9px;font-weight:600;color:var(--muted2);font-family:'IBM Plex Mono',monospace">${esc(t.date)}</div>
      </div>
      <div>${t.icon}</div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:0px;font-family:'IBM Plex Mono',monospace">
        <div style="font-size:14px;font-weight:800">${t.max}</div>
        <div style="font-size:10px;font-weight:600;color:var(--muted)">${t.min}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:1px;font-family:'IBM Plex Mono',monospace">
        <div style="font-size:10.5px;font-weight:700;color:${t.probColor}">${t.prob}</div>
        <div style="font-size:9.5px;font-weight:600;color:${t.mmColor}">${t.mm}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:1px;font-family:'IBM Plex Mono',monospace">
        <div style="display:flex;align-items:center;gap:2px;color:var(--teal)">
          <div style="display:flex">${t.arrow}</div>
          <div style="font-size:10px;font-weight:800">${t.wind}</div>
        </div>
        <div style="font-size:9.5px;font-weight:600;color:var(--muted2)">r ${t.gust}</div>
      </div>
    </div>`).join('');

    const charts = v.dayCharts.map(chartCardTpl).join('');

    const rows = v.hourRows.map(r => `<div>
      ${r.head ? `<div style="padding:7px 12px;background:var(--btn);border-top:1px solid var(--border);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;font-weight:800;color:var(--muted)">${esc(r.head)}</div>` : ''}
      <div style="display:grid;grid-template-columns:42px 28px 1fr 54px 66px 30px;gap:6px;align-items:center;padding:9px 12px;border-top:1px solid var(--border);background:${r.bg}">
        <div style="display:flex;flex-direction:column">
          <div style="font-size:13px;font-weight:800;font-family:'IBM Plex Mono',monospace">${r.hour}</div>
          <div style="font-size:8.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted2)">${r.now}</div>
        </div>
        <div style="display:flex">${r.icon}</div>
        <div style="display:flex;flex-direction:column;min-width:0">
          <div style="display:flex;align-items:baseline;gap:5px;font-family:'IBM Plex Mono',monospace">
            <div style="font-size:15px;font-weight:800">${r.temp}°</div>
            <div style="font-size:10.5px;font-weight:600;color:var(--warm)">${r.feels}°</div>
          </div>
          <div style="font-size:10px;font-weight:600;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.cond)}</div>
          <div style="display:flex;flex-direction:column;gap:1px;margin-top:2px">
            <div style="font-size:11px;font-weight:800;font-family:'IBM Plex Mono',monospace;color:${r.uvColor};white-space:nowrap">UV ${r.uv}</div>
            ${r.hum != null ? `<div style="display:flex;align-items:center;gap:3px;font-size:10px;font-weight:600;color:${r.humColor};font-family:'IBM Plex Mono',monospace;white-space:nowrap"><span style="display:flex">${uiIcon('humid', 13, r.humColor)}</span>${r.hum}%</div>` : ''}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;font-family:'IBM Plex Mono',monospace">
          <div style="font-size:12px;font-weight:800;color:${r.probColor}">${r.prob}</div>
          <div style="font-size:10px;font-weight:600;color:${r.mmColor}">${r.mm}</div>
        </div>
        <div style="display:flex;flex-direction:column;font-family:'IBM Plex Mono',monospace">
          <div style="display:flex;align-items:center;gap:4px;color:var(--teal)">
            <div style="display:flex">${r.arrow}</div>
            <div style="font-size:11px;font-weight:800">${r.dir} ${r.wind}</div>
          </div>
          <div style="font-size:10px;font-weight:600;color:var(--muted2)">r ${r.gust}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:1px;padding:3px 0;border-radius:8px;background:${r.scoreBg};border:1px solid ${r.scoreBorder}">
          <div style="display:flex">${r.sportIcon}</div>
          <div style="font-size:12px;font-weight:800;color:${r.scoreColor};font-family:'IBM Plex Mono',monospace;line-height:1">${r.score}</div>
        </div>
      </div>
    </div>`).join('');

    return `<div style="display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;align-items:center;gap:10px">
        <div class="pill-btn" data-action="backToMain" style="padding:8px 13px 8px 10px">${uiIcon('back', 16)}Volver</div>
        <div class="section-label">Hora a hora</div>
        <div style="margin-left:auto;display:flex;gap:6px">${sportChipsTpl(v.sportChips, true)}</div>
      </div>

      <div style="display:flex;gap:6px">${dayTabs}</div>

      ${charts}

      <div style="display:flex;flex-direction:column;gap:9px">
        <div class="section-label" style="padding-left:2px">Detalle · ${esc(v.dayLabel)}</div>
        <div style="border-radius:20px;background:var(--surface);border:1px solid var(--border);overflow:hidden">
          <div style="display:grid;grid-template-columns:42px 28px 1fr 54px 66px 30px;gap:6px;padding:9px 12px;border-bottom:1px solid var(--border);font-size:9px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:var(--muted2)">
            <div>Hora</div><div></div><div>Temp / ST</div><div>Lluvia</div><div>Viento</div><div>Nota</div>
          </div>
          ${rows}
        </div>
        ${v.hasMore ? `<div class="pill-btn" data-action="loadMore" style="align-self:center;padding:9px 18px;font-size:12px">${esc(v.moreLabel)}</div>` : ''}
      </div>

      <div class="pill-btn" data-action="backToMain" style="align-self:center;padding:9px 18px;font-size:12px">Volver al resumen</div>
    </div>`;
  }

  /* ---------- location search view ---------- */

  function resultRowHtml(r, i) {
    const fav = isFavorite(r);
    return `<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;${i > 0 ? 'border-top:1px solid var(--border)' : ''}">
      <div class="clickable" data-action="pickResult" data-idx="${i}" style="flex:1;display:flex;align-items:center;gap:10px;min-width:0">
        <div style="flex:none;color:var(--muted);display:flex">${uiIcon('pin', 16)}</div>
        <div style="display:flex;flex-direction:column;min-width:0">
          <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.name)}</div>
          <div style="font-size:11px;font-weight:600;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.region)}</div>
        </div>
      </div>
      <div class="clickable" data-action="toggleFavorite" data-idx="${i}" style="flex:none;padding:6px;display:flex;color:${fav ? 'var(--hot)' : 'var(--muted)'}">${uiIcon(fav ? 'star' : 'starOutline', 18)}</div>
    </div>`;
  }
  function spainToggleHtml() {
    return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:2px 2px 18px">
      <div style="font-size:12px;font-weight:700;color:var(--text-soft)">Solo España</div>
      <div class="clickable" data-action="toggleSpainOnly" style="width:38px;height:22px;border-radius:99px;background:${state.locSpainOnly ? 'var(--now-border)' : 'var(--btn)'};border:1px solid var(--border);position:relative;flex:none">
        <div style="position:absolute;top:2px;left:${state.locSpainOnly ? '18px' : '2px'};width:16px;height:16px;border-radius:99px;background:var(--text)"></div>
      </div>
    </div>`;
  }
  function resultsBlockHtml() {
    const toggle = spainToggleHtml();
    const q = (state.locationQuery || '').trim();
    if (q.length < 2) return toggle;
    if (state.locSearching) return toggle + `<div style="font-size:12px;color:var(--muted);font-weight:600;padding:10px 2px">Buscando…</div>`;
    const results = state.locationResults || [];
    if (!results.length) return toggle + `<div style="font-size:12px;color:var(--muted);font-weight:600;padding:10px 2px">Sin resultados para "${esc(q)}"${state.locSpainOnly ? ' en España' : ''}</div>`;
    return toggle + `<div style="border-radius:20px;background:var(--surface);border:1px solid var(--border);overflow:hidden">${results.map(resultRowHtml).join('')}</div>`;
  }

  function favoriteRowHtml(f, i, pos) {
    return `<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;${pos > 0 ? 'border-top:1px solid var(--border)' : ''}">
      <div class="clickable" data-action="pickFavorite" data-favidx="${i}" style="flex:1;display:flex;align-items:center;gap:10px;min-width:0">
        <div style="flex:none;color:var(--hot);display:flex">${uiIcon('star', 16)}</div>
        <div style="display:flex;flex-direction:column;min-width:0">
          <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(f.name)}</div>
          <div style="font-size:11px;font-weight:600;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(f.region)}</div>
        </div>
      </div>
      <div class="clickable" data-action="removeFavorite" data-favidx="${i}" style="flex:none;padding:6px;display:flex;color:var(--muted)">${uiIcon('close', 16)}</div>
    </div>`;
  }
  function favoritesBlockHtml() {
    const favorites = state.favorites || [];
    const sorted = favorites
      .map((f, i) => ({ f, i }))
      .sort((a, b) => a.f.name.localeCompare(b.f.name, 'es', { sensitivity: 'base' }));
    const rows = favorites.length
      ? sorted.map(({ f, i }, pos) => favoriteRowHtml(f, i, pos)).join('')
      : `<div style="padding:14px;font-size:12px;color:var(--muted);font-weight:600">Aún no tienes favoritas. Busca una ciudad y toca la estrella.</div>`;
    return `<div class="section-label" style="padding-left:2px">Favoritas (${favorites.length}/${MAX_FAVORITES})</div>
      ${state.locFavMsg ? `<div style="font-size:11px;font-weight:700;color:var(--hot);padding:0 2px">${esc(state.locFavMsg)}</div>` : ''}
      <div style="border-radius:20px;background:var(--surface);border:1px solid var(--border);overflow:hidden">${rows}</div>`;
  }

  function locationViewTpl() {
    return `<div style="display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;align-items:center;gap:10px">
        <div class="pill-btn" data-action="backToMain" style="padding:8px 13px 8px 10px">${uiIcon('back', 16)}Volver</div>
        <div class="section-label">Ubicación</div>
      </div>

      <div class="clickable" data-action="useGPS" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:16px;background:var(--surface);border:1px solid var(--border)">
        <div style="flex:none;color:var(--live);display:flex">${uiIcon('pin', 18)}</div>
        <div style="display:flex;flex-direction:column;min-width:0">
          <div style="font-size:13px;font-weight:800">Mi ubicación</div>
          <div style="font-size:11px;font-weight:600;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${state.gpsPlace && !state.gpsFallback ? esc(state.gpsPlace) + (state.gpsRegion ? ', ' + esc(state.gpsRegion) : '') : 'Usar la ubicación del dispositivo'}</div>
        </div>
      </div>

      <input id="locSearchInput" type="text" inputmode="search" autocomplete="off" placeholder="Buscar ciudad, pueblo..." value="${esc(state.locationQuery || '')}"
        style="width:100%;padding:12px 14px;border-radius:16px;background:var(--surface);border:1px solid var(--border);color:var(--text);font-size:16px;font-family:Manrope,Helvetica,sans-serif;outline:none">

      <div id="locResultsBlock">${resultsBlockHtml()}</div>

      <div id="locFavoritesBlock" style="display:flex;flex-direction:column;gap:9px">${favoritesBlockHtml()}</div>
    </div>`;
  }

  /* ---------- render ---------- */

  function render() {
    applyTheme();
    let body;
    if (state.loading) body = loadingTpl();
    else if (state.error) body = errorTpl();
    else if (state.view === 'location') body = locationViewTpl();
    else if (state.data) {
      const v = computeDerived();
      body = state.view === 'hours' ? hoursViewTpl(v) : mainViewTpl(v);
    } else body = '';

    document.getElementById('app').innerHTML = `<div class="page"><div class="container">${headerTpl()}${body}</div></div>`;
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const action = t.getAttribute('data-action');
    if (action === 'toggleTheme') toggleTheme();
    else if (action === 'reload') load();
    else if (action === 'openLocation') openLocation();
    else if (action === 'useGPS') useGPS();
    else if (action === 'pickResult') { const item = state.locationResults[Number(t.getAttribute('data-idx'))]; if (item) selectLocation(item); }
    else if (action === 'toggleFavorite') { const item = state.locationResults[Number(t.getAttribute('data-idx'))]; if (item) toggleFavoriteItem(item); }
    else if (action === 'toggleSpainOnly') toggleSpainOnly();
    else if (action === 'pickFavorite') { const item = state.favorites[Number(t.getAttribute('data-favidx'))]; if (item) selectLocation(item); }
    else if (action === 'removeFavorite') removeFavoriteAt(Number(t.getAttribute('data-favidx')));
    else if (action === 'openHours') openHours();
    else if (action === 'backToMain') backToMain();
    else if (action === 'pickSport') pickSport(t.getAttribute('data-sport'));
    else if (action === 'pickDay') pickDay(Number(t.getAttribute('data-day')));
    else if (action === 'loadMore') loadMore();
    else if (action === 'loadMoreDays') loadMoreDays();
  });

  applyTheme();
  render();
  load();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
