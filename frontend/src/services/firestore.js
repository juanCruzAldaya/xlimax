import { db } from '../firebase'
import {
  collection, query, orderBy, limit,
  getDocs, addDoc, serverTimestamp, onSnapshot,
} from 'firebase/firestore'
import { vpdLeaf, vpdAir } from '../utils/vpd'

const COL = 'readings'

/**
 * Suscripción en tiempo real a las últimas `count` lecturas.
 * Retorna la función de unsubscribe.
 *
 * Cada documento tiene: { t, h, l, deviceId, ts (Timestamp) }
 * La función normaliza a { epoch, t, h, l } para compatibilidad con los charts.
 */
function avg(values) {
  const v = values.filter(x => x != null)
  return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : null
}

function flatNode(s) {
  if (!s) return { t: null, h: null, l: null, p: null, a: null, v: null, vair: null }
  const t = s.temperature ?? null
  const h = s.humidity    ?? null
  return {
    t,
    h,
    l: s.light        ?? null,
    p: s.pressure_hpa ?? null,
    a: s.altitude_m   ?? null,
    v:    vpdLeaf(t, h),   // VPD foliar (offset default 2°C) — métrica derivada
    vair: vpdAir(t, h),    // VPD de aire
  }
}

// Soporta dos formatos:
// Nuevo: { sensors: { interior: {...}, exterior: {...} } }
// Viejo: { temperature, humidity, light }  (backwards compat)
function normalize(doc) {
  const ts    = doc.ts ?? doc.received_at
  const epoch = ts?.toMillis?.() ?? Date.now()

  if (doc.sensors) {
    // Guarda cada nodo por separado + promedio para el combined chart
    const nodes = Object.fromEntries(
      Object.entries(doc.sensors).map(([name, s]) => [name, flatNode(s)])
    )
    const vals = Object.values(nodes)
    return {
      epoch,
      nodes,                              // { interior: {t,h,l,p,a}, exterior: {t,h,l,p,a} }
      t: avg(vals.map(s => s.t)),         // promedio global (combined chart)
      h: avg(vals.map(s => s.h)),
      l: avg(vals.map(s => s.l)),
      p: avg(vals.map(s => s.p)),
      a: avg(vals.map(s => s.a)),
      v: avg(vals.map(s => s.v)),
    }
  }

  return {
    epoch,
    nodes: {},
    t: doc.t ?? doc.temperature ?? null,
    h: doc.h ?? doc.humidity    ?? null,
    l: doc.l ?? doc.light       ?? null,
    p: doc.pressure_hpa ?? null,
    a: doc.altitude_m   ?? null,
  }
}

export function subscribeToReadings(callback, count = 864) {
  const q = query(collection(db, COL), orderBy('ts', 'desc'), limit(count))
  return onSnapshot(q, snap => {
    const data = snap.docs.map(d => normalize(d.data())).reverse()
    callback(data)
  })
}

export async function fetchReadings(count = 864) {
  const q    = query(collection(db, COL), orderBy('ts', 'desc'), limit(count))
  const snap = await getDocs(q)
  return snap.docs.map(d => normalize(d.data())).reverse()
}

/**
 * Escribe una lectura desde el frontend (testing / simulación manual).
 * En producción el ESP32 escribe a través del backend FastAPI + Firebase Admin SDK.
 */
export async function pushReading({ t, h, l, deviceId = 'esp32-juanin-01' }) {
  return addDoc(collection(db, COL), { t, h, l, deviceId, ts: serverTimestamp() })
}
