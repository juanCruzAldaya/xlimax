import { db } from '../firebase'
import {
  collection, query, orderBy, limit,
  getDocs, addDoc, serverTimestamp, onSnapshot,
} from 'firebase/firestore'

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
  return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null
}

// Soporta dos formatos:
// Nuevo: { sensors: { interior: {temperature, humidity, light}, exterior: {...} } }
// Viejo: { temperature, humidity, light }  (backwards compat)
function normalize(doc) {
  const ts    = doc.ts ?? doc.received_at
  const epoch = ts?.toMillis?.() ?? Date.now()

  if (doc.sensors) {
    const vals = Object.values(doc.sensors)
    return {
      epoch,
      t:       avg(vals.map(s => s.temperature)),
      h:       avg(vals.map(s => s.humidity)),
      l:       avg(vals.map(s => s.light)),
      p:       avg(vals.map(s => s.pressure_hpa)),
      a:       avg(vals.map(s => s.altitude_m)),
      sensors: doc.sensors,
    }
  }

  return {
    epoch,
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
