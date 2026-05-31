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
// El backend escribe temperature/humidity/light (nombre largo)
// El frontend usa t/h/l (nombre corto) — normalizamos acá
function normalize(doc) {
  const ts = doc.ts ?? doc.received_at
  return {
    epoch: ts?.toMillis?.() ?? Date.now(),
    t:     doc.t ?? doc.temperature ?? null,
    h:     doc.h ?? doc.humidity    ?? null,
    l:     doc.l ?? doc.light       ?? null,
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
