/* Mock data — ESP32 · Junín, Buenos Aires — 18-20 mayo 2026
   Interval: 5 min | Points: 864 (3 días × 288 lecturas/día)
   Timezone: ART = UTC-3 */

function noise(i, a = 0.7, b = 1.3, c = 2.1) {
  return Math.sin(i * a) * 0.50
       + Math.sin(i * b) * 0.30
       + Math.sin(i * c) * 0.20;
}

const PROFILES = [
  { name: 'Parcialmente nublado', tMin: 7.2, tMax: 14.1, hBase: 73, hRange: 14, lPeak: 11000 },
  { name: 'Lluvioso',             tMin: 6.8, tMax: 11.0, hBase: 84, hRange:  8, lPeak:  3800 },
  { name: 'Despejado',            tMin: 5.6, tMax: 16.5, hBase: 63, hRange: 18, lPeak: 22000 },
];

const SUNRISE = 7.5;   // 07:30 ART
const SUNSET  = 18.0;  // 18:00 ART

/* midnight 18/05/2026 ART = 2026-05-18T03:00:00Z */
const START   = new Date('2026-05-18T03:00:00.000Z').getTime();
const STEP    = 5 * 60 * 1000;
const POINTS  = 3 * 24 * 12;

export const readings = Array.from({ length: POINTS }, (_, i) => {
  const epoch  = START + i * STEP;
  const dayIdx = Math.floor(i / (24 * 12));
  const minOfDay = (i % (24 * 12)) * 5;
  const h = minOfDay / 60;
  const p = PROFILES[Math.min(dayIdx, 2)];

  /* temperature — sinusoidal: min 06:00, max 15:00 */
  const tNorm = (Math.sin((h - 6) / 24 * 2 * Math.PI - Math.PI / 2) + 1) / 2;
  const t = p.tMin + tNorm * (p.tMax - p.tMin) + noise(i, 0.31, 0.73, 1.37) * 0.5;

  /* humidity — inverse of temperature + weather bias */
  const hum = p.hBase - tNorm * p.hRange + noise(i, 0.47, 1.09, 2.33) * 2.5;

  /* light — bell curve between sunrise and sunset */
  let lux = 0;
  if (h >= SUNRISE && h <= SUNSET) {
    const dp = (h - SUNRISE) / (SUNSET - SUNRISE);
    lux = Math.sin(dp * Math.PI) * p.lPeak;
    lux *= 0.88 + noise(i, 3.11, 5.03, 7.19) * 0.12;
    /* rainy day extra dampening */
    if (dayIdx === 1) lux *= 0.45 + Math.abs(noise(i, 2.71, 4.13)) * 0.25;
    lux = Math.max(0, lux);
  }

  /* pressure — small variations around 1013 hPa */
  const press = 1013.0 + Math.sin((h / 24) * Math.PI) * 1.5 + noise(i, 0.13, 0.29, 0.71) * 0.8;

  /* altitude — derived from pressure */
  const alt = 44330 * (1 - Math.pow(press / 1013.25, 1 / 5.255));

  return {
    epoch,
    t: +t.toFixed(1),
    h: +Math.max(38, Math.min(98, hum)).toFixed(1),
    l: Math.round(Math.max(0, lux)),
    p: +press.toFixed(2),
    a: +alt.toFixed(2),
  };
});

/* handy slices */
export const last24h = readings.slice(-288);
export const lastHour = readings.slice(-12);

export const weatherProfiles = PROFILES;

export const SENSOR_CONFIG = {
  t: {
    key: 't',
    label: 'Temperatura',
    labelShort: 'Temp',
    unit: '°C',
    colorHex: '#ef4444',
    bgClass: 'bg-red-50',
    textClass: 'text-red-500',
    gradId: 'grad-t',
    thresholds: { low: 8, high: 30 },
  },
  h: {
    key: 'h',
    label: 'Humedad',
    labelShort: 'Hum',
    unit: '%',
    colorHex: '#06b6d4',
    bgClass: 'bg-cyan-50',
    textClass: 'text-cyan-500',
    gradId: 'grad-h',
    thresholds: { low: 40, high: 85 },
  },
  l: {
    key: 'l',
    label: 'Luminosidad',
    labelShort: 'Luz',
    unit: '',
    colorHex: '#84cc16',
    bgClass: 'bg-lime-50',
    textClass: 'text-lime-500',
    gradId: 'grad-l',
    thresholds: { low: 20, high: 80 },
  },
  p: {
    key: 'p',
    label: 'Presión',
    labelShort: 'Presión',
    unit: 'hPa',
    colorHex: '#8b5cf6',
    bgClass: 'bg-violet-50',
    textClass: 'text-violet-500',
    gradId: 'grad-p',
    thresholds: { low: 1010, high: 1020 },
  },
  a: {
    key: 'a',
    label: 'Altitud',
    labelShort: 'Alt',
    unit: 'm',
    colorHex: '#ec4899',
    bgClass: 'bg-pink-50',
    textClass: 'text-pink-500',
    gradId: 'grad-a',
    thresholds: { low: -50, high: 100 },
  },
};

export function calcStats(data, key) {
  if (!data.length) return {};
  const vals = data.map(d => d[key]);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const std = Math.sqrt(vals.reduce((a, b) => a + (b - avg) ** 2, 0) / vals.length);
  return { min: +min.toFixed(1), max: +max.toFixed(1), avg: +avg.toFixed(1), std: +std.toFixed(1) };
}

export function formatEpoch(epoch, points) {
  const d = new Date(epoch);
  if (points <= 72) {
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }
  if (points <= 288) {
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
