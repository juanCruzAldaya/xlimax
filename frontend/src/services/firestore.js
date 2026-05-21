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
export function subscribeToReadings(callback, count = 864) {
  const q = query(collection(db, COL), orderBy('ts', 'desc'), limit(count))
  return onSnapshot(q, snap => {
    const data = snap.docs
      .map(d => {
        const doc = d.data()
        return {
          epoch: doc.ts?.toMillis() ?? Date.now(),
          t:     doc.t ?? null,
          h:     doc.h ?? null,
          l:     doc.l ?? null,
        }
      })
      .reverse()
    callback(data)
  })
}

/**
 * Lectura única (para SSR o carga inicial sin listener).
 */
export async function fetchReadings(count = 864) {
  const q    = query(collection(db, COL), orderBy('ts', 'desc'), limit(count))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => {
      const doc = d.data()
      return { epoch: doc.ts?.toMillis() ?? Date.now(), t: doc.t, h: doc.h, l: doc.l }
    })
    .reverse()
}

/**
 * Escribe una lectura desde el frontend (testing / simulación manual).
 * En producción el ESP32 escribe a través del backend FastAPI + Firebase Admin SDK.
 */
export async function pushReading({ t, h, l, deviceId = 'esp32-juanin-01' }) {
  return addDoc(collection(db, COL), { t, h, l, deviceId, ts: serverTimestamp() })
}
