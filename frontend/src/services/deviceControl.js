import { db } from '../firebase'
import {
  doc, onSnapshot, setDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore'

const DEVICE_ID = 'esp32-juanin-01'

function deviceRef() {
  return doc(db, 'devices', DEVICE_ID)
}

export const DEFAULT_STATE = {
  light:  false,
  fan:    false,
  pump:   false,
  aux:    false,
}

export const ACTUATOR_CONFIG = {
  light: { label: 'Iluminación',  icon: 'light',  color: '#f59e0b' },
  fan:   { label: 'Ventilador',   icon: 'fan',    color: '#38bdf8' },
  pump:  { label: 'Riego',        icon: 'pump',   color: '#a3e635' },
  aux:   { label: 'Auxiliar',     icon: 'aux',    color: '#818cf8' },
}

/** Suscripción en tiempo real al estado del dispositivo */
export function subscribeToDeviceState(callback) {
  return onSnapshot(deviceRef(), snap => {
    if (snap.exists()) {
      callback({ ...DEFAULT_STATE, ...snap.data() })
    } else {
      callback(DEFAULT_STATE)
    }
  })
}

/** Cambia el estado de un actuador (app → Firestore → ESP32 lo lee) */
export async function toggleActuator(key, value) {
  const ref = deviceRef()
  try {
    await updateDoc(ref, { [key]: value, updatedAt: serverTimestamp() })
  } catch {
    /* doc no existe aún, lo creamos */
    await setDoc(ref, { ...DEFAULT_STATE, [key]: value, updatedAt: serverTimestamp() })
  }
}

/** Apaga todos los actuadores */
export async function allOff() {
  await setDoc(deviceRef(), { ...DEFAULT_STATE, updatedAt: serverTimestamp() })
}
