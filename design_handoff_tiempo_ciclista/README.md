# Handoff: Tiempo Ciclista (app meteorológica para bici y running)

## Overview

App web móvil que muestra el tiempo de la ubicación del dispositivo orientada a decidir si salir a
hacer deporte (bici o correr): estado actual, valoración 1-10 por deporte, próximas horas, gráficas
horarias, vista ampliada hora a hora y previsión a 7 días.

Datos en tiempo real de **Open-Meteo** (sin API key) y geocodificación inversa de **BigDataCloud**.

## About the Design Files

El archivo `Tiempo Ciclista.dc.html` de este paquete es una **referencia de diseño hecha en HTML**:
un prototipo funcional que muestra el aspecto y el comportamiento previstos, **no código de
producción para copiar tal cual**. Necesita `support.js` (runtime del prototipo) solo para abrirse en
el navegador; ese runtime **no** debe portarse.

El trabajo consiste en **recrear este diseño en el entorno del proyecto destino** (React, Vue,
Svelte, React Native, SwiftUI…) usando sus patrones y librerías. Si aún no hay proyecto, elige el
stack más adecuado (recomendación: React + Vite, o Next.js si se quiere PWA con offline) e
impleméntalo allí. La lógica de negocio (llamadas a la API, cálculo de puntuación, cálculo lunar,
generación de gráficas SVG) sí es portable casi literal desde el prototipo.

## Fidelity

**Alta fidelidad.** Colores, tipografías, tamaños, espaciados y estados son definitivos. Debe
recrearse de forma fiel al píxel con las librerías del proyecto destino. Los iconos meteorológicos y
de UI son SVG dibujados a mano en el prototipo: pueden sustituirse por un set equivalente (p. ej.
Lucide) siempre que se mantenga el trazo fino redondeado y el código de color por dato.

---

## Layout general

- Contenedor centrado, `max-width: 440px`, `padding: 22px 18px 44px`, columna flex con `gap: 14px`.
- Fondo de página: `radial-gradient(120% 60% at 50% 0%, var(--bg1) 0%, var(--bg2) 60%)`.
- Diseñado para móvil (referencia 430 × 932). Todo debe caber en ancho de móvil **sin scroll
  horizontal**; las tiras de 5 elementos usan `flex: 1 1 0; min-width: 0`.
- Tipografías: **Manrope** (400/500/600/700/800) para UI y **IBM Plex Mono** (400/500/600) para todo
  dato numérico (temperaturas, horas, velocidades, notas). Google Fonts.
- Dos temas, claro y oscuro, mediante custom properties en `:root` y `[data-theme="light"]`
  (atributo puesto en `<html>`). Por defecto oscuro.

---

## Design tokens

### Tema oscuro (por defecto)

| Token | Valor |
|---|---|
| `--bg1` / `--bg2` | `oklch(0.24 0.045 255)` / `oklch(0.16 0.02 255)` |
| `--text` / `--text-soft` | `oklch(0.97 0.005 250)` / `oklch(0.86 0.015 250)` |
| `--muted` / `--muted2` / `--muted3` | `oklch(0.68 0.02 250)` / `oklch(0.6 0.02 250)` / `oklch(0.52 0.02 250)` |
| `--surface` / `--border` | `oklch(0.235 0.025 255)` / `oklch(0.3 0.025 255)` |
| `--hero-a` / `--hero-b` / `--hero-border` | `oklch(0.29 0.04 255)` / `oklch(0.23 0.028 255)` / `oklch(0.34 0.03 255)` |
| `--btn` / `--btn-hover` | `oklch(0.26 0.03 255)` / `oklch(0.32 0.04 255)` |
| `--now-bg` / `--now-border` | `oklch(0.3 0.05 255)` / `oklch(0.45 0.08 255)` |
| `--track` | `oklch(0.3 0.02 255)` |
| `--hot` / `--cold` | `oklch(0.75 0.15 45)` / `oklch(0.75 0.13 235)` |
| `--teal` / `--warm` / `--live` | `oklch(0.84 0.09 195)` / `oklch(0.66 0.04 60)` / `oklch(0.75 0.15 145)` |
| `--err-bg` / `--err-border` | `oklch(0.26 0.05 25)` / `oklch(0.4 0.09 25)` |

### Tema claro

| Token | Valor |
|---|---|
| `--bg1` / `--bg2` | `oklch(0.95 0.03 250)` / `oklch(0.985 0.006 250)` |
| `--text` / `--text-soft` | `oklch(0.27 0.02 255)` / `oklch(0.38 0.02 255)` |
| `--muted` / `--muted2` / `--muted3` | `oklch(0.5 0.02 250)` / `oklch(0.56 0.02 250)` / `oklch(0.65 0.02 250)` |
| `--surface` / `--border` | `oklch(0.995 0.003 250)` / `oklch(0.9 0.008 250)` |
| `--hero-a` / `--hero-b` / `--hero-border` | `oklch(0.965 0.025 250)` / `oklch(0.995 0.005 250)` / `oklch(0.9 0.012 250)` |
| `--btn` / `--btn-hover` | `oklch(0.97 0.006 250)` / `oklch(0.93 0.01 250)` |
| `--now-bg` / `--now-border` | `oklch(0.94 0.035 250)` / `oklch(0.8 0.06 250)` |
| `--track` | `oklch(0.92 0.008 250)` |
| `--hot` / `--cold` | `oklch(0.6 0.17 40)` / `oklch(0.55 0.15 245)` |
| `--teal` / `--warm` / `--live` | `oklch(0.5 0.13 195)` / `oklch(0.58 0.08 55)` / `oklch(0.58 0.16 145)` |
| `--err-bg` / `--err-border` | `oklch(0.95 0.04 25)` / `oklch(0.82 0.09 25)` |

### Paleta de iconos y gráficas (dependiente del tema)

| Uso | Oscuro | Claro |
|---|---|---|
| sol | `oklch(0.83 0.16 80)` | `oklch(0.72 0.16 70)` |
| luna | `oklch(0.9 0.05 255)` | `oklch(0.6 0.06 265)` |
| nube | `oklch(0.8 0.02 250)` | `oklch(0.62 0.02 250)` |
| lluvia | `oklch(0.74 0.14 245)` | `oklch(0.55 0.15 245)` |
| nieve | `oklch(0.95 0.02 250)` | `oklch(0.68 0.04 250)` |
| rayo | `oklch(0.86 0.16 90)` | `oklch(0.72 0.17 80)` |
| línea temp / suave / texto | `oklch(0.8 0.16 55)` / `oklch(0.72 0.06 55)` / `oklch(0.93 0.04 60)` | `oklch(0.64 0.18 45)` / `oklch(0.72 0.07 45)` / `oklch(0.45 0.14 45)` |
| línea viento / suave / texto | `oklch(0.8 0.15 195)` / `oklch(0.7 0.09 195)` / `oklch(0.92 0.04 195)` | `oklch(0.55 0.14 195)` / `oklch(0.7 0.07 195)` / `oklch(0.42 0.12 195)` |
| barra lluvia / línea prob / texto | `oklch(0.7 0.15 250)` / `oklch(0.85 0.11 235)` / `oklch(0.9 0.06 235)` | `oklch(0.6 0.15 250)` / `oklch(0.55 0.13 235)` / `oklch(0.42 0.12 240)` |
| relleno de punto (dot) | `oklch(0.2 0.02 255)` | `oklch(0.995 0.003 250)` |
| eje / rejilla | `oklch(0.6 0.02 250)` / `oklch(0.32 0.02 255)` | `oklch(0.58 0.02 250)` / `oklch(0.88 0.008 250)` |

### Radios, espaciado, tipografía

- Radios: tarjeta grande `26px` (hero) · tarjeta `20px` · tarjeta pequeña `18px` · celda hora
  `16px` · chip/pill `99px` · cuadrado de icono `10-15px` · badge nota `8px`.
- Gaps: sección `14px` · rejilla de tiles `10px` · tira de horas/días `6px`.
- Escala tipográfica usada: 74 (temp hero) · 26 (nombre localidad, °C) · 23 (valor tile) · 22 (nota
  grande) · 17 (veredicto deporte) · 16 (temp hora, condición) · 15 (dato astro, hora tabla) · 14 ·
  13 · 12.5 · 12 · 11 · 10.5 · 10 · 9.5 · 9 · 8.5 (etiquetas uppercase).
- Etiquetas de sección: 10-11px, `font-weight: 800`, `text-transform: uppercase`,
  `letter-spacing: .16em`, color `--muted`.

---

## Screens / Views

### 1. Vista principal (`view = 'main'`)

Orden vertical de bloques:

**1.1 Cabecera**
- Punto `7px` color `--live` + rótulo "UBICACIÓN ACTUAL" (10px/800/uppercase/.16em, `--muted`).
- Nombre de localidad: 26px/800, `letter-spacing: -.02em`, una línea con ellipsis.
- Subtítulo 12px/500 `--muted`: `"{región, país} · datos {HH:MM}"`.
- A la derecha, dos botones `40×40`, radio `14px`, fondo `--btn`, borde `--border`, hover
  `--btn-hover`: alternar tema (icono sol/luna) y recargar (icono refresh; gira con
  `animation: spin 1s linear infinite` mientras carga).

**1.2 Tarjeta principal (hero)**
- `padding: 20px`, radio `26px`, fondo `linear-gradient(165deg, var(--hero-a), var(--hero-b))`,
  borde `--hero-border`.
- Temperatura 74px/800 mono, `line-height: .9`, `letter-spacing: -.045em`; "°C" 26px/600
  `--text-soft`.
- Debajo: condición 16px/700 (texto en español según código WMO) y "Sensación de X°C" 13px/500
  `--muted`.
- Derecha: icono meteorológico grande 92px según código y día/noche.
- Pie separado por `border-top: 1px solid var(--hero-border)`, `margin-top: 16px`,
  `padding-top: 14px`: "▲ Máx N°" (flecha `--hot`) · "▼ Mín N°" (flecha `--cold`) y a la derecha
  píldora UV: punto 7px + "UV n" + etiqueta, colores por banda (ver *Escala UV*).

**1.3 Selector de deporte + tarjeta de valoración**
- Fila de chips (`padding: 7px 13px`, radio 99, 12px/800) con icono 14px + texto: **Bici**,
  **Correr**. El seleccionado usa fondo `--now-bg`, borde `--now-border`, texto `--text`; el resto
  fondo transparente, borde `--border`, texto `--muted`. Por defecto **Bici**.
  Estructura pensada para añadir más deportes sin tocar el layout.
- Tarjeta del deporte seleccionado: `padding: 15px 16px`, radio `20px`; fondo/borde según la banda
  de valoración (ver *Puntuación*).
  - Fila superior: cuadrado `44×44` radio `15px` con el color sólido de la banda y el icono del
    deporte dentro; a su lado "AHORA PARA {Bici|Correr}" (9.5px/700/uppercase/.16em `--muted`) y el
    veredicto 17px/800 en el color de texto de la banda; a la derecha píldora con la nota:
    número 22px/800 mono + "/10" 10px/600 opacidad .7.
  - Motivo: 12.5px/500 `--text-soft`, `text-wrap: pretty` (p. ej. "rachas de 34 km/h · 20% de
    lluvia").
  - Pie con `border-top`: "MEJOR HUECO (24 H)" + franja `HH:MM–HH:MM` 16px/800 mono + día
    ("hoy"/"mañana"/día de la semana) 11px/600 `--muted`; a la derecha, píldora con la nota de esa
    ventana coloreada por **su propia** banda.

**1.4 Rejilla de indicadores (2×2)**
Tarjetas `padding: 13px 14px`, radio `18px`, fondo `--surface`, borde `--border`. Cada una: icono
15px + etiqueta uppercase 10px `--muted`; valor 23px/800 mono + unidad 11px/600 `--muted`;
línea inferior 11px/600 `--muted` (con flecha de dirección en la de viento).

| Tile | Valor | Sub |
|---|---|---|
| Humedad | `current.relative_humidity_2m` % | "ambiente muy húmedo" si >85, si no "confortable" |
| Prob. lluvia | prob. de la hora actual % | "X.X mm ahora" |
| Viento | velocidad | flecha + "del {N…NO} (nnn°)" |
| Rachas | racha | "atención en bici" si >40 km/h, si no "sin sobresaltos" |

**1.5 Sol y luna**
Tarjeta con rejilla 2×2: Amanece, Atardece, Sale la luna, Se pone (icono 18px + etiqueta uppercase
10px + hora 15px/700 mono). Pie con `border-top`: "Luna {fase} · {n}% iluminada".

**1.6 Próximas horas (5 por defecto)**
- Cabecera con rótulo "PRÓXIMAS HORAS" y a la derecha botón "Ver todas" (icono expandir + texto
  11px/700, pill `--btn`).
- 5 celdas `flex: 1 1 0`, `padding: 10px 4px 11px`, radio `16px`, `gap: 6px`. La hora actual usa
  fondo `--now-bg` y borde `--now-border`; el resto `--surface` / `--border`.
- Contenido por celda, en columna centrada con `gap: 6px`:
  1. Hora (`Ahora` o `HH:MM`) 10.5px/700 mono `--muted`.
  2. Badge de nota: icono del deporte 11px + número 12px/800 mono, fondo/borde de la banda.
  3. Icono meteorológico 24px.
  4. Temperatura 16px/800 mono y debajo sensación 9.5px/600 `--warm`.
  5. Probabilidad 11px/700 (color por umbral) y mm 10px/600 (`—` si 0).
  6. Flecha + dirección cardinal 10.5px/800 `--teal`; velocidad con unidad 9.5px/700 `--text-soft`;
     "r {racha} {unidad}" 9.5px/600 `--muted2`.

**1.7 Gráficas (para las N horas mostradas)**
Tarjetas `padding: 15px 14px 12px`, radio `20px`, `--surface`/`--border`. Cabecera: título 12px/800
y leyenda (barrita `14×3` radio 99 + etiqueta 10px/600 `--muted`). En este orden:
1. **Conveniencia {bici|correr} · N h** — barras verticales con la nota 1-10 por hora, color por
   banda, valor encima.
2. **Temperatura · N h** — área + línea de temperatura real (2.6px), línea discontinua `4 4` de
   sensación (1.6px) con puntos pequeños, punto hueco por hora y valor con un decimal encima
   (o debajo si baja respecto a la hora anterior).
3. **Viento y dirección · N h** — flechas de dirección (16px) y cardinal en la banda superior,
   área+línea de velocidad, área/línea discontinua de rachas, valores numéricos sobre cada punto.
4. **Lluvia · N h** — barras de mm con su valor encima y línea+puntos de probabilidad (escala
   0-100 independiente).

Todas: `viewBox 0 0 352 H`, `width: 100%`; rejilla vertical discontinua `2 4` y etiquetas de hora
(`HH` + "h") en la base. Con más de 9 puntos se reduce densidad: etiquetas cada 3-4 puntos, puntos
más pequeños, sin valor de rachas ni de mm.

**1.8 Próximos 7 días**
Lista dentro de una tarjeta; cada fila `padding: 12px 14px`, separador `1px solid var(--border)`
(la primera sin separador):
- Día ("Hoy", "Mañana", "mié"…) 13px/800 y fecha `d/m` 10px/600 mono `--muted2`, ancho 52px.
- Icono 26px.
- Fila de temperaturas: mín 12px/600 `--muted` (26px, alineado a la derecha), barra de rango
  `height: 5px` radio 99 sobre `--track` con segmento
  `linear-gradient(90deg, var(--cold), var(--hot))` posicionado con el mín/máx del día respecto al
  rango de los 7 días, y máx 13px/800 (28px).
- Debajo: gota + "nn% · X.X mm" (color `--muted2` o color lluvia si prob ≥ 40) y flecha +
  "vel/racha unidad" en `--teal`, todo 10px/700 mono.

**1.9 Pie**
"Datos: Open-Meteo · {lat}, {lon}" 10px/600 `--muted3`, centrado. Si se usó la ubicación por
defecto, se antepone "ubicación por defecto · ".

### 2. Vista hora a hora (`view = 'hours'`)

- Cabecera: botón "Volver" (icono ‹ + texto), rótulo "HORA A HORA" y, a la derecha, los chips de
  deporte (con icono).
- **Selector de día**: 5 tarjetas verticales `flex: 1 1 0` (mismo tratamiento visual que las celdas
  de hora; la seleccionada con `--now-bg`/`--now-border`): día + fecha, icono 24px, máxima 14px/800
  y mínima 10px/600, probabilidad y mm, flecha + velocidad y "r racha".
- **Gráficas del día seleccionado**: las mismas cuatro, con los datos de las 24 h de ese día.
- **Tabla detallada**: tarjeta con cabecera de columnas (9px/700/uppercase `--muted2`) y filas en
  `display: grid; grid-template-columns: 42px 28px 1fr 54px 66px 30px; gap: 6px;
  padding: 9px 12px`:
  1. Hora `HH:MM` 13px/800 mono + "AHORA" 8.5px si aplica.
  2. Icono meteorológico 26px.
  3. Temperatura 15px/800 + sensación 10.5px/600 `--warm`; debajo la condición 10px/600 `--muted`
     truncada.
  4. Probabilidad 12px/800 (color por umbral) + mm 10px/600.
  5. Flecha + cardinal y velocidad 11px/800 `--teal`; "r racha" 10px/600 `--muted2`.
  6. Badge de nota: icono del deporte + número 12px/800, fondo/borde de la banda.
  - Cabecera de día insertada cada vez que cambia la fecha: `padding: 7px 12px`, fondo `--btn`,
    9.5px/800 uppercase `--muted` ("Mañana 11/8").
  - La fila de la hora actual lleva fondo `--now-bg`.
- **Paginación**: se renderizan 48 h; botón "Cargar 48 h más · quedan N" al final; al cambiar de día
  el límite vuelve a 48. Es obligatorio: renderizar el horizonte completo (~190 filas) bloquea el
  hilo principal ~1 s en móvil.
- Botón final "Volver al resumen".

### 3. Estados de carga y error

- **Cargando**: tres bloques placeholder (190/110/140px, radios 24/20/20, fondo `--surface`) con
  `animation: pulse 1.6s ease-in-out infinite` (`opacity` .35 → .7).
- **Error**: tarjeta `--err-bg`/`--err-border` con título "No se pudo cargar el tiempo", el mensaje
  y botón "Reintentar" (fondo `--text`, texto `--bg2`).

---

## Interactions & Behavior

- Al montar: `navigator.geolocation.getCurrentPosition` con `timeout: 10000`,
  `maximumAge: 300000`. Si falla o se deniega, **fallback a Madrid (40.4168, -3.7038)** marcando
  `fallback = true` (se indica en el pie y en el subtítulo "Ubicación por defecto").
- Botón recargar: repite geolocalización + fetch; el icono gira mientras carga.
- Botón tema: alterna `data-theme` en `<html>`; recalcula también los colores de iconos y gráficas.
- Chips de deporte: cambian la valoración mostrada, el badge de cada hora, la columna Nota y la
  gráfica de conveniencia. No refetch.
- "Ver todas" → vista hora a hora (scroll a 0, día 0, límite 48 h). "Volver" → vista principal.
- Tarjetas de día: seleccionan el día de las gráficas y el punto de arranque de la tabla.
- Sin animaciones más allá de `spin` y `pulse`; hover solo en botones/pills (`--btn-hover`).

## State Management

| Estado | Valor inicial | Notas |
|---|---|---|
| `loading` | `true` | |
| `error` | `null` | mensaje de error de red |
| `data` | `null` | respuesta completa de Open-Meteo |
| `place`, `region` | `null` | de la geocodificación inversa |
| `lat`, `lon`, `fallback` | `null`, `null`, `false` | |
| `theme` | `null` → prop `theme` (`'dark'`) | `'dark' | 'light'` |
| `view` | `'main'` | `'main' | 'hours'` |
| `dayIdx` | `0` | día seleccionado (0-4 en el selector) |
| `sport` | `'bike'` | `'bike' | 'run'` |
| `hourLimit` | `48` | filas de la tabla; +48 por pulsación |

Opciones configurables (props del prototipo, candidatas a ajustes de usuario en la app):
`theme` (dark/light), `hoursAhead` (3-8, por defecto 5), `windUnit` (`km/h` | `m/s`),
`showCyclingIndex` (bool).

## Data fetching

**Open-Meteo** (`https://api.open-meteo.com/v1/forecast`), `timezone=auto`, `forecast_days=8`:

- `current`: `temperature_2m, relative_humidity_2m, apparent_temperature, is_day, precipitation,
  weather_code, wind_speed_10m, wind_direction_10m, wind_gusts_10m`
- `hourly`: `temperature_2m, apparent_temperature, relative_humidity_2m,
  precipitation_probability, precipitation, weather_code, wind_speed_10m, wind_direction_10m,
  wind_gusts_10m, is_day`
- `daily`: `weather_code, temperature_2m_max, temperature_2m_min, precipitation_probability_max,
  precipitation_sum, wind_speed_10m_max, wind_gusts_10m_max, wind_direction_10m_dominant,
  sunrise, sunset, uv_index_max`

**Geocodificación inversa**:
`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=..&longitude=..&localityLanguage=es`
→ `city || locality || principalSubdivision` para el nombre; `principalSubdivision, countryName`
para la región. Si falla, "Ubicación actual" y sin región. (Sustituible por otro proveedor; no
requiere clave.)

Las horas de la API vienen en hora local del lugar (`timezone=auto`) como `YYYY-MM-DDTHH:MM`: se
usan por *substring*, sin convertir a `Date`, para evitar desfases de zona. La hora actual es el
índice de `hourly.time` cuyo `slice(0,13)` coincide con `current.time.slice(0,13)`.

## Reglas de negocio

### Códigos WMO → texto y familia de icono

`0` Despejado (clear) · `1` Mayormente despejado, `2` Parcialmente nublado (pcloud) · `3` Nublado
(cloud) · `45/48` Niebla / Niebla helada (fog) · `51/53/55` Llovizna débil/Llovizna/Llovizna intensa,
`56/57` Llovizna helada (drizzle) · `61/63` Lluvia débil/Lluvia, `66` Lluvia helada (rain) ·
`65/67/82` Lluvia fuerte / Lluvia helada fuerte / Chubascos fuertes (heavy) · `71/73/75` Nieve
débil/Nieve/Nieve fuerte, `77` Granizo fino, `85/86` Chubascos de nieve (snow) · `80/81` Chubascos
(shower) · `95` Tormenta, `96/99` Tormenta con granizo (storm). Desconocido → "—" (cloud).

Los iconos `clear` y `pcloud` tienen variante diurna (sol) y nocturna (luna) según `is_day`.

### Puntuación por actividad (1-10)

Se parte de 100 y se resta; la nota es `clamp(round(s/10), 1, 10)`.

Comunes: prob. lluvia ≥70 −45, ≥40 −25, ≥20 −10; precipitación >1 mm −20; código ≥95 (tormenta) −50.

**Bici**: temp <5 −45, <10 −20, >33 −40, >28 −15. Rachas >55 −45, >40 −28, >28 −14.

**Correr**: temp <2 −35, <6 −15, >30 −45, >25 −25, >21 −10. Rachas >55 −20, >40 −10. Si temp >24 y
humedad >70 → −15 ("bochorno, ritmo suave").

Veredicto por puntuación bruta: ≥75 "Buenas condiciones" (hue 145) · ≥50 "Aceptable, con cuidado"
(hue 85) · resto "Mejor otro día" (hue 30).

Motivo: se componen hasta dos notas, en este orden — viento ("rachas de N km/h" si racha >28, o
"viento flojo"/"viento poco molesto"), lluvia ("N% de lluvia" si ≥30, si no "sin lluvia prevista"),
temperatura ("frío, abriga bien" por debajo de 8 (bici) / 4 (correr); "calor, lleva agua" por encima
de 30 (bici) / 26 (correr)).

**Bandas de color de la nota** (hue): 8-10 → 145 (verde) · 6-7 → 105 (lima) · 4-5 → 65 (ámbar) ·
1-3 → 25 (rojo). Estilos:
- Oscuro: texto `oklch(0.88 0.16 H)`, fondo `oklch(0.35 0.09 H / 0.75)`, borde
  `oklch(0.55 0.12 H / 0.55)`.
- Claro: texto `oklch(0.42 0.15 H)`, fondo `oklch(0.93 0.07 H)`, borde `oklch(0.84 0.1 H)`.

**Mejor hueco**: ventana de 2 h consecutivas con mayor media de nota dentro de las próximas 36 h,
**considerando solo horas con luz** (`hourly.is_day === 1` en ambas horas). Si no hay ninguna
diurna, se usa la mejor absoluta. Se muestra `HH:MM–HH:MM` (inicio de la primera hora a inicio de la
tercera), el día y la nota redondeada.

### Escala UV

0-2 Bajo (hue 145, croma .14) · 3-5 Moderado (95, .15) · 6-7 Alto (60, .16) · 8-10 Muy alto
(30, .17) · 11+ Extremo (340, .15). Oscuro: color `oklch(0.82 c H)`, fondo `oklch(0.42 c H / .2)`,
borde `oklch(0.6 c H / .45)`. Claro: color `oklch(0.5 c H)`, fondo `oklch(0.75 c H / .16)`, borde
`oklch(0.7 c H / .5)`.

### Umbrales de color de lluvia por hora

Probabilidad ≥50 → azul fuerte (`oklch(0.78 0.14 245)` oscuro / `oklch(0.5 0.15 245)` claro);
≥20 → azul suave; <20 → `--muted2`. mm >0 → azul (`oklch(0.72 0.11 250)` / `oklch(0.52 0.12 250)`),
si 0 se muestra "—" en `--muted3`.

### Dirección del viento

Cardinales `['N','NE','E','SE','S','SO','O','NO']` con `round((deg % 360) / 45) % 8`. La flecha
apunta **hacia donde va** el viento: rotación = `dirección + 180°`.

### Luna

- Fase: días desde la luna nueva de referencia `Date.UTC(2000, 0, 6, 18, 14)`, sinódico
  `29.530588853`; iluminación `(1 - cos(2πp)) / 2`. Nombres: nueva, creciente, en cuarto creciente,
  gibosa creciente, llena, gibosa menguante, en cuarto menguante, menguante.
- Salida/puesta: altitud lunar (algoritmo tipo SunCalc, incluido en el prototipo) muestreada cada
  20 min desde medianoche local; primer cruce negativo→positivo = salida, positivo→negativo =
  puesta; `—` si no ocurre ese día.

## Performance

- Memoizar los iconos SVG por clave (`código|is_day|tamaño`, `dirección redondeada a 5°|tamaño|
  color`, `nombre|tamaño|color`) e invalidar al cambiar de tema. Sin esto, cambiar de día o de
  deporte reconstruye ~570 SVG y bloquea ~1 s.
- Paginar la tabla (48 h) como se indica arriba. En un stack nativo/React, considerar además lista
  virtualizada.

## Assets

Ninguna imagen. Todos los iconos son SVG inline sobre `viewBox 0 0 24 24`, trazo redondeado
(`stroke-linecap/linejoin: round`), grosor 1.5-1.8 (2.4 en la flecha de viento): meteorológicos
(sol con 8 rayos, luna, nube, niebla, llovizna, lluvia, chubascos, nieve, tormenta), UI (gota,
viento, rachas, humedad, amanecer, atardecer, salida/puesta de luna, bici, corredor, refresh, volver,
expandir, sol/luna de tema) y la flecha de dirección. Fuentes: Google Fonts (Manrope, IBM Plex Mono).

## Files

- `Tiempo Ciclista.dc.html` — prototipo completo (plantilla + lógica). Contiene el código real de:
  llamadas a la API, cálculo de puntuación, cálculo lunar, generadores SVG de las cuatro gráficas y
  todos los iconos. Es la referencia a portar.
- `support.js` — runtime del entorno de prototipado. **No portar**; solo necesario para abrir el
  HTML en el navegador.
